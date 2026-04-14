const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  roundNumber: Number,
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  proposedByRole: { type: String, enum: ['client', 'freelancer'] },
  amount: Number,
  timeline: Number,
  scope: String,
  milestoneCount: { type: Number, enum: [3, 5] },
  message: String,
  status: { type: String, enum: ['pending', 'accepted', 'countered', 'rejected'], default: 'pending' },
  respondedAt: Date
}, { timestamps: true });

const negotiationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'agreed', 'rejected', 'expired'], default: 'active' },
  rounds: [roundSchema],
  maxRounds: { type: Number, default: 4 },
  currentRound: { type: Number, default: 1 },
  agreedAmount: Number,
  agreedTimeline: Number,
  agreedScope: String,
  agreedMilestoneCount: Number,
  agreedAt: Date,
  expiresAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Negotiation', negotiationSchema);
