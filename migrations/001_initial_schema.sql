-- ============================================================
-- Migration: 001_initial_schema.sql
-- FundHive Platform Enhancements — Additive Schema Changes
-- Requirements: 1.7, 2.1, 3.1, 5.7, 6.1, 13.1, 14.1, 15.7
-- ============================================================
-- All changes are purely additive: no existing columns are
-- dropped or renamed. Safe to run against an existing database.
-- ============================================================

-- ------------------------------------------------------------
-- 1. users — new columns (one ALTER per column for idempotency)
--    Req 1.7  : is_verified (email verification status)
--    Req 2.1  : display_name, bio (creator profile)
--    Req 11.1 : badge_tier, cumulative_donated (gamification)
--    Admin    : is_admin flag
-- Note: split into individual statements so the runner can skip
--       ER_DUP_FIELDNAME errors when re-run on an already-migrated DB.
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN is_verified        TINYINT(1)   NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN display_name       VARCHAR(50)  NULL;
ALTER TABLE users ADD COLUMN bio                VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN badge_tier         ENUM('Supporter','Champion','Hero') NULL;
ALTER TABLE users ADD COLUMN cumulative_donated DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE users ADD COLUMN is_admin           TINYINT(1)   NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. fundraisers — new columns
--    Req 3.1  : verification_status, rejection_reason
--    Req 14.1 : status (draft / pending / active / failed / successful)
--    Req 15.7 : funding_model, all_or_nothing, end_date
-- ------------------------------------------------------------
ALTER TABLE fundraisers ADD COLUMN verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending';
ALTER TABLE fundraisers ADD COLUMN rejection_reason    TEXT NULL;
ALTER TABLE fundraisers ADD COLUMN status              ENUM('draft','pending','active','failed','successful') NOT NULL DEFAULT 'draft';
ALTER TABLE fundraisers ADD COLUMN funding_model       ENUM('flexible','all_or_nothing') NOT NULL DEFAULT 'flexible';
ALTER TABLE fundraisers ADD COLUMN end_date            DATE NULL;
ALTER TABLE fundraisers ADD COLUMN all_or_nothing      TINYINT(1) NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 3. donations — new columns
--    Req 5.7  : razorpay_payment_id, razorpay_order_id
--    Req 8.3  : is_anonymous
--    Req 5.4  : status (pending / verified / refunded)
-- ------------------------------------------------------------
ALTER TABLE donations ADD COLUMN razorpay_payment_id VARCHAR(100) NULL;
ALTER TABLE donations ADD COLUMN razorpay_order_id   VARCHAR(100) NULL;
ALTER TABLE donations ADD COLUMN is_anonymous        TINYINT(1)   NOT NULL DEFAULT 0;
ALTER TABLE donations ADD COLUMN status              ENUM('pending','verified','refunded') NOT NULL DEFAULT 'verified';

-- ------------------------------------------------------------
-- 4. email_verifications — new table
--    Req 1.7  : store verification tokens per user
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verifications (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  token      VARCHAR(64)  NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 5. verification_resend_log — new table
--    Req 1.8  : rate-limit tracking for resend requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_resend_log (
  id           INT      AUTO_INCREMENT PRIMARY KEY,
  user_id      INT      NOT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 6. milestones — new table
--    Req 6.1  : milestone definitions per campaign
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS milestones (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  fundraiser_id INT           NOT NULL,
  title         VARCHAR(100)  NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  description   VARCHAR(500)  NULL,
  status        ENUM('pending','reached') NOT NULL DEFAULT 'pending',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fundraiser_id) REFERENCES fundraisers(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 7. campaign_updates — new table
--    Req 13.1 : creator update posts per campaign
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_updates (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  fundraiser_id   INT           NOT NULL,
  creator_id      INT           NOT NULL,
  title           VARCHAR(150)  NOT NULL,
  body            TEXT          NOT NULL,
  fund_usage_note VARCHAR(1000) NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (fundraiser_id) REFERENCES fundraisers(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_id)    REFERENCES users(id)
);

-- ------------------------------------------------------------
-- 8. comments — new table
--    Req 17.1 : donor comments per campaign
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  fundraiser_id INT           NOT NULL,
  user_id       INT           NOT NULL,
  body          VARCHAR(1000) NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fundraiser_id) REFERENCES fundraisers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 9. withdrawals — new table
--    Req 15.7 : withdrawal records per campaign
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawals (
  id                   INT           AUTO_INCREMENT PRIMARY KEY,
  fundraiser_id        INT           NOT NULL,
  creator_id           INT           NOT NULL,
  amount               DECIMAL(12,2) NOT NULL,
  status               ENUM('initiated','completed','failed') NOT NULL DEFAULT 'initiated',
  razorpay_transfer_id VARCHAR(100)  NULL,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fundraiser_id) REFERENCES fundraisers(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_id)    REFERENCES users(id)
);
