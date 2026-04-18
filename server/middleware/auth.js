const jwt = require('jsonwebtoken');

const SKIP_BAN_PATHS = ['/api/auth/pay-penalty', '/api/auth/me', '/api/auth/login', '/api/auth/register'];

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Check ban for state-changing requests (skip for admin and specific paths)
    const isStateChange = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method);
    const isSkipPath = SKIP_BAN_PATHS.some(p => req.originalUrl.includes(p));
    if (isStateChange && !isSkipPath && decoded.role !== 'admin') {
      const User = require('../models/User');
      const user = await User.findById(decoded.id).select('isBanned banReason penaltyDue');
      if (user?.isBanned) {
        return res.status(403).json({
          message: 'Account banned',
          banned: true,
          reason: user.banReason || 'Policy violation',
          penaltyDue: user.penaltyDue || 0
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = auth;
