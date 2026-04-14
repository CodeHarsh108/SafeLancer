const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: String,
  senderRole: { type: String, enum: ['client', 'freelancer', 'admin'] },
  text: String,
  type: { type: String, enum: ['text', 'system', 'meeting_request', 'file'], default: 'text' },
  meetingData: {
    scheduledAt: Date,
    agenda: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'done'], default: 'pending' }
  },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
