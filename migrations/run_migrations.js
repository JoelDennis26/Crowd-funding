/**
 * run_migrations.js
 *
 * Connects to the crowd_funding database using the existing .env config
 * and executes 001_initial_schema.sql.
 *
 * Usage:
 *   node migrations/run_migrations.js
 */

'use strict';

require('dotenv').config();
const mysql = require('mysql');
const fs    = require('fs');
const path  = require('path');

// ── DB connection ────────────────────────────────────────────────────────────
const db = mysql.createConnection({
  host    : process.env.DB_HOST,
  user    : process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  multipleStatements: true   // required to run the whole SQL file at once
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Splits a SQL file into individual statements, stripping blank lines and
 * comment-only lines so each statement can be executed separately.
 * This avoids issues with drivers that don't support multipleStatements.
 */
function splitStatements(sql) {
  // Normalise line endings, then split on semicolons
  return sql
    .replace(/\r\n/g, '\n')
    .split(';')
    .map(s => {
      // Remove comment lines from each chunk
      return s
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
    })
    .filter(s => s.length > 0);
}

/**
 * Run a single SQL statement wrapped in a Promise.
 */
function runStatement(connection, statement) {
  return new Promise((resolve, reject) => {
    connection.query(statement, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const sqlFile = path.join(__dirname, '001_initial_schema.sql');

  // Verify the SQL file exists
  if (!fs.existsSync(sqlFile)) {
    console.error(`Migration file not found: ${sqlFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');
  const statements = splitStatements(sql);

  console.log(`\nFundHive — running migration: 001_initial_schema.sql`);
  console.log(`Database : ${process.env.DB_NAME} @ ${process.env.DB_HOST}`);
  console.log(`Statements found: ${statements.length}\n`);

  // Connect
  await new Promise((resolve, reject) => {
    db.connect(err => {
      if (err) {
        console.error('Failed to connect to database:', err.message);
        return reject(err);
      }
      console.log('Connected to MySQL.\n');
      resolve();
    });
  });

  // Execute each statement
  let successCount = 0;
  let errorCount   = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Print a short preview of the statement for logging
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 80);
    try {
      await runStatement(db, stmt);
      console.log(`  [OK] ${preview}${stmt.length > 80 ? '…' : ''}`);
      successCount++;
    } catch (err) {
      // ER_DUP_FIELDNAME / ER_TABLE_EXISTS_ERROR are expected when the
      // migration has already been applied — treat them as warnings, not
      // hard failures, so the script remains idempotent.
      const ignorable = [
        'ER_DUP_FIELDNAME',      // column already exists
        'ER_TABLE_EXISTS_ERROR', // table already exists
        'ER_DUP_KEYNAME',        // index already exists
      ];
      if (ignorable.includes(err.code)) {
        console.warn(`  [SKIP — already applied] ${preview}…`);
        successCount++;
      } else {
        console.error(`  [ERROR] ${preview}…`);
        console.error(`          ${err.message}`);
        errorCount++;
      }
    }
  }

  db.end();

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Migration complete.`);
  console.log(`  Succeeded : ${successCount}`);
  console.log(`  Errors    : ${errorCount}`);
  console.log(`─────────────────────────────────────────\n`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  db.end();
  process.exit(1);
});
