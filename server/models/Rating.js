const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
  milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
  ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ratedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['client_rating_freelancer', 'freelancer_rating_client'] },
  stars: { type: Number, min: 1, max: 5, required: true },
  review: { type: String, maxlength: 500, default: '' },
  communication: { type: Number, min: 1, max: 5 },
  quality: { type: Number, min: 1, max: 5 },
  timeliness: { type: Number, min: 1, max: 5 },
  professionalism: { type: Number, min: 1, max: 5 },
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Rating', ratingSchema);
