const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional, can be anonymous
  amount: { type: Number, required: true },
  name: { type: String },
  email: { type: String },
  message: { type: String },
  status: { type: String, default: 'pending' }, // 'pending', 'completed', 'failed'
  razorpay_order_id: { type: String },
  razorpay_payment_id: { type: String },
  created_at: { type: Date, default: Date.now }
});

// Configure JSON serialization to map _id to id
donationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Donation', donationSchema);
