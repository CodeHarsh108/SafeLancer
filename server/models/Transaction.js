const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
  milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
  amount: { type: Number, required: true },
  type: {
    type: String,
    enum: ['phase_payment', 'advance_payment', 'dispute_release', 'split_payment', 'auto_release', 'withdrawal_penalty', 'withdrawal_advance', 'withdrawal_phase'],
    required: true
  },
  status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  description: { type: String, default: '' },
  payoutId: { type: String, default: '' },
}, { timestamps: true });

transactionSchema.index({ freelancer: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
