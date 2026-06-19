const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  goal: { type: Number, required: true },
  raised: { type: Number, default: 0 },
  category: { type: String, required: true },
  image_path: { type: String },
  status: { type: String, default: 'pending' }, // 'pending', 'approved', 'rejected'
  created_at: { type: Date, default: Date.now }
});

// Configure JSON serialization to map _id to id
campaignSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Campaign', campaignSchema);
