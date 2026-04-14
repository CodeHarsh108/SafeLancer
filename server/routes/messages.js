const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middleware/auth');

// GET /api/messages/:contractId — last 100 messages
router.get('/:contractId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ contract: req.params.contractId })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/messages/mark-read/:contractId
router.post('/mark-read/:contractId', auth, async (req, res) => {
  try {
    await Message.updateMany(
      { contract: req.params.contractId, readBy: { $ne: req.user.id } },
      { $push: { readBy: req.user.id } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
