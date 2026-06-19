'use strict';

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendVerificationEmail } = require('../services/emailService');
const User = require('../models/User');

const router = express.Router();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function expiresAt24h() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

// GET /verify-email?token=...
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing verification token.');
  }

  try {
    const user = await User.findOne({ verification_token: token });

    if (!user) {
      return res.status(400).send('Invalid or already used verification link.');
    }

    if (new Date() > user.verification_token_expires) {
      return res.status(400).send(
        'This verification link has expired. Please log in and request a new one.'
      );
    }

    // Mark user as verified and clear the token
    user.is_verified = true;
    user.verification_token = null;
    user.verification_token_expires = null;
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?verified=true`);
  } catch (err) {
    console.error('[verify-email] error:', err);
    return res.status(500).send('Server error. Please try again later.');
  }
});

// POST /resend-verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.is_verified) {
      return res.status(400).json({ message: 'Email is already verified. You can log in.' });
    }

    const token = generateToken();
    const expiresAt = expiresAt24h();

    user.verification_token = token;
    user.verification_token_expires = expiresAt;
    await user.save();

    sendVerificationEmail({ email: user.email, username: user.username }, token);

    res.json({ message: 'A new verification link has been sent to your email.' });
  } catch (err) {
    console.error('[resend-verification] error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
