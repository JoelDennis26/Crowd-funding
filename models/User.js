const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  is_admin: { type: Boolean, default: false },
  is_verified: { type: Boolean, default: false },
  verification_token: { type: String, default: null },
  verification_token_expires: { type: Date, default: null },
  reset_token: { type: String, default: null },
  reset_token_expiry: { type: Date, default: null },
  tier: { type: String, default: 'Bronze' },
  created_at: { type: Date, default: Date.now }
});

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('User', userSchema);
