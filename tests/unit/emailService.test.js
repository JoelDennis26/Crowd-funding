'use strict';

/**
 * Unit tests for services/emailService.js
 *
 * These tests verify the fire-and-forget behaviour, correct argument handling,
 * and that errors from the SMTP transport are swallowed (not propagated).
 *
 * Nodemailer's transporter is mocked so no real SMTP connection is needed.
 */

// ---------------------------------------------------------------------------
// Mock nodemailer BEFORE requiring the module under test
// ---------------------------------------------------------------------------

let mockSendMail;

jest.mock('nodemailer', () => {
  mockSendMail = jest.fn();
  return {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  };
});

// Set required env vars before the module is loaded
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'secret';
process.env.APP_URL   = 'http://localhost:3000';

const {
  sendVerificationEmail,
  sendCampaignApprovalEmail,
  sendCampaignRejectionEmail,
  sendMilestoneReachedEmail,
  sendDonationReceiptEmail,
  sendCampaignUpdateEmail,
  _formatINR,
  _escapeHtml,
} = require('../../services/emailService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const user     = { email: 'alice@example.com', username: 'alice' };
const creator  = { email: 'bob@example.com',   username: 'bob', display_name: 'Bob Creator' };
const donor    = { email: 'carol@example.com',  username: 'carol' };
const campaign = { id: 42, title: 'Save the Reef' };
const milestone = { title: 'First ₹10,000', target_amount: 10000 };
const update   = { title: 'Week 1 Progress', body: 'We have made great progress this week.' };

beforeEach(() => {
  mockSendMail.mockReset();
  mockSendMail.mockResolvedValue({ messageId: 'test-id' });
});

// ---------------------------------------------------------------------------
// sendVerificationEmail
// ---------------------------------------------------------------------------

describe('sendVerificationEmail', () => {
  it('calls sendMail with the correct recipient and subject', async () => {
    await sendVerificationEmail(user, 'abc123token');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.to).toBe(user.email);
    expect(opts.subject).toMatch(/verify/i);
  });

  it('includes the verification token URL in the email body', async () => {
    const token = 'myUniqueToken42';
    await sendVerificationEmail(user, token);

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain(token);
    expect(opts.html).toContain(token);
  });

  it('includes the username in the email body', async () => {
    await sendVerificationEmail(user, 'tok');

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain(user.username);
  });

  it('does NOT throw when sendMail rejects (fire-and-forget)', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(sendVerificationEmail(user, 'tok')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendCampaignApprovalEmail
// ---------------------------------------------------------------------------

describe('sendCampaignApprovalEmail', () => {
  it('sends to the creator email with an approval subject', async () => {
    await sendCampaignApprovalEmail(creator, campaign);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.to).toBe(creator.email);
    expect(opts.subject).toContain(campaign.title);
  });

  it('includes the campaign URL in the body', async () => {
    await sendCampaignApprovalEmail(creator, campaign);

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain(`campaign.html?id=${campaign.id}`);
  });

  it('uses display_name when available', async () => {
    await sendCampaignApprovalEmail(creator, campaign);

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain(creator.display_name);
  });

  it('falls back to username when display_name is absent', async () => {
    const creatorNoDisplay = { email: 'x@x.com', username: 'xuser' };
    await sendCampaignApprovalEmail(creatorNoDisplay, campaign);

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain('xuser');
  });

  it('does NOT throw when sendMail rejects', async () => {
    mockSendMail.mockRejectedValue(new Error('timeout'));
    await expect(sendCampaignApprovalEmail(creator, campaign)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendCampaignRejectionEmail
// ---------------------------------------------------------------------------

describe('sendCampaignRejectionEmail', () => {
  const reason = 'Campaign description is too vague.';

  it('sends to the creator email', async () => {
    await sendCampaignRejectionEmail(creator, campaign, reason);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe(creator.email);
  });

  it('includes the rejection reason in the body', async () => {
    await sendCampaignRejectionEmail(creator, campaign, reason);

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain(reason);
    expect(opts.html).toContain(reason);
  });

  it('includes the campaign title in the subject', async () => {
    await sendCampaignRejectionEmail(creator, campaign, reason);

    expect(mockSendMail.mock.calls[0][0].subject).toContain(campaign.title);
  });

  it('does NOT throw when sendMail rejects', async () => {
    mockSendMail.mockRejectedValue(new Error('auth failed'));
    await expect(sendCampaignRejectionEmail(creator, campaign, reason)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendMilestoneReachedEmail
// ---------------------------------------------------------------------------

describe('sendMilestoneReachedEmail', () => {
  it('sends to the creator email', async () => {
    await sendMilestoneReachedEmail(creator, campaign, milestone);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe(creator.email);
  });

  it('includes the milestone title in the body', async () => {
    await sendMilestoneReachedEmail(creator, campaign, milestone);

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain(milestone.title);
  });

  it('includes the campaign URL in the body', async () => {
    await sendMilestoneReachedEmail(creator, campaign, milestone);

    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain(`campaign.html?id=${campaign.id}`);
  });

  it('does NOT throw when sendMail rejects', async () => {
    mockSendMail.mockRejectedValue(new Error('network error'));
    await expect(sendMilestoneReachedEmail(creator, campaign, milestone)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendDonationReceiptEmail
// ---------------------------------------------------------------------------

describe('sendDonationReceiptEmail', () => {
  it('sends to the donor email', async () => {
    await sendDonationReceiptEmail(donor, campaign, 500);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe(donor.email);
  });

  it('includes the formatted amount in the body', async () => {
    await sendDonationReceiptEmail(donor, campaign, 1500);

    const opts = mockSendMail.mock.calls[0][0];
    // Should contain the INR symbol and the amount
    expect(opts.text).toContain('₹');
    expect(opts.text).toContain('1,500');
  });

  it('includes the campaign title in the subject', async () => {
    await sendDonationReceiptEmail(donor, campaign, 200);

    expect(mockSendMail.mock.calls[0][0].subject).toContain(campaign.title);
  });

  it('does NOT throw when sendMail rejects', async () => {
    mockSendMail.mockRejectedValue(new Error('quota exceeded'));
    await expect(sendDonationReceiptEmail(donor, campaign, 100)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendCampaignUpdateEmail
// ---------------------------------------------------------------------------

describe('sendCampaignUpdateEmail', () => {
  const donors = [
    { email: 'donor1@example.com', username: 'donor1' },
    { email: 'donor2@example.com', username: 'donor2' },
    { email: 'donor3@example.com', username: 'donor3' },
  ];

  it('sends one email per donor', async () => {
    await sendCampaignUpdateEmail(donors, campaign, update);

    expect(mockSendMail).toHaveBeenCalledTimes(donors.length);
  });

  it('sends to each donor email address', async () => {
    await sendCampaignUpdateEmail(donors, campaign, update);

    const recipients = mockSendMail.mock.calls.map((call) => call[0].to);
    donors.forEach((d) => expect(recipients).toContain(d.email));
  });

  it('includes the update title in each email body', async () => {
    await sendCampaignUpdateEmail(donors, campaign, update);

    mockSendMail.mock.calls.forEach((call) => {
      expect(call[0].text).toContain(update.title);
    });
  });

  it('does nothing when donors array is empty', async () => {
    await sendCampaignUpdateEmail([], campaign, update);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('does nothing when donors is null', async () => {
    await sendCampaignUpdateEmail(null, campaign, update);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('does NOT throw when one sendMail call rejects', async () => {
    mockSendMail
      .mockResolvedValueOnce({ messageId: 'ok' })
      .mockRejectedValueOnce(new Error('bad address'))
      .mockResolvedValueOnce({ messageId: 'ok' });

    await expect(sendCampaignUpdateEmail(donors, campaign, update)).resolves.toBeUndefined();
    // All three sends were still attempted
    expect(mockSendMail).toHaveBeenCalledTimes(donors.length);
  });
});

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

describe('_formatINR', () => {
  it('formats whole numbers with ₹ prefix', () => {
    expect(_formatINR(1000)).toBe('₹1,000');
    expect(_formatINR(500)).toBe('₹500');
    expect(_formatINR(25000)).toBe('₹25,000');
  });

  it('formats zero correctly', () => {
    expect(_formatINR(0)).toBe('₹0');
  });
});

describe('_escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(_escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(_escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(_escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('returns empty string for null/undefined', () => {
    expect(_escapeHtml(null)).toBe('');
    expect(_escapeHtml(undefined)).toBe('');
  });

  it('returns the original string when no special chars present', () => {
    expect(_escapeHtml('Hello World')).toBe('Hello World');
  });
});
