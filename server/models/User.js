const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['client', 'freelancer', 'admin'], required: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalJobsCompleted: { type: Number, default: 0 },
  onTimeDeliveryRate: { type: Number, default: 0 },
  onTimePaymentRate: { type: Number, default: 0 },
  disputeRate: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
