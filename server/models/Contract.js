const mongoose = require('mongoose');
const crypto = require('crypto');

const contractSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  scope: String,
  timeline: Number,
  milestoneCount:  { type: Number, default: 3 },
  advancePercent:  { type: Number, default: 10 },
  hashId: { type: String, unique: true },
  status: { type: String, enum: ['pending_advance', 'active', 'completed', 'withdrawn', 'disputed'], default: 'pending_advance' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  withdrawnAt: Date,
  withdrawnBy: { type: String, enum: ['client', 'freelancer', null], default: null }
}, { timestamps: true });

contractSchema.pre('save', function(next) {
  if (!this.hashId) {
    this.hashId = crypto
      .createHash('sha256')
      .update(this._id.toString() + Date.now().toString())
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Contract', contractSchema);
