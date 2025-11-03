const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    linkedIn: {
        accessToken: { type: String },
        refreshToken: { type: String },
        profileId: { type: String },
        profileName: { type: String },
        connectedAt: { type: Date },
    },
    preferences: {
        defaultTone: { type: String, default: '' },
        defaultContentType: { type: String, default: '' },
        defaultGoal: { type: String, default: '' }
    }
});

// Enforce one Vibecraft account per LinkedIn profile
userSchema.index({ 'linkedIn.profileId': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);
