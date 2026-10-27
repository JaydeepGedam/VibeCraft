const mongoose = require('mongoose');

// Temporary document to hold signup state until OTP is verified.
// TTL index ensures these are automatically cleaned up after 15 minutes
// even if the user never completes verification.
const pendingSignupSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    hashedPassword: { type: String, required: true },
    hashedOtp: { type: String, required: true },
    expiresAt: { type: Date, required: true }
});

// MongoDB TTL index: auto-delete documents 0 seconds after expiresAt
pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingSignup', pendingSignupSchema);
