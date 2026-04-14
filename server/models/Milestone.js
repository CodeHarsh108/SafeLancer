const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  milestoneNumber: { type: Number, required: true },
  isAdvance: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true },
  deadline: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending_deposit', 'funded', 'in_progress', 'submitted', 'review', 'approved', 'inaccurate_1', 'inaccurate_2', 'disputed', 'released', 'refunded'],
    default: 'pending_deposit'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  submittedAt: Date,
  submissionNote: String,
  submissionFileUrl: String,
  submissionFileHash: String,
  reviewNote: String,
  inaccuracyNote: String,
  inaccuracyCount: { type: Number, default: 0 },
  originalDeadline: Date,
  deadlineExtendedAt: Date,
  extensionReason: String,
  autoReleaseAt: Date,
  releasedAt: Date,
  meetingScheduledAt: Date,
  meetingRoomId: String,
  meetingStatus: { type: String, enum: ['not_scheduled', 'scheduled', 'completed'], default: 'not_scheduled' }
}, { timestamps: true });

module.exports = mongoose.model('Milestone', milestoneSchema);
