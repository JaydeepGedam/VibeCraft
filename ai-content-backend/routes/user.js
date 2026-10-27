const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// Get user preferences
router.get('/preferences', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const hasCustomKey = !!(user.preferences?.customOpenAiKey && user.preferences.customOpenAiKey.trim().startsWith('sk-'));
        const limit = typeof user.freeGenerationLimit === 'number' ? user.freeGenerationLimit : 5;
        const used = typeof user.generationsUsed === 'number' ? user.generationsUsed : 0;
        const remaining = Math.max(0, limit - used);

        res.json({
            preferences: user.preferences || {},
            quota: {
                generationsUsed: used,
                freeGenerationLimit: limit,
                hasCustomKey,
                remaining
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user preferences
router.put('/preferences/update', authMiddleware, async (req, res) => {
    try {
        const { defaultTone, defaultContentType, defaultGoal, defaultAudience, customOpenAiKey } = req.body;
        
        const updateData = {
            'preferences.defaultTone': defaultTone !== undefined ? defaultTone : '',
            'preferences.defaultContentType': defaultContentType !== undefined ? defaultContentType : '',
            'preferences.defaultGoal': defaultGoal !== undefined ? defaultGoal : '',
            'preferences.defaultAudience': defaultAudience !== undefined ? defaultAudience : '',
        };

        if (customOpenAiKey !== undefined) {
            updateData['preferences.customOpenAiKey'] = customOpenAiKey.trim();
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hasCustomKey = !!(user.preferences?.customOpenAiKey && user.preferences.customOpenAiKey.trim().startsWith('sk-'));
        const limit = typeof user.freeGenerationLimit === 'number' ? user.freeGenerationLimit : 5;
        const used = typeof user.generationsUsed === 'number' ? user.generationsUsed : 0;
        const remaining = Math.max(0, limit - used);

        res.json({
            success: true,
            preferences: user.preferences,
            quota: {
                generationsUsed: used,
                freeGenerationLimit: limit,
                hasCustomKey,
                remaining
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;