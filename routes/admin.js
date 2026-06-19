'use strict';

const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const User = require('../models/User');

const {
  sendCampaignApprovalEmail,
  sendCampaignRejectionEmail,
} = require('../services/emailService');

function isAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}

function createAdminRouter(verifyToken) {
  
  router.get('/campaigns/pending', verifyToken, isAdmin, async (req, res) => {
    try {
      const campaigns = await Campaign.find({ status: { $in: ['pending', 'draft'] } })
        .populate('user_id', 'username email display_name')
        .sort({ created_at: 1 });

      // Map to backward-compatible format
      const formattedCampaigns = campaigns.map(f => ({
        id: f._id,
        title: f.title,
        description: f.description,
        goal: f.goal,
        category: f.category,
        image_path: f.image_path,
        verification_status: f.status,
        status: f.status,
        created_at: f.created_at,
        creator_id: f.user_id ? f.user_id._id : null,
        creator_username: f.user_id ? f.user_id.username : null,
        creator_email: f.user_id ? f.user_id.email : null,
        creator_display_name: f.user_id ? (f.user_id.display_name || f.user_id.username) : null
      }));

      res.json({ campaigns: formattedCampaigns });
    } catch (err) {
      console.error('[admin] Error fetching pending campaigns:', err);
      res.status(500).json({ message: 'Server error fetching pending campaigns.' });
    }
  });

  router.patch('/campaigns/:id/verify', verifyToken, isAdmin, async (req, res) => {
    const campaignId = req.params.id;
    const { action, reason } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Valid action (approve or reject) is required.' });
    }

    try {
      const campaign = await Campaign.findById(campaignId).populate('user_id', 'username email display_name');

      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found.' });
      }

      if (campaign.status !== 'pending' && campaign.status !== 'draft') {
        return res.status(400).json({
          message: `Campaign has already been processed (current status: ${campaign.status}).`,
        });
      }

      const newStatus = action === 'approve' ? 'active' : 'rejected'; // active instead of approved because frontend uses active
      campaign.status = newStatus;
      await campaign.save();

      res.json({
        message: `Campaign has been ${newStatus}.`,
        campaign: {
          id: campaign._id,
          status: campaign.status,
        },
      });

      // Fire-and-forget emails
      if (campaign.user_id && campaign.user_id.email) {
        if (action === 'approve') {
          sendCampaignApprovalEmail(campaign.user_id, {
            id: campaign._id,
            title: campaign.title,
          }).catch((e) => console.error('[admin] Failed to send approval email:', e));
        } else if (action === 'reject') {
          sendCampaignRejectionEmail(
            campaign.user_id,
            { id: campaign._id, title: campaign.title },
            reason
          ).catch((e) => console.error('[admin] Failed to send rejection email:', e));
        }
      }

    } catch (err) {
      console.error('[admin] Error processing verification:', err);
      res.status(500).json({ message: 'Server error while verifying campaign.' });
    }
  });

  return router;
}

module.exports = createAdminRouter;
