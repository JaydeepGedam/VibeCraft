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
        res.json({ preferences: user.preferences || {} });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user preferences
router.put('/preferences/update', authMiddleware, async (req, res) => {
    try {
        const { defaultTone, defaultContentType, defaultGoal } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                preferences: {
                    defaultTone: defaultTone || '',
                    defaultContentType: defaultContentType || '',
                    defaultGoal: defaultGoal || ''
                }
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, preferences: user.preferences });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;