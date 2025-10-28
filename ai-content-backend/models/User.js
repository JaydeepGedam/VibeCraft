const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    preferences: {
        defaultTone: { type: String, default: '' },
        defaultContentType: { type: String, default: '' },
        defaultGoal: { type: String, default: '' }
    }
});

module.exports = mongoose.model('User', userSchema);
