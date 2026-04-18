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
  maxRevisions: { type: Number, default: 2 },
  originalDeadline: Date,
  deadlineExtensions: [{
    extendedAt: { type: Date, default: Date.now },
    newDeadline: Date,
    reason: String,
    extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  deadlineExtendedAt: Date,
  extensionReason: String,
  submissionVideoUrl: String,
  submissionVideoHash: String,
  paymentDueAt: Date,
  clientPaymentPenaltyApplied: { type: Boolean, default: false },
  submissionPenaltyApplied: { type: Boolean, default: false },
  autoReleaseAt: Date,
  releasedAt: Date,
  meetingScheduledAt: Date,
  meetingRoomId: String,
  meetingStatus: { type: String, enum: ['not_scheduled', 'scheduled', 'completed'], default: 'not_scheduled' },
  payoutId:           { type: String, default: '' },
  payoutStatus:       { type: String, enum: ['pending', 'processing', 'processed', 'failed', ''], default: '' },
  payoutInitiatedAt:  Date,
  clientFee:          { type: Number, default: 0 },
  freelancerFee:      { type: Number, default: 0 },
  platformFee:        { type: Number, default: 0 },
  clientTotal:        { type: Number, default: 0 },
  freelancerPayout:   { type: Number, default: 0 }
}, { timestamps: true });

milestoneSchema.index({ contract: 1, isAdvance: 1 });
milestoneSchema.index({ contract: 1, milestoneNumber: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);
