const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const auth = require('../middleware/auth');
const { calcCompletion } = require('../utils/profileCompletion');

const FRONTEND_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.SERVER_URL || 'http://localhost:5001';

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
  },
  (accessToken, refreshToken, profile, done) => done(null, profile)
));

// GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google_failed` }),
  async (req, res) => {
    try {
      const profile = req.user;
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const googleId = profile.id;

      let user = await User.findOne({ $or: [{ googleId }, { email }] });

      if (user) {
        if (!user.googleId) { user.googleId = googleId; await user.save(); }
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const userParam = encodeURIComponent(JSON.stringify({ id: user._id, name: user.name, email: user.email, role: user.role, rating: user.rating || 0 }));
        return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&user=${userParam}`);
      }

      // New Google user — issue a short-lived pending token, redirect to role picker
      const pending = jwt.sign({ googleId, email, name }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.redirect(`${FRONTEND_URL}/auth/google/complete?pending=${encodeURIComponent(pending)}`);
    } catch (err) {
      console.error('Google callback error:', err.message);
      res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
    }
  }
);

// POST /api/auth/google/complete — new Google users select their role
router.post('/google/complete', async (req, res) => {
  try {
    const { pendingToken, role } = req.body;
    if (!['client', 'freelancer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be client or freelancer' });
    }
    const decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    const { googleId, email, name } = decoded;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = new User({ name, email, googleId, role, password: crypto.randomBytes(32).toString('hex') });
      await user.save();
      await Portfolio.create({ user: user._id, role });
    }

    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(400).json({ message: 'Session expired. Please try signing in again.' });
  }
});

// Strong password: min 8 chars, must have uppercase, lowercase, number, special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (!['client', 'freelancer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be client or freelancer' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character (@$!%*?&_#^()-+=)'
      });
    }

    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) return res.status(400).json({ message: 'An account with this email already exists' });

    const user = new User({ name: trimmedName, email: trimmedEmail, password, role });
    await user.save();

    await Portfolio.create({ user: user._id, role });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    // Check account lock
    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
      });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      await user.incrementLoginAttempts();
      const attemptsLeft = Math.max(0, 5 - (user.loginAttempts + 1));
      if (attemptsLeft === 0) {
        return res.status(423).json({ message: 'Account locked for 15 minutes due to too many failed attempts.' });
      }
      return res.status(400).json({
        message: `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before account lockout.`
      });
    }

    // Reset failed attempts on successful login
    if (user.loginAttempts > 0) {
      await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, rating: user.rating }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const portfolio = await Portfolio.findOne({ user: req.user.id });

    if (portfolio) {
      // Always recalculate completion from actual field values — never trust the stored value
      const freshPct = calcCompletion(portfolio.role, portfolio);
      if (freshPct !== portfolio.completionPercent) {
        portfolio.completionPercent = freshPct;
        await Portfolio.findByIdAndUpdate(portfolio._id, { $set: { completionPercent: freshPct } });
      }
    }

    res.json({ user, portfolio });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
