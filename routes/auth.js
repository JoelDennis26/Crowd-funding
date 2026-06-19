'use strict';

/**
 * Auth Routes — Email Verification
 *
 * GET  /verify-email?token=...   — validate token, mark user verified, redirect to login
 * POST /resend-verification      — rate-limited resend of verification email
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8
 */

const express = require('express');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../services/emailService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: generate a 64-char hex token
// ---------------------------------------------------------------------------
function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 32 bytes → 64 hex chars
}

// ---------------------------------------------------------------------------
// Helper: compute expiry timestamp 24 hours from now (MySQL DATETIME string)
// ---------------------------------------------------------------------------
function expiresAt24h() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  // Format as "YYYY-MM-DD HH:MM:SS" for MySQL DATETIME
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ---------------------------------------------------------------------------
// GET /verify-email?token=...
// Requirement 1.2 — valid, unused, non-expired token → mark verified, redirect
// Requirement 1.4 — expired token → reject with message
// Requirement 1.5 — already-used token → reject with message
// ---------------------------------------------------------------------------
router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  const db = req.app.get('db');

  if (!token) {
    return res.status(400).send('Missing verification token.');
  }

  const sql = `
    SELECT ev.id, ev.user_id, ev.used, ev.expires_at
    FROM   email_verifications ev
    WHERE  ev.token = ?
    LIMIT  1
  `;

  db.query(sql, [token], (err, rows) => {
    if (err) {
      console.error('[verify-email] DB error:', err);
      return res.status(500).send('Server error. Please try again later.');
    }

    if (rows.length === 0) {
      return res.status(400).send('Invalid verification link.');
    }

    const row = rows[0];

    // Requirement 1.5 — already used
    if (row.used) {
      return res
        .status(400)
        .send('This verification link has already been used. Please log in or request a new link.');
    }

    // Requirement 1.4 — expired
    if (new Date() > new Date(row.expires_at)) {
      return res
        .status(400)
        .send(
          'This verification link has expired. Please <a href="/login.html">log in</a> and request a new one.'
        );
    }

    // Mark token as used and set user as verified in a single transaction
    db.getConnection((connErr, connection) => {
      if (connErr) {
        console.error('[verify-email] Connection error:', connErr);
        return res.status(500).send('Server error. Please try again later.');
      }
      
      connection.beginTransaction((txErr) => {
        if (txErr) {
          connection.release();
          console.error('[verify-email] Transaction start error:', txErr);
          return res.status(500).send('Server error. Please try again later.');
        }

        connection.query(
          'UPDATE email_verifications SET used = 1 WHERE id = ?',
          [row.id],
          (updateTokenErr) => {
            if (updateTokenErr) {
              return connection.rollback(() => {
                connection.release();
                console.error('[verify-email] Token update error:', updateTokenErr);
                res.status(500).send('Server error. Please try again later.');
              });
            }

            connection.query(
              'UPDATE users SET is_verified = 1 WHERE id = ?',
              [row.user_id],
              (updateUserErr) => {
                if (updateUserErr) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('[verify-email] User update error:', updateUserErr);
                    res.status(500).send('Server error. Please try again later.');
                  });
                }

                connection.commit((commitErr) => {
                  if (commitErr) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error('[verify-email] Commit error:', commitErr);
                      res.status(500).send('Server error. Please try again later.');
                    });
                  }
                  
                  connection.release();
                  // Requirement 1.2 — redirect to login after successful verification
                  return res.redirect('/login.html');
                });
              }
            );
          }
        );
      });
    });
  });
});

// ---------------------------------------------------------------------------
// POST /resend-verification
// Body: { email }
// Requirement 1.6 — invalidate old tokens, issue new token, send email
// Requirement 1.8 — rate limit: ≤3 requests per 60-minute window
// ---------------------------------------------------------------------------
router.post('/resend-verification', (req, res) => {
  const { email } = req.body;
  const db = req.app.get('db');

  if (!email) {
    return res.status(400).json({ message: 'Email address is required.' });
  }

  // Look up the user by email
  db.query(
    'SELECT id, username, email, is_verified FROM users WHERE email = ?',
    [email],
    (err, users) => {
      if (err) {
        console.error('[resend-verification] DB error:', err);
        return res.status(500).json({ message: 'Server error. Please try again later.' });
      }

      // Return a generic success message even if the email is not found
      // to avoid user enumeration
      if (users.length === 0) {
        return res
          .status(200)
          .json({ message: 'If that email is registered, a verification link has been sent.' });
      }

      const user = users[0];

      // If already verified, no need to resend
      if (user.is_verified) {
        return res.status(400).json({ message: 'This account is already verified.' });
      }

      // Requirement 1.8 — check rate limit: count resend requests in the last 60 minutes
      const windowStart = new Date(Date.now() - 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      db.query(
        'SELECT COUNT(*) AS cnt FROM verification_resend_log WHERE user_id = ? AND requested_at >= ?',
        [user.id, windowStart],
        (rateErr, rateRows) => {
          if (rateErr) {
            console.error('[resend-verification] Rate-limit query error:', rateErr);
            return res.status(500).json({ message: 'Server error. Please try again later.' });
          }

          const requestCount = rateRows[0].cnt;

          // Requirement 1.8 — reject if 3 or more requests already made in the window
          if (requestCount >= 3) {
            return res.status(429).json({
              message:
                'You have requested too many verification emails. Please wait before requesting again.',
            });
          }

          // Requirement 1.6 — invalidate all existing unused tokens for this user
          db.query(
            'UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0',
            [user.id],
            (invalidateErr) => {
              if (invalidateErr) {
                console.error('[resend-verification] Invalidate tokens error:', invalidateErr);
                return res.status(500).json({ message: 'Server error. Please try again later.' });
              }

              // Issue a new token
              const newToken = generateToken();
              const expiry = expiresAt24h();

              db.query(
                'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
                [user.id, newToken, expiry],
                (insertErr) => {
                  if (insertErr) {
                    console.error('[resend-verification] Insert token error:', insertErr);
                    return res
                      .status(500)
                      .json({ message: 'Server error. Please try again later.' });
                  }

                  // Log this resend request for rate limiting
                  db.query(
                    'INSERT INTO verification_resend_log (user_id) VALUES (?)',
                    [user.id],
                    (logErr) => {
                      if (logErr) {
                        console.error('[resend-verification] Log insert error:', logErr);
                        // Non-fatal: continue even if logging fails
                      }

                      // Send the new verification email (fire-and-forget)
                      sendVerificationEmail(
                        { email: user.email, username: user.username },
                        newToken
                      );

                      return res.status(200).json({
                        message:
                          'A new verification email has been sent. Please check your inbox.',
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

module.exports = router;
module.exports.generateToken = generateToken;
module.exports.expiresAt24h = expiresAt24h;
