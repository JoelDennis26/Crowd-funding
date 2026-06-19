'use strict';

const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const jwt = require('jsonwebtoken');

const { sendDonationReceiptEmail } = require('../services/emailService');
const { updateDonorBadge } = require('../services/badgeService');

const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const User = require('../models/User');

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

async function verifyAdmin(req, res, next) {
    verifyToken(req, res, async () => {
        try {
            const user = await User.findById(req.user.userId);
            if (!user) {
                return res.status(500).json({ message: 'Server error' });
            }
            if (!user.is_admin) {
                return res.status(403).json({ message: 'Admin access required' });
            }
            next();
        } catch (err) {
            res.status(500).json({ message: 'Server error' });
        }
    });
}

const MIN_AMOUNT_INR = 10;
const MAX_AMOUNT_INR = 500000;

router.post('/create-order', verifyToken, async (req, res) => {
    const { amount, campaignId } = req.body;

    const amountINR = parseFloat(amount);
    if (isNaN(amountINR) || amountINR < MIN_AMOUNT_INR || amountINR > MAX_AMOUNT_INR) {
        return res.status(400).json({ message: `Donation amount must be between ₹${MIN_AMOUNT_INR} and ₹${MAX_AMOUNT_INR}.` });
    }

    if (!campaignId) {
        return res.status(400).json({ message: 'A valid campaign ID is required.' });
    }

    const amountPaise = Math.round(amountINR * 100);

    try {
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
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
        console.error('[payments] Razorpay order creation failed:', err);
        return res.status(502).json({
            message: 'Payment could not be initiated. Please try again.',
        });
    }
});

router.post('/verify', verifyToken, async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        campaignId,
        amount,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: 'Missing Razorpay payment fields.' });
    }

    if (!campaignId || !amount) {
        return res.status(400).json({ message: 'Campaign ID and amount are required.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    const donorId = req.user.userId;
    const amountINR = parseFloat(amount);

    try {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }

        const donor = await User.findById(donorId);
        if (!donor) {
            return res.status(404).json({ message: 'Donor not found.' });
        }

        const donation = new Donation({
            user_id: donorId,
            campaign_id: campaignId,
            amount: amountINR,
            razorpay_payment_id,
            razorpay_order_id,
            status: 'verified',
            name: donor.username,
            email: donor.email
        });

        await donation.save();

        campaign.raised = (campaign.raised || 0) + amountINR;
        await campaign.save();

        res.status(200).json({ success: true, donationId: donation._id });

        sendDonationReceiptEmail(donor, campaign, amountINR).catch((emailErr) => {
            console.error('[payments] Receipt email failed:', emailErr.message);
        });

        updateDonorBadge(donorId).catch((badgeErr) => {
            console.error('[payments] Badge update failed:', badgeErr.message);
        });

    } catch (err) {
        console.error('[payments] Error verifying payment:', err);
        return res.status(500).json({ message: 'Server error verifying payment' });
    }
});

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
        refundOptions.amount = Math.round(amountINR * 100);
    }

    try {
        const refund = await razorpay.payments.refund(paymentId, refundOptions);

        await Donation.updateOne(
            { razorpay_payment_id: paymentId },
            { $set: { status: 'refunded' } }
        );

        return res.status(200).json({ success: true, refundId: refund.id });
    } catch (err) {
        console.error('[payments] Razorpay refund failed:', err.message);
        return res.status(502).json({
            message: 'Refund could not be initiated. Please try again.',
        });
    }
});

module.exports = router;
