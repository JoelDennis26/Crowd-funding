const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  title: { type: String, required: true },
  target_amount: { type: Number, required: true },
  status: { type: String, default: 'pending' }, // 'pending', 'reached'
  created_at: { type: Date, default: Date.now }
});

// Configure JSON serialization to map _id to id
milestoneSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Milestone', milestoneSchema);
