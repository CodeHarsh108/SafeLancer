const Milestone = require('../models/Milestone');
const Contract = require('../models/Contract');
const Job = require('../models/Job');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { milestoneTransition } = require('./stateMachine');
const isTestMode = require('../utils/isTestMode');

async function recordTransaction(milestone, amount, type, payoutId = '') {
  try {
    const tx = await Transaction.create({
      freelancer: milestone.freelancer,
      contract: milestone.contract,
      milestone: milestone._id,
      amount,
      type,
      status: 'completed',
      description: milestone.title,
      payoutId,
    });
    // Credit wallet balance
    await User.findByIdAndUpdate(milestone.freelancer, { $inc: { walletBalance: amount } });
    return tx;
  } catch (err) {
    console.error('Failed to record transaction for milestone', milestone._id, ':', err.message);
  }
}

async function initiateFreelancerPayout(milestone, overrideAmount, overrideType) {
  const amount = overrideAmount != null ? overrideAmount : milestone.amount;
  const type = overrideType || (milestone.isAdvance ? 'advance_payment' : 'phase_payment');

  try {
    const Portfolio = require('../models/Portfolio');
    const freelancerPortfolio = await Portfolio.findOne({ user: milestone.freelancer });

    if (isTestMode()) {
      const payoutId = 'payout_test_' + Date.now();
      await Milestone.findByIdAndUpdate(milestone._id, {
        payoutId,
        payoutStatus: 'processed',
        payoutInitiatedAt: new Date()
      });
      await recordTransaction(milestone, amount, type, payoutId);
      return;
    }

    if (!freelancerPortfolio?.payoutDetailsAdded) {
      await Milestone.findByIdAndUpdate(milestone._id, { payoutStatus: 'pending', payoutInitiatedAt: new Date() });
      // Still record the transaction and credit the wallet — bank transfer is pending setup
      await recordTransaction(milestone, amount, type);
      return;
    }

    const Razorpay = require('razorpay');
    const axios = require('axios');
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const freelancer = await User.findById(milestone.freelancer);

    let contactId = freelancerPortfolio.razorpayContactId;
    if (!contactId) {
      const { data: contact } = await axios.post(
        'https://api.razorpay.com/v1/contacts',
        { name: freelancer?.name || 'Freelancer', email: freelancer?.email || '', type: 'vendor', reference_id: milestone.freelancer.toString() },
        { auth: { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET } }
      );
      contactId = contact.id;
      await Portfolio.findOneAndUpdate({ user: milestone.freelancer }, { razorpayContactId: contactId });
    }

    let fundAccountId = freelancerPortfolio.razorpayFundAccountId;
    if (!fundAccountId) {
      const faData = { contact_id: contactId };
      if (freelancerPortfolio.payoutMethod === 'upi') {
        faData.account_type = 'vpa';
        faData.vpa = { address: freelancerPortfolio.upiId };
      } else {
        faData.account_type = 'bank_account';
        faData.bank_account = {
          name: freelancerPortfolio.accountHolderName,
          ifsc: freelancerPortfolio.ifscCode,
          account_number: freelancerPortfolio.bankAccountNumber
        };
      }
      const fa = await razorpay.fundAccount.create(faData);
      fundAccountId = fa.id;
      await Portfolio.findOneAndUpdate({ user: milestone.freelancer }, { razorpayFundAccountId: fundAccountId });
    }

    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id: fundAccountId,
      amount: Math.round(amount * 100),
      currency: 'INR',
      mode: freelancerPortfolio.payoutMethod === 'upi' ? 'UPI' : 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: milestone._id.toString(),
      narration: `SafeLancer - ${milestone.title}`
    });

    await Milestone.findByIdAndUpdate(milestone._id, {
      payoutId: payout.id,
      payoutStatus: 'processing',
      payoutInitiatedAt: new Date()
    });
    await recordTransaction(milestone, amount, type, payout.id);
  } catch (err) {
    console.error('Payout initiation failed for milestone', milestone._id, ':', err.message);
    await Milestone.findByIdAndUpdate(milestone._id, { payoutStatus: 'failed' });
  }
}

async function checkAndCompleteContract(contractId) {
  const allMilestones = await Milestone.find({ contract: contractId });
  const nonAdvance = allMilestones.filter(m => !m.isAdvance);
  if (!nonAdvance.every(m => ['released', 'refunded'].includes(m.status))) return;

  // Release advance if still held
  const advance = allMilestones.find(m => m.isAdvance && !['released', 'refunded'].includes(m.status));
  if (advance) {
    await milestoneTransition(advance._id, 'released');
    await initiateFreelancerPayout(advance);
  }

  const Portfolio = require('../models/Portfolio');

  const contract = await Contract.findByIdAndUpdate(contractId, { status: 'completed', completedAt: new Date() }, { new: true });
  if (!contract) return;

  await Job.findByIdAndUpdate(contract.job, { status: 'completed' });

  const clientPortfolio = await Portfolio.findOne({ user: contract.client });
  if (clientPortfolio) {
    const newCompleted = (clientPortfolio.projectsCompleted || 0) + 1;
    const oldAvg = clientPortfolio.avgBudget || 0;
    const newAvg = Math.round((oldAvg * (newCompleted - 1) + contract.amount) / newCompleted);
    await Portfolio.findOneAndUpdate({ user: contract.client }, { projectsCompleted: newCompleted, avgBudget: newAvg });
  }

  const freshMilestones = await Milestone.find({ contract: contract._id });
  const phases = freshMilestones.filter(m => !m.isAdvance);
  const onTimeCount = phases.filter(m => m.submittedAt && m.deadline && new Date(m.submittedAt) <= new Date(m.deadline)).length;
  const contractRate = phases.length > 0 ? Math.round((onTimeCount / phases.length) * 100) : 100;

  const completedContracts = await Contract.find({ freelancer: contract.freelancer, status: 'completed', _id: { $ne: contract._id } });
  const freelancer = await User.findById(contract.freelancer);
  if (freelancer) {
    const prevCount = completedContracts.length;
    const prevRate = freelancer.onTimeDeliveryRate || 100;
    const newRate = prevCount > 0 ? Math.round((prevRate * prevCount + contractRate) / (prevCount + 1)) : contractRate;
    await User.findByIdAndUpdate(contract.freelancer, { onTimeDeliveryRate: newRate, $inc: { totalJobsCompleted: 1 } });
  }
}

// Release a phase milestone: transition → payout → record transaction → check project completion
async function performRelease(milestone) {
  const updated = await milestoneTransition(milestone._id, 'released');
  await initiateFreelancerPayout(milestone);
  await checkAndCompleteContract(milestone.contract);
  return updated;
}

// Dispute split: release the milestone, payout only the freelancer's share
async function performSplitRelease(milestone, freelancerAmount) {
  const updated = await milestoneTransition(milestone._id, 'released');
  // Reuse initiateFreelancerPayout with split amount and type — handles both test and live mode
  await initiateFreelancerPayout(milestone, freelancerAmount, 'split_payment');
  await checkAndCompleteContract(milestone.contract);
  return updated;
}

// Mark a phase as refunded and check if project is now complete
async function performRefund(milestone) {
  await milestoneTransition(milestone._id, 'refunded');
  await checkAndCompleteContract(milestone.contract);
}

module.exports = { performRelease, performSplitRelease, performRefund, initiateFreelancerPayout };
