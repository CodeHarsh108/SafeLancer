const mongoose = require('mongoose');

const demoRequestSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  proposedAt: Date,
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed', 'expired'], default: 'pending' },
  meetingRoomId: String,
  meetingAt: Date,
  rejectionReason: String,
  convertedToJob: { type: Boolean, default: false },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }
}, { timestamps: true });

module.exports = mongoose.model('DemoRequest', demoRequestSchema);
