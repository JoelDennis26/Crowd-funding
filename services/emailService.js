'use strict';

/**
 * Email Service — FundHive Platform
 *
 * Provides all transactional email functions using Nodemailer.
 * All functions are fire-and-forget: errors are logged but never propagate
 * to the caller, so a failed email never breaks an HTTP response.
 *
 * Configuration (via environment variables):
 *   SMTP_HOST  — SMTP server hostname (required)
 *   SMTP_PORT  — SMTP port (default: 587)
 *   SMTP_USER  — SMTP authentication username (required)
 *   SMTP_PASS  — SMTP authentication password (required)
 *   SMTP_FROM  — "From" address (default: SMTP_USER)
 *   APP_URL    — Base URL of the application (default: http://localhost:3000)
 */

const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Transporter — created once and reused across all send calls
// ---------------------------------------------------------------------------

let transporterPromise;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT, 10) || 587,
          secure: (parseInt(process.env.SMTP_PORT, 10) || 587) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        console.log('[emailService] Generating Ethereal test account for local development...');
        const testAccount = await nodemailer.createTestAccount();
        return nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      }
    })();
  }
  return transporterPromise;
}

/** Resolved "From" address used in every outgoing email. */
const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fundhive.in';

/** Base URL used to build verification and campaign links. */
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Sends an email and swallows any error (fire-and-forget).
 * @param {import('nodemailer').SendMailOptions} mailOptions
 * @returns {Promise<void>}
 */
async function _send(mailOptions) {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    if (!process.env.SMTP_HOST) {
      console.log('--- Email Sent Successfully ---');
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      console.log('-------------------------------');
    }
  } catch (err) {
    console.error('[emailService] Failed to send email to', mailOptions.to, '—', err.message);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends an email-verification link to a newly registered user.
 *
 * Requirement 1.1 — The platform SHALL send a verification email containing
 * a unique, time-limited token to the provided email address.
 *
 * @param {{ email: string, username: string }} user
 * @param {string} token  — 64-character hex verification token
 * @returns {Promise<void>}
 */
async function sendVerificationEmail(user, token) {
  const verifyUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;

  await _send({
    from: FROM_ADDRESS,
    to: user.email,
    subject: 'Verify your FundHive account',
    text: [
      `Hi ${user.username},`,
      '',
      'Welcome to FundHive! Please verify your email address by clicking the link below.',
      'This link is valid for 24 hours.',
      '',
      verifyUrl,
      '',
      'If you did not create a FundHive account, you can safely ignore this email.',
      '',
      '— The FundHive Team',
    ].join('\n'),
    html: `
      <p>Hi <strong>${escapeHtml(user.username)}</strong>,</p>
      <p>Welcome to FundHive! Please verify your email address by clicking the button below.
         This link is valid for <strong>24 hours</strong>.</p>
      <p style="margin:24px 0;">
        <a href="${verifyUrl}"
           style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
                  text-decoration:none;font-weight:bold;">
          Verify Email Address
        </a>
      </p>
      <p>Or copy and paste this URL into your browser:<br>
         <a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>If you did not create a FundHive account, you can safely ignore this email.</p>
      <p>— The FundHive Team</p>
    `,
  });
}

/**
 * Notifies a campaign creator that their campaign has been approved.
 *
 * Requirement 3.3 — The Email_Service SHALL notify the Creator by email
 * within 5 minutes of the status change (approval).
 *
 * @param {{ email: string, username: string, display_name?: string }} creator
 * @param {{ id: number, title: string }} campaign
 * @returns {Promise<void>}
 */
async function sendCampaignApprovalEmail(creator, campaign) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const campaignUrl = `${FRONTEND_URL}/donate`;
  const creatorName = creator.display_name || creator.username;

  await _send({
    from: FROM_ADDRESS,
    to: creator.email,
    subject: `Your campaign "${campaign.title}" has been approved!`,
    text: [
      `Hi ${creatorName},`,
      '',
      `Great news! Your campaign "${campaign.title}" has been reviewed and approved by the FundHive team.`,
      'It is now live and visible to donors.',
      '',
      `View your campaign: ${campaignUrl}`,
      '',
      'Good luck with your fundraising!',
      '',
      '— The FundHive Team',
    ].join('\n'),
    html: `
      <p>Hi <strong>${escapeHtml(creatorName)}</strong>,</p>
      <p>Great news! Your campaign <strong>"${escapeHtml(campaign.title)}"</strong> has been
         reviewed and approved by the FundHive team. It is now live and visible to donors.</p>
      <p style="margin:24px 0;">
        <a href="${campaignUrl}"
           style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;
                  text-decoration:none;font-weight:bold;">
          View Your Campaign
        </a>
      </p>
      <p>Good luck with your fundraising!</p>
      <p>— The FundHive Team</p>
    `,
  });
}

