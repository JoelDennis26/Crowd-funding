'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { sendMilestoneReachedEmail } = require('../services/emailService');
const Campaign = require('../models/Campaign');
const Milestone = require('../models/Milestone');
const User = require('../models/User');

const router = express.Router();

function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'Token is required' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = { userId: decoded.userId };
    next();
  });
}

router.post('/api/campaigns/:id/milestones', verifyToken, async (req, res) => {
  const campaignId = req.params.id;
  const { userId } = req.user;

  const { title, target_amount, description } = req.body;

  if (!title || title.trim().length === 0) {
    return res.status(400).json({ message: 'Milestone title is required' });
  }
  if (target_amount === undefined || target_amount === null || target_amount === '') {
    return res.status(400).json({ message: 'Milestone target_amount is required' });
  }

  try {
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    if (campaign.user_id.toString() !== userId) {
      return res.status(403).json({ message: 'You do not own this campaign' });
    }

    const count = await Milestone.countDocuments({ campaign_id: campaignId });
    if (count >= 5) {
      return res.status(409).json({ message: 'Maximum of 5 milestones allowed per campaign' });
    }

    const parsedAmount = parseFloat(target_amount);
    const milestone = new Milestone({
      campaign_id: campaignId,
      title: title.trim(),
      target_amount: parsedAmount,
      description: description ? description.trim() : null,
      status: campaign.raised >= parsedAmount ? 'reached' : 'pending'
    });

    await milestone.save();
    res.status(201).json({ message: 'Milestone created successfully', milestone });
  } catch (err) {
    console.error('[milestones] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/api/campaigns/:id/milestones', async (req, res) => {
  try {
    const milestones = await Milestone.find({ campaign_id: req.params.id }).sort({ target_amount: 1 });
    res.json(milestones);
  } catch (err) {
    console.error('[milestones] DB error fetching milestones:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/api/campaigns/:id/milestones/:mid', verifyToken, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const milestoneId = req.params.mid;
    const { userId } = req.user;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.user_id.toString() !== userId) return res.status(403).json({ message: 'You do not own this campaign' });

    const result = await Milestone.deleteOne({ _id: milestoneId, campaign_id: campaignId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Milestone not found or does not belong to this campaign' });
    }

    res.json({ message: 'Milestone deleted successfully' });
  } catch (err) {
    console.error('[milestones] DB error deleting milestone:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

async function checkAndSendMilestoneNotifications(campaignId, totalRaised) {
  try {
    const pendingMilestones = await Milestone.find({ campaign_id: campaignId, status: 'pending' });
    const reachedMilestones = pendingMilestones.filter(m => totalRaised >= m.target_amount);

    if (reachedMilestones.length === 0) return;

    const campaign = await Campaign.findById(campaignId).populate('user_id');
    if (!campaign || !campaign.user_id) return;

    for (const milestone of reachedMilestones) {
      milestone.status = 'reached';
      await milestone.save();

      sendMilestoneReachedEmail(
        { email: campaign.user_id.email, username: campaign.user_id.username, display_name: campaign.user_id.display_name },
        { id: campaign._id, title: campaign.title },
        milestone
      ).catch(e => console.error('[milestones] Email error:', e));
    }
  } catch (err) {
    console.error('[milestones] Error in checkAndSendMilestoneNotifications:', err);
  }
}

module.exports = router;
module.exports.checkAndSendMilestoneNotifications = checkAndSendMilestoneNotifications;
