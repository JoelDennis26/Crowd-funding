const User = require('../models/User');
const Donation = require('../models/Donation');

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

async function updateDonorBadge(userId) {
    try {
        const result = await Donation.aggregate([
            { $match: { user_id: userId, status: 'verified' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const total = result.length > 0 ? result[0].total : 0;
        const tier = computeBadgeTier(total) || 'Bronze';

        await User.findByIdAndUpdate(userId, { tier });
    } catch (err) {
        console.error('[badgeService] Failed to update badge:', err);
    }
}

module.exports = { computeBadgeTier, updateDonorBadge };
