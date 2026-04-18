const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const Portfolio = require('../models/Portfolio');
const auth = require('../middleware/auth');
const { calcCompletion } = require('../utils/profileCompletion');
const isTestMode = require('../utils/isTestMode');
const { uploadToImageKit } = require('../utils/imagekit');

function razorpayClient() {
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

function rzpAuth() {
  return { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/portfolio/:userId — public
router.get('/:userId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId })
      .populate('user', 'name role rating totalJobsCompleted onTimeDeliveryRate disputeRate');
    if (!portfolio) return res.status(404).json({ message: 'Portfolio not found' });
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/update
router.post('/update', auth, async (req, res) => {
  try {
    const {
      bio, skills, githubUrl, linkedinUrl, portfolioUrl, availability,
      companyName, industry,
      // new client fields
      clientType, location, yearsHiring, preferredComm, companySize, websiteUrl
    } = req.body;
    // Fetch current portfolio to include existing projectSamples/resumeUrl in completion calc
    const existing = await Portfolio.findOne({ user: req.user.id });
    const resolvedRole = existing?.role || req.user.role;
    const update = {
      bio, skills, githubUrl, linkedinUrl, portfolioUrl, availability,
      companyName, industry,
      clientType, location, yearsHiring, preferredComm, companySize, websiteUrl,
      role: resolvedRole   // always persist role so upsert creates it correctly
    };

    const mergedData = {
      ...update,
      projectSamples: existing?.projectSamples || [],
      resumeUrl: existing?.resumeUrl || '',
      avatarUrl: update.avatarUrl || existing?.avatarUrl || '',
      paymentVerified: existing?.paymentVerified || false,
    };
    update.completionPercent = calcCompletion(resolvedRole, mergedData);

    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/upload-avatar
router.post('/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const avatarUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/safelancer/avatars');
    const existing = await Portfolio.findOne({ user: req.user.id });
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: { avatarUrl } },
      { new: true, upsert: true }
    );
    const mergedData = {
      ...portfolio.toObject(),
      avatarUrl,
      paymentVerified: existing?.paymentVerified || false,
      role: portfolio.role || req.user.role
    };
    const completion = calcCompletion(mergedData.role, mergedData);
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ avatarUrl, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/create-verification-order — client: creates ₹1 Razorpay order
router.post('/create-verification-order', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    if (isTestMode()) {
      return res.json({
        orderId: 'order_test_verify_' + Date.now(),
        amount: 100,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID || 'test',
        isTestMode: true
      });
    }
    const razorpay = razorpayClient();
    const order = await razorpay.orders.create({
      amount: 100,
      currency: 'INR',
      receipt: 'verify_' + req.user.id + '_' + Date.now(),
      notes: { purpose: 'payment_verification', userId: req.user.id }
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create order', error: err.message });
  }
});

// POST /api/portfolio/confirm-verification — client: verify Razorpay signature + auto-refund + mark verified
router.post('/confirm-verification', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Clients only' });
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Test mode: skip signature check and refund for mock orders
    if (razorpay_order_id?.startsWith('order_test_')) {
      const portfolio = await Portfolio.findOneAndUpdate(
        { user: req.user.id },
        { $set: { paymentVerified: true } },
        { new: true, upsert: true }
      );
      const completion = calcCompletion(portfolio.role, portfolio.toObject());
      await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
      return res.json({ paymentVerified: true, completionPercent: completion });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment fields' });
    }
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');
    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }
    const razorpay = razorpayClient();
    await razorpay.payments.refund(razorpay_payment_id, { amount: 100, speed: 'optimum', notes: { reason: 'payment_method_verification' } });
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: { paymentVerified: true } },
      { new: true, upsert: true }
    );
    const completion = calcCompletion(portfolio.role, portfolio.toObject());
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ paymentVerified: true, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
});

// POST /api/portfolio/verify-payment — kept for backward compat, now delegates to confirm flow
router.post('/verify-payment', auth, async (req, res) => {
  res.status(400).json({ message: 'Use /create-verification-order and /confirm-verification instead' });
});

// POST /api/portfolio/payout-details — freelancer saves bank/UPI payout info
router.post('/payout-details', auth, async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') return res.status(403).json({ message: 'Freelancers only' });
    const { payoutMethod, bankAccountNumber, ifscCode, accountHolderName, upiId } = req.body;

    if (!payoutMethod) return res.status(400).json({ message: 'Payout method is required' });

    if (payoutMethod === 'bank') {
      if (!bankAccountNumber || !ifscCode || !accountHolderName)
        return res.status(400).json({ message: 'Bank account number, IFSC, and account holder name are required' });
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase()))
        return res.status(400).json({ message: 'Invalid IFSC code format' });
    }

    if (payoutMethod === 'upi') {
      if (!upiId || !upiId.includes('@'))
        return res.status(400).json({ message: 'Valid UPI ID is required (e.g. name@upi)' });
    }

    const update = {
      payoutMethod,
      payoutDetailsAdded: true,
      paymentVerified: false,
      razorpayContactId: '',
      razorpayFundAccountId: ''
    };

    if (payoutMethod === 'bank') {
      update.bankAccountNumber = bankAccountNumber;
      update.ifscCode = ifscCode.toUpperCase();
      update.accountHolderName = accountHolderName;
      update.upiId = '';
    } else {
      update.upiId = upiId;
      update.bankAccountNumber = '';
      update.ifscCode = '';
      update.accountHolderName = '';
    }

    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json({ success: true, payoutMethod: portfolio.payoutMethod, payoutDetailsAdded: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/verify-payout — freelancer: create Razorpay Contact + Fund Account to validate UPI/bank
router.post('/verify-payout', auth, async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') return res.status(403).json({ message: 'Freelancers only' });
    const portfolio = await Portfolio.findOne({ user: req.user.id });
    if (!portfolio || !portfolio.payoutDetailsAdded) {
      return res.status(400).json({ message: 'Add payout details first' });
    }
    if (portfolio.payoutMethod === 'upi') {
      if (!portfolio.upiId || !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(portfolio.upiId)) {
        return res.status(400).json({ message: 'Invalid UPI ID format (e.g. name@upi)' });
      }
    } else if (portfolio.payoutMethod === 'bank') {
      if (!portfolio.bankAccountNumber || !portfolio.ifscCode || !portfolio.accountHolderName) {
        return res.status(400).json({ message: 'Bank details incomplete' });
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(portfolio.ifscCode)) {
        return res.status(400).json({ message: 'Invalid IFSC code (e.g. HDFC0001234)' });
      }
      if (portfolio.bankAccountNumber.length < 9 || portfolio.bankAccountNumber.length > 18) {
        return res.status(400).json({ message: 'Account number must be 9–18 digits' });
      }
    } else {
      return res.status(400).json({ message: 'Select a payout method first' });
    }

    const razorpay = razorpayClient();
    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    // Create or reuse Razorpay Contact via REST API (SDK 2.x lacks contacts resource)
    let contactId = portfolio.razorpayContactId;
    if (!contactId) {
      const { data: contact } = await axios.post(
        'https://api.razorpay.com/v1/contacts',
        { name: user.name, email: user.email, type: 'vendor', reference_id: req.user.id },
        { auth: rzpAuth() }
      );
      contactId = contact.id;
    }

    // Create Fund Account — Razorpay validates the UPI VPA or bank account here
    const faData = { contact_id: contactId };
    if (portfolio.payoutMethod === 'upi') {
      faData.account_type = 'vpa';
      faData.vpa = { address: portfolio.upiId };
    } else {
      faData.account_type = 'bank_account';
      faData.bank_account = {
        name: portfolio.accountHolderName,
        ifsc: portfolio.ifscCode,
        account_number: portfolio.bankAccountNumber
      };
    }
    const fundAccount = await razorpay.fundAccount.create(faData);

    const updated = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: { paymentVerified: true, razorpayContactId: contactId, razorpayFundAccountId: fundAccount.id } },
      { new: true }
    );
    const completion = calcCompletion('freelancer', updated.toObject());
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ paymentVerified: true, completionPercent: completion });
  } catch (err) {
    // Razorpay validation errors have a specific shape
    const msg = err?.error?.description || err?.message || 'Verification failed';
    res.status(400).json({ message: msg });
  }
});

// POST /api/portfolio/upload-sample
router.post('/upload-sample', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const buffer = req.file.buffer;
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileUrl = await uploadToImageKit(buffer, req.file.originalname, '/safelancer/samples');
    const sample = {
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      fileUrl,
      fileHash,
      uploadedAt: new Date()
    };
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $push: { projectSamples: sample } },
      { new: true }
    );
    // Recalculate completion after upload
    const completion = calcCompletion(portfolio.role, portfolio);
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ sample, portfolio, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/portfolio/upload-resume
router.post('/upload-resume', auth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const resumeUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/safelancer/resumes');
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user.id },
      { $set: { resumeUrl } },
      { new: true }
    );
    // Recalculate completion after resume upload
    const completion = calcCompletion(portfolio.role, portfolio);
    await Portfolio.findOneAndUpdate({ user: req.user.id }, { $set: { completionPercent: completion } });
    res.json({ resumeUrl, portfolio, completionPercent: completion });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