/**
 * Notifies a campaign creator that their campaign has been rejected, including
 * the rejection reason.
 *
 * Requirement 3.4 — The Email_Service SHALL notify the Creator with the
 * rejection reason within 5 minutes.
 *
 * @param {{ email: string, username: string, display_name?: string }} creator
 * @param {{ id: number, title: string }} campaign
 * @param {string} reason  — Admin-supplied rejection reason
 * @returns {Promise<void>}
 */
async function sendCampaignRejectionEmail(creator, campaign, reason) {
  const creatorName = creator.display_name || creator.username;

  await _send({
    from: FROM_ADDRESS,
    to: creator.email,
    subject: `Update on your campaign "${campaign.title}"`,
    text: [
      `Hi ${creatorName},`,
      '',
      `Thank you for submitting your campaign "${campaign.title}" to FundHive.`,
      'After review, we were unable to approve it at this time.',
      '',
      'Reason:',
      reason,
      '',
      'You are welcome to revise your campaign and resubmit it for verification.',
      'If you have questions, please contact our support team.',
      '',
      '— The FundHive Team',
    ].join('\n'),
    html: `
      <p>Hi <strong>${escapeHtml(creatorName)}</strong>,</p>
      <p>Thank you for submitting your campaign <strong>"${escapeHtml(campaign.title)}"</strong>
         to FundHive. After review, we were unable to approve it at this time.</p>
      <p><strong>Reason:</strong></p>
      <blockquote style="border-left:4px solid #dc2626;padding-left:12px;color:#374151;">
        ${escapeHtml(reason)}
      </blockquote>
      <p>You are welcome to revise your campaign and resubmit it for verification.
         If you have questions, please contact our support team.</p>
      <p>— The FundHive Team</p>
    `,
  });
}

/**
 * Notifies a campaign creator that one of their milestones has been reached.
 *
 * Requirement 6.3 — The Email_Service SHALL notify the Creator by email
 * within 5 minutes of a milestone being reached.
 *
 * @param {{ email: string, username: string, display_name?: string }} creator
 * @param {{ id: number, title: string }} campaign
 * @param {{ title: string, target_amount: number }} milestone
 * @returns {Promise<void>}
 */
async function sendMilestoneReachedEmail(creator, campaign, milestone) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const campaignUrl = `${FRONTEND_URL}/donate`;
  const creatorName = creator.display_name || creator.username;
  const formattedAmount = formatINR(milestone.target_amount);

  await _send({
    from: FROM_ADDRESS,
    to: creator.email,
    subject: `Milestone reached on "${campaign.title}"!`,
    text: [
      `Hi ${creatorName},`,
      '',
      `Congratulations! Your campaign "${campaign.title}" has reached the milestone:`,
      `"${milestone.title}" (${formattedAmount})`,
      '',
      `View your campaign: ${campaignUrl}`,
      '',
      'Keep up the great work!',
      '',
      '— The FundHive Team',
    ].join('\n'),
    html: `
      <p>Hi <strong>${escapeHtml(creatorName)}</strong>,</p>
      <p>Congratulations! Your campaign <strong>"${escapeHtml(campaign.title)}"</strong>
         has reached the milestone:</p>
      <p style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:12px;">
        <strong>${escapeHtml(milestone.title)}</strong> — ${escapeHtml(formattedAmount)}
      </p>
      <p style="margin:24px 0;">
        <a href="${campaignUrl}"
           style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
                  text-decoration:none;font-weight:bold;">
          View Campaign
        </a>
      </p>
      <p>Keep up the great work!</p>
      <p>— The FundHive Team</p>
    `,
  });
}

