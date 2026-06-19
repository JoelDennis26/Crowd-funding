'use strict';

/**
 * Admin Routes — FundHive Platform
 *
 * Provides campaign verification endpoints for admin users.
 *
 * Endpoints:
 *   GET  /api/admin/campaigns/pending   — list campaigns with verification_status = 'pending'
 *   PATCH /api/admin/campaigns/:id/verify — approve or reject a pending campaign
 *
 * All routes require:
 *   1. A valid JWT (verifyToken middleware from server.js)
 *   2. The authenticated user to have is_admin = 1 (isAdmin middleware defined here)
 *
 * Requirements: 3.3, 3.4, 3.6, 3.7
 */

const express = require('express');
const router = express.Router();

const {
  sendCampaignApprovalEmail,
  sendCampaignRejectionEmail,
} = require('../services/emailService');

// ---------------------------------------------------------------------------
// isAdmin middleware
// ---------------------------------------------------------------------------

/**
 * Middleware that checks whether the authenticated user is an admin.
 * Must be used AFTER verifyToken so that req.user is already populated.
 *
 * req.user is set by verifyToken as { userId, is_admin } — see server.js.
 * We accept both numeric 1 and boolean true for is_admin.
 */
function isAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Route factory — receives the shared `db` connection from server.js
// ---------------------------------------------------------------------------

/**
 * Attaches all admin routes to the router using the provided db connection.
 * Call this once from server.js:
 *
 *   const adminRouter = require('./routes/admin')(db, verifyToken);
 *   app.use('/api/admin', adminRouter);
 *
 * @param {import('mysql').Connection} db
 * @param {Function} verifyToken  — JWT middleware from server.js
 * @returns {express.Router}
 */
function createAdminRouter(db, verifyToken) {
  // -------------------------------------------------------------------------
  // GET /api/admin/campaigns/pending
  // -------------------------------------------------------------------------

  /**
   * Returns all campaigns whose verification_status is 'pending'.
   * Includes basic campaign info and the creator's email/username for
   * subsequent email notifications.
   *
   * Requirement 3.6 — admin can view campaigns awaiting review.
   */
  router.get('/campaigns/pending', verifyToken, isAdmin, (req, res) => {
    const sql = `
      SELECT
        f.id,
        f.title,
        f.description,
        f.goal,
        f.category,
        f.image_path,
        f.verification_status,
        f.status,
        f.created_at,
        u.id        AS creator_id,
        u.username  AS creator_username,
        u.email     AS creator_email,
        u.display_name AS creator_display_name
      FROM fundraisers f
      JOIN users u ON u.id = f.user_id
      WHERE f.verification_status = 'pending'
      ORDER BY f.created_at ASC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        console.error('[admin] Error fetching pending campaigns:', err);
        return res.status(500).json({ message: 'Server error fetching pending campaigns.' });
      }
      res.json({ campaigns: results });
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/admin/campaigns/:id/verify
  // -------------------------------------------------------------------------

  /**
   * Approves or rejects a campaign that is currently in 'pending' state.
   *
   * Request body:
   *   { action: 'approve' | 'reject', reason?: string }
   *
   * - approve: sets verification_status = 'verified', status = 'active'
   * - reject:  sets verification_status = 'rejected', stores rejection_reason
   *            (reason is required for rejection)
   *
   * In both cases the creator is notified by email (fire-and-forget).
   *
   * Requirements:
   *   3.3 — approve sets verified + active, email sent within 5 min
   *   3.4 — reject stores reason, email sent within 5 min
   *   3.6 — success response on valid pending campaign
   *   3.7 — error if campaign is not in 'pending' state
   */
  router.patch('/campaigns/:id/verify', verifyToken, isAdmin, (req, res) => {
    const campaignId = parseInt(req.params.id, 10);

    if (!Number.isFinite(campaignId) || campaignId <= 0) {
      return res.status(400).json({ message: 'Invalid campaign ID.' });
    }

    const { action, reason } = req.body;

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ message: 'action must be "approve" or "reject".' });
    }

    if (action === 'reject' && (!reason || !reason.trim())) {
      return res.status(400).json({ message: 'A rejection reason is required.' });
    }

    // Step 1 — fetch the campaign and its creator
    const fetchSql = `
      SELECT
        f.id,
        f.title,
        f.verification_status,
        u.id           AS creator_id,
        u.username     AS creator_username,
        u.email        AS creator_email,
        u.display_name AS creator_display_name
      FROM fundraisers f
      JOIN users u ON u.id = f.user_id
      WHERE f.id = ?
    `;

    db.query(fetchSql, [campaignId], (err, rows) => {
      if (err) {
        console.error('[admin] Error fetching campaign for verification:', err);
        return res.status(500).json({ message: 'Server error.' });
      }

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Campaign not found.' });
      }

      const campaign = rows[0];

      // Requirement 3.7 — reject if not pending
      if (campaign.verification_status !== 'pending') {
        return res.status(409).json({
          message: 'Campaign is not in a reviewable state. Only pending campaigns can be approved or rejected.',
        });
      }

      // Step 2 — apply the status update
      let updateSql;
      let updateParams;

      if (action === 'approve') {
        // Requirement 3.3
        updateSql = `
          UPDATE fundraisers
          SET verification_status = 'verified',
              status = 'active'
          WHERE id = ?
        `;
        updateParams = [campaignId];
      } else {
        // action === 'reject' — Requirement 3.4
        updateSql = `
          UPDATE fundraisers
          SET verification_status = 'rejected',
              rejection_reason = ?
          WHERE id = ?
        `;
        updateParams = [reason.trim(), campaignId];
      }

      db.query(updateSql, updateParams, (updateErr) => {
        if (updateErr) {
          console.error('[admin] Error updating campaign verification status:', updateErr);
          return res.status(500).json({ message: 'Server error updating campaign status.' });
        }

        // Step 3 — send notification email (fire-and-forget)
        const creator = {
          email: campaign.creator_email,
          username: campaign.creator_username,
          display_name: campaign.creator_display_name,
        };
        const campaignInfo = { id: campaign.id, title: campaign.title };

        if (action === 'approve') {
          sendCampaignApprovalEmail(creator, campaignInfo).catch((emailErr) => {
            console.error('[admin] Failed to send approval email:', emailErr.message);
          });
        } else {
          sendCampaignRejectionEmail(creator, campaignInfo, reason.trim()).catch((emailErr) => {
            console.error('[admin] Failed to send rejection email:', emailErr.message);
          });
        }

        // Step 4 — respond with success
        const newStatus = action === 'approve' ? 'verified' : 'rejected';
        res.json({
          message: `Campaign ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
          campaignId,
          verification_status: newStatus,
        });
      });
    });
  });

  return router;
}

module.exports = createAdminRouter;
