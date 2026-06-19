'use strict';

/**
 * Payment Routes — FundHive Platform
 *
 * Handles Razorpay order creation, payment signature verification,
 * donation recording, and refund initiation.
 *
 * Endpoints:
 *   POST /api/payments/create-order  — Create a Razorpay order (JWT required)
 *   POST /api/payments/verify        — Verify payment signature and record donation (JWT required)
 *   POST /api/payments/refund        — Initiate a Razorpay refund (Admin JWT required)
 *
 * Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.7
 */

const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const jwt = require('jsonwebtoken');

const { sendDonationReceiptEmail } = require('../services/emailService');
const { updateDonorBadge } = require('../services/badgeService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Razorpay client — initialised once from env vars
// ---------------------------------------------------------------------------

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ---------------------------------------------------------------------------
// Middleware helpers
// ---------------------------------------------------------------------------

/**
 * Verifies the JWT from the Authorization header and attaches `req.user`.
 * Returns 403 if the token is missing or invalid.
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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

/**
 * Extends `verifyToken` to also require `is_admin = 1` on the user record.
 * Requires `req.db` to be set (injected via router-level middleware below).
 */
function verifyAdmin(req, res, next) {
    verifyToken(req, res, () => {
        req.db.query(
            'SELECT is_admin FROM users WHERE id = ?',
            [req.user.userId],
            (err, results) => {
                if (err || results.length === 0) {
                    return res.status(500).json({ message: 'Server error' });
                }
                if (!results[0].is_admin) {
                    return res.status(403).json({ message: 'Admin access required' });
                }
                next();
            }
        );
    });
}

// ---------------------------------------------------------------------------
// Amount validation constants (INR)
// ---------------------------------------------------------------------------

const MIN_AMOUNT_INR = 10;
const MAX_AMOUNT_INR = 500000;

// ---------------------------------------------------------------------------
// POST /api/payments/create-order
// ---------------------------------------------------------------------------

/**
 * Creates a Razorpay order for the given INR amount.
 *
 * Body: { amount: number, campaignId: number }
 * Response: { order_id: string, key_id: string }
 *
 * Requirement 5.1 — validate amount ₹10–₹500,000; create Razorpay order.
 * Requirement 5.3 — if order creation fails, return error (do not proceed to checkout).
 */
router.post('/create-order', verifyToken, async (req, res) => {
    const { amount, campaignId } = req.body;

    // Validate amount bounds (Property 13)
    const amountINR = parseFloat(amount);
    if (
        isNaN(amountINR) ||
        amountINR < MIN_AMOUNT_INR ||
        amountINR > MAX_AMOUNT_INR
    ) {
        return res.status(400).json({
            message: `Donation amount must be between ₹${MIN_AMOUNT_INR} and ₹${MAX_AMOUNT_INR}.`,
        });
    }

    if (!campaignId || !Number.isInteger(Number(campaignId)) || Number(campaignId) <= 0) {
        return res.status(400).json({ message: 'A valid campaign ID is required.' });
    }

    // Razorpay amounts are in paise (1 INR = 100 paise)
    const amountPaise = Math.round(amountINR * 100);

    try {
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt: `receipt_campaign_${campaignId}_user_${req.user.userId}_${Date.now()}`,
            notes: {
                campaign_id: String(campaignId),
                donor_id: String(req.user.userId),
            },
        });

        return res.status(201).json({
            order_id: order.id,
            key_id: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error('[payments] Razorpay order creation failed:', err.message);
        return res.status(502).json({
            message: 'Payment could not be initiated. Please try again.',
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/payments/verify
// ---------------------------------------------------------------------------

/**
 * Verifies the Razorpay payment signature and records the donation.
 *
 * Body: {
 *   razorpay_order_id:   string,
 *   razorpay_payment_id: string,
 *   razorpay_signature:  string,
 *   campaignId:          number,
 *   amount:              number   (INR)
 * }
 * Response: { success: true, donationId: number }
 *
 * Requirements 5.4, 5.5 — HMAC-SHA256 signature verification before recording.
 * Requirement 5.6        — send receipt email async (fire-and-forget).
 * Requirement 5.7        — store razorpay_payment_id and razorpay_order_id.
 * Requirements 11.1/11.2 — update donor badge after verified donation.
 */
router.post('/verify', verifyToken, (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        campaignId,
        amount,
    } = req.body;

    // Basic field presence check
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: 'Missing Razorpay payment fields.' });
    }

    if (!campaignId || !amount) {
        return res.status(400).json({ message: 'Campaign ID and amount are required.' });
    }

    // --- Signature verification (Property 14) ---
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        // Requirement 5.5 — reject donation if signature does not match
        return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    const db = req.db;
    const donorId = req.user.userId;
    const amountINR = parseFloat(amount);

    // Fetch campaign and donor info for email receipt and badge update
    db.query(
        'SELECT id, title, user_id FROM fundraisers WHERE id = ?',
        [campaignId],
        (err, campaignResults) => {
            if (err || campaignResults.length === 0) {
                return res.status(404).json({ message: 'Campaign not found.' });
            }

            const campaign = campaignResults[0];

            db.query(
                'SELECT id, username, email FROM users WHERE id = ?',
                [donorId],
                (err, userResults) => {
                    if (err || userResults.length === 0) {
                        return res.status(404).json({ message: 'Donor not found.' });
                    }

                    const donor = userResults[0];

                    // Insert donation record with status = 'verified' (Property 15)
                    const insertDonation = `
                        INSERT INTO donations
                            (user_id, fundraiser_id, amount, razorpay_payment_id, razorpay_order_id, status, name, email)
                        VALUES (?, ?, ?, ?, ?, 'verified', ?, ?)
                    `;

                    db.query(
                        insertDonation,
                        [donorId, campaignId, amountINR, razorpay_payment_id, razorpay_order_id, donor.username, donor.email],
                        (err, insertResult) => {
                            if (err) {
                                console.error('[payments] Failed to insert donation:', err.message);
                                return res.status(500).json({ message: 'Failed to record donation.' });
                            }

                            const donationId = insertResult.insertId;

                            // Update fundraiser raised amount
                            db.query(
                                'UPDATE fundraisers SET raised = raised + ? WHERE id = ?',
                                [amountINR, campaignId],
                                (err) => {
                                    if (err) {
                                        console.error('[payments] Failed to update fundraiser raised:', err.message);
                                        // Non-fatal: donation is recorded; log and continue
                                    }
                                }
                            );

                            // Respond to client immediately — email and badge are async
                            res.status(200).json({ success: true, donationId });

                            // --- Fire-and-forget: send donation receipt email (Requirement 5.6) ---
                            sendDonationReceiptEmail(donor, campaign, amountINR).catch((emailErr) => {
                                console.error('[payments] Receipt email failed:', emailErr.message);
                            });

                            // --- Fire-and-forget: update donor badge (Requirements 11.1, 11.2) ---
                            updateDonorBadge(donorId, db).catch((badgeErr) => {
                                console.error('[payments] Badge update failed:', badgeErr.message);
                            });
                        }
                    );
                }
            );
        }
    );
});

// ---------------------------------------------------------------------------
// POST /api/payments/refund  (Admin only)
// ---------------------------------------------------------------------------

/**
 * Initiates a Razorpay refund for a given payment ID.
 *
 * Body: { paymentId: string, amount?: number }  (amount in INR; omit for full refund)
 * Response: { success: true, refundId: string }
 *
 * Requirement 5.3 — admin-initiated refund path.
 */
router.post('/refund', verifyAdmin, async (req, res) => {
    const { paymentId, amount } = req.body;

    if (!paymentId) {
        return res.status(400).json({ message: 'Payment ID is required.' });
    }

    const refundOptions = {};
    if (amount !== undefined) {
        const amountINR = parseFloat(amount);
        if (isNaN(amountINR) || amountINR <= 0) {
            return res.status(400).json({ message: 'Refund amount must be a positive number.' });
        }
        // Razorpay refund amounts are in paise
        refundOptions.amount = Math.round(amountINR * 100);
    }

    try {
        const refund = await razorpay.payments.refund(paymentId, refundOptions);

        // Update donation status to 'refunded' in the database
        req.db.query(
            "UPDATE donations SET status = 'refunded' WHERE razorpay_payment_id = ?",
            [paymentId],
            (err) => {
                if (err) {
                    console.error('[payments] Failed to update donation status to refunded:', err.message);
                    // Non-fatal: refund was initiated with Razorpay; log and continue
                }
            }
        );

        return res.status(200).json({ success: true, refundId: refund.id });
    } catch (err) {
        console.error('[payments] Razorpay refund failed:', err.message);
        return res.status(502).json({
            message: 'Refund could not be initiated. Please try again.',
        });
    }
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = router;