/**
 * Sends a donation receipt to a donor after a successful, verified payment.
 *
 * Requirement 5.6 — The Email_Service SHALL send a donation receipt to the
 * Donor's email address; if the email send fails, the donation record is
 * retained and the donation is NOT reversed.
 *
 * @param {{ email: string, username: string }} donor
 * @param {{ id: number, title: string }} campaign
 * @param {number} amount  — Donation amount in INR
 * @returns {Promise<void>}
 */
async function sendDonationReceiptEmail(donor, campaign, amount) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const campaignUrl = `${FRONTEND_URL}/donate`;
  const formattedAmount = formatINR(amount);

  await _send({
    from: FROM_ADDRESS,
    to: donor.email,
    subject: `Your donation to "${campaign.title}" — Receipt`,
    text: [
      `Hi ${donor.username},`,
      '',
      `Thank you for your generous donation of ${formattedAmount} to "${campaign.title}".`,
      'Your contribution makes a real difference.',
      '',
      `View the campaign: ${campaignUrl}`,
      '',
      'This email serves as your donation receipt. Please keep it for your records.',
      '',
      '— The FundHive Team',
    ].join('\n'),
    html: `
      <p>Hi <strong>${escapeHtml(donor.username)}</strong>,</p>
      <p>Thank you for your generous donation of <strong>${escapeHtml(formattedAmount)}</strong>
         to <strong>"${escapeHtml(campaign.title)}"</strong>.
         Your contribution makes a real difference.</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%;max-width:400px;">
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:bold;">Campaign</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(campaign.title)}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:bold;">Amount</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(formattedAmount)}</td>
        </tr>
      </table>
      <p style="margin:24px 0;">
        <a href="${campaignUrl}"
           style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
                  text-decoration:none;font-weight:bold;">
          View Campaign
        </a>
      </p>
      <p>This email serves as your donation receipt. Please keep it for your records.</p>
      <p>— The FundHive Team</p>
    `,
  });
}

/**
 * Sends a campaign update notification to all donors of a campaign.
 *
 * Requirement 13.5 — The Email_Service SHALL send a notification email to all
 * Donors who have donated to that campaign; if the email send fails, the stored
 * update is retained and NOT reversed.
 *
 * @param {Array<{ email: string, username: string }>} donors  — List of donor objects
 * @param {{ id: number, title: string }} campaign
 * @param {{ title: string, body: string }} update  — The new campaign update
 * @returns {Promise<void>}
 */
async function sendCampaignUpdateEmail(donors, campaign, update) {
  if (!Array.isArray(donors) || donors.length === 0) {
    return;
  }

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const campaignUrl = `${FRONTEND_URL}/donate`;

  // Send to each donor individually so one bad address doesn't block others
  const sendPromises = donors.map((donor) =>
    _send({
      from: FROM_ADDRESS,
      to: donor.email,
      subject: `New update on "${campaign.title}"`,
      text: [
        `Hi ${donor.username},`,
        '',
        `The campaign "${campaign.title}" you supported has posted a new update:`,
        '',
        `${update.title}`,
        '---',
        update.body,
        '',
        `Read the full update: ${campaignUrl}`,
        '',
        '— The FundHive Team',
      ].join('\n'),
      html: `
        <p>Hi <strong>${escapeHtml(donor.username)}</strong>,</p>
        <p>The campaign <strong>"${escapeHtml(campaign.title)}"</strong> you supported
           has posted a new update:</p>
        <div style="border-left:4px solid #2563eb;padding-left:16px;margin:16px 0;">
          <h3 style="margin:0 0 8px;">${escapeHtml(update.title)}</h3>
          <p style="margin:0;color:#374151;">${escapeHtml(update.body)}</p>
        </div>
        <p style="margin:24px 0;">
          <a href="${campaignUrl}"
             style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
                    text-decoration:none;font-weight:bold;">
            Read Full Update
          </a>
        </p>
        <p>— The FundHive Team</p>
      `,
    })
  );

  await Promise.all(sendPromises);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Formats a numeric amount as an INR currency string (e.g. "₹1,500").
 * @param {number} amount
 * @returns {string}
 */
function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Minimal HTML escaping to prevent XSS in email HTML bodies.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sendVerificationEmail,
  sendCampaignApprovalEmail,
  sendCampaignRejectionEmail,
  sendMilestoneReachedEmail,
  sendDonationReceiptEmail,
  sendCampaignUpdateEmail,
  // Exported for testing
  _formatINR: formatINR,
  _escapeHtml: escapeHtml,
};
