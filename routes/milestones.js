'use strict';

/**
 * Milestone Routes — FundHive Platform
 *
 * Provides CRUD endpoints for campaign milestones and a helper function
 * that checks and updates milestone status after a verified donation.
 *
 * Routes:
 *   POST   /api/campaigns/:id/milestones        — add milestone (max 5, 409 if exceeded)
 *   GET    /api/campaigns/:id/milestones        — list milestones for a campaign
 *   DELETE /api/campaigns/:id/milestones/:mid   — delete a milestone (owner only)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { sendMilestoneReachedEmail } = require('../services/emailService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Auth middleware (reusable within this module)
// ---------------------------------------------------------------------------

/**
 * Verifies the JWT bearer token and attaches `req.user = { userId }`.
 */
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

// ---------------------------------------------------------------------------
// POST /api/campaigns/:id/milestones
// Add a milestone to a campaign (max 5 per campaign, 409 if exceeded)
// Requires auth and campaign ownership.
// ---------------------------------------------------------------------------

router.post('/api/campaigns/:id/milestones', verifyToken, (req, res) => {
  const campaignId = parseInt(req.params.id, 10);
  const { userId } = req.user;

  if (!campaignId || campaignId <= 0) {
    return res.status(400).json({ message: 'Invalid campaign ID' });
  }

  const { title, target_amount, description } = req.body;

  // Validate required fields
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ message: 'Milestone title is required' });
  }
  if (title.trim().length > 100) {
    return res.status(400).json({ message: 'Milestone title must be 100 characters or fewer' });
  }
  if (target_amount === undefined || target_amount === null || target_amount === '') {
    return res.status(400).json({ message: 'Milestone target_amount is required' });
  }
  const parsedAmount = parseFloat(target_amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ message: 'Milestone target_amount must be a non-negative number' });
  }
  if (description && description.length > 500) {
    return res.status(400).json({ message: 'Milestone description must be 500 characters or fewer' });
  }

  const db = req.app.get('db');

  // Verify campaign exists and belongs to the authenticated user
  db.query(
    'SELECT id, user_id FROM fundraisers WHERE id = ?',
    [campaignId],
    (err, campaigns) => {
      if (err) {
        console.error('[milestones] DB error fetching campaign:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (campaigns.length === 0) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      if (campaigns[0].user_id !== userId) {
        return res.status(403).json({ message: 'You do not own this campaign' });
      }

      // Count existing milestones for this campaign
      db.query(
        'SELECT COUNT(*) AS cnt FROM milestones WHERE fundraiser_id = ?',
        [campaignId],
        (err, countResult) => {
          if (err) {
            console.error('[milestones] DB error counting milestones:', err);
            return res.status(500).json({ message: 'Server error' });
          }

          const currentCount = countResult[0].cnt;
          if (currentCount >= 5) {
            // Requirement 6.2: reject the 6th milestone with 409
            return res.status(409).json({
              message: 'Maximum of 5 milestones per campaign has been reached',
            });
          }

          // Insert the new milestone
          const milestone = {
            fundraiser_id: campaignId,
            title: title.trim(),
            target_amount: parsedAmount,
            description: description ? description.trim() : null,
            status: 'pending',
          };

          db.query('INSERT INTO milestones SET ?', milestone, (err, result) => {
            if (err) {
              console.error('[milestones] DB error inserting milestone:', err);
              return res.status(500).json({ message: 'Server error' });
            }
            return res.status(201).json({
              message: 'Milestone created successfully',
              milestone: {
                id: result.insertId,
                ...milestone,
              },
            });
          });
        }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:id/milestones
// List all milestones for a campaign (public).
// ---------------------------------------------------------------------------

router.get('/api/campaigns/:id/milestones', (req, res) => {
  const campaignId = parseInt(req.params.id, 10);

  if (!campaignId || campaignId <= 0) {
    return res.status(400).json({ message: 'Invalid campaign ID' });
  }

  const db = req.app.get('db');

  // Verify campaign exists
  db.query(
    'SELECT id FROM fundraisers WHERE id = ?',
    [campaignId],
    (err, campaigns) => {
      if (err) {
        console.error('[milestones] DB error fetching campaign:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (campaigns.length === 0) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      db.query(
        'SELECT id, fundraiser_id, title, target_amount, description, status, created_at FROM milestones WHERE fundraiser_id = ? ORDER BY target_amount ASC, created_at ASC',
        [campaignId],
        (err, milestones) => {
          if (err) {
            console.error('[milestones] DB error listing milestones:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          return res.json(milestones);
        }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// DELETE /api/campaigns/:id/milestones/:mid
// Delete a milestone (campaign owner only).
// ---------------------------------------------------------------------------

router.delete('/api/campaigns/:id/milestones/:mid', verifyToken, (req, res) => {
  const campaignId = parseInt(req.params.id, 10);
  const milestoneId = parseInt(req.params.mid, 10);
  const { userId } = req.user;

  if (!campaignId || campaignId <= 0) {
    return res.status(400).json({ message: 'Invalid campaign ID' });
  }
  if (!milestoneId || milestoneId <= 0) {
    return res.status(400).json({ message: 'Invalid milestone ID' });
  }

  const db = req.app.get('db');

  // Verify campaign exists and belongs to the authenticated user
  db.query(
    'SELECT id, user_id FROM fundraisers WHERE id = ?',
    [campaignId],
    (err, campaigns) => {
      if (err) {
        console.error('[milestones] DB error fetching campaign:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (campaigns.length === 0) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      if (campaigns[0].user_id !== userId) {
        return res.status(403).json({ message: 'You do not own this campaign' });
      }

      // Verify milestone exists and belongs to this campaign
      db.query(
        'SELECT id FROM milestones WHERE id = ? AND fundraiser_id = ?',
        [milestoneId, campaignId],
        (err, milestones) => {
          if (err) {
            console.error('[milestones] DB error fetching milestone:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          if (milestones.length === 0) {
            return res.status(404).json({ message: 'Milestone not found' });
          }

          db.query(
            'DELETE FROM milestones WHERE id = ?',
            [milestoneId],
            (err) => {
              if (err) {
                console.error('[milestones] DB error deleting milestone:', err);
                return res.status(500).json({ message: 'Server error' });
              }
              return res.json({ message: 'Milestone deleted successfully' });
            }
          );
        }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// checkAndUpdateMilestones — exported helper
//
// Called from the payments route after a verified donation is recorded.
// Queries all pending milestones for the given fundraiser, checks whether
// the campaign's current `raised` amount meets each milestone's target,
// marks qualifying milestones as `reached`, and fires
// `sendMilestoneReachedEmail` for each one.
//
// @param {number} fundraiserId  — The campaign (fundraiser) ID
// @param {object} db            — The mysql connection object
// @returns {Promise<void>}
// ---------------------------------------------------------------------------

async function checkAndUpdateMilestones(fundraiserId, db) {
  return new Promise((resolve) => {
    // Fetch the campaign's current raised amount and creator info
    db.query(
      `SELECT f.id, f.raised, f.title AS campaign_title,
              u.id AS creator_id, u.email AS creator_email,
              u.username AS creator_username, u.display_name AS creator_display_name
       FROM fundraisers f
       JOIN users u ON u.id = f.user_id
       WHERE f.id = ?`,
      [fundraiserId],
      (err, campaigns) => {
        if (err) {
          console.error('[milestones] checkAndUpdateMilestones — DB error fetching campaign:', err);
          return resolve();
        }
        if (campaigns.length === 0) {
          return resolve();
        }

        const campaign = campaigns[0];
        const raised = parseFloat(campaign.raised) || 0;

        // Fetch all pending milestones for this campaign
        db.query(
          'SELECT id, title, target_amount FROM milestones WHERE fundraiser_id = ? AND status = ?',
          [fundraiserId, 'pending'],
          (err, pendingMilestones) => {
            if (err) {
              console.error('[milestones] checkAndUpdateMilestones — DB error fetching milestones:', err);
              return resolve();
            }
            if (pendingMilestones.length === 0) {
              return resolve();
            }

            // Determine which milestones have been reached
            const reachedMilestones = pendingMilestones.filter(
              (m) => raised >= parseFloat(m.target_amount)
            );

            if (reachedMilestones.length === 0) {
              return resolve();
            }

            const reachedIds = reachedMilestones.map((m) => m.id);

            // Mark reached milestones in the database
            db.query(
              'UPDATE milestones SET status = ? WHERE id IN (?)',
              ['reached', reachedIds],
              (err) => {
                if (err) {
                  console.error('[milestones] checkAndUpdateMilestones — DB error updating milestones:', err);
                  return resolve();
                }

                // Fire milestone reached emails (fire-and-forget)
                const creator = {
                  email: campaign.creator_email,
                  username: campaign.creator_username,
                  display_name: campaign.creator_display_name,
                };
                const campaignInfo = {
                  id: campaign.id,
                  title: campaign.campaign_title,
                };

                reachedMilestones.forEach((milestone) => {
                  sendMilestoneReachedEmail(creator, campaignInfo, {
                    title: milestone.title,
                    target_amount: parseFloat(milestone.target_amount),
                  }).catch((emailErr) => {
                    console.error(
                      '[milestones] checkAndUpdateMilestones — email error for milestone',
                      milestone.id,
                      ':',
                      emailErr.message
                    );
                  });
                });

                return resolve();
              }
            );
          }
        );
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = router;
module.exports.checkAndUpdateMilestones = checkAndUpdateMilestones;
