/**
 * Badge Service
 * Handles donor badge tier computation and updates.
 * Requirements: 11.1, 11.2, 11.5
 */

/**
 * Compute the badge tier for a given cumulative donation amount.
 * Pure function — no DB calls.
 *
 * Tiers (INR):
 *   Hero       — ₹25,000 and above
 *   Champion   — ₹5,000 – ₹24,999
 *   Supporter  — ₹500   – ₹4,999
 *   null       — below ₹500
 *
 * @param {number} cumulativeAmount - Total verified donations in INR
 * @returns {'Hero' | 'Champion' | 'Supporter' | null}
 */
function computeBadgeTier(cumulativeAmount) {
    if (cumulativeAmount >= 25000) {
        return 'Hero';
    }
    if (cumulativeAmount >= 5000) {
        return 'Champion';
    }
    if (cumulativeAmount >= 500) {
        return 'Supporter';
    }
    return null;
}

/**
 * Query the verified donation total for a user, compute their badge tier,
 * and update `users.badge_tier` and `users.cumulative_donated` in the DB.
 *
 * @param {number} userId - The user's ID
 * @param {object} db     - A mysql connection (or pool) object
 * @returns {Promise<void>}
 */
function updateDonorBadge(userId, db) {
    return new Promise((resolve, reject) => {
        const sumQuery = `
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM donations
            WHERE user_id = ? AND status = 'verified'
        `;

        db.query(sumQuery, [userId], (err, results) => {
            if (err) {
                return reject(err);
            }

            const total = parseFloat(results[0].total) || 0;
            const tier = computeBadgeTier(total);

            const updateQuery = `
                UPDATE users
                SET badge_tier = ?, cumulative_donated = ?
                WHERE id = ?
            `;

            db.query(updateQuery, [tier, total, userId], (updateErr) => {
                if (updateErr) {
                    return reject(updateErr);
                }
                resolve();
            });
        });
    });
}

module.exports = { computeBadgeTier, updateDonorBadge };
