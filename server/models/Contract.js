const mongoose = require('mongoose');
const crypto = require('crypto');

const contractSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  negotiation: { type: mongoose.Schema.Types.ObjectId, ref: 'Negotiation' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  scope: String,
  timeline: Number,
  milestoneCount: { type: Number, enum: [3, 5], default: 3 },
  hashId: { type: String, unique: true },
  status: { type: String, enum: ['active', 'completed', 'withdrawn', 'disputed'], default: 'active' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  withdrawnAt: Date
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
