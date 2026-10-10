const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    original_content_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedContent' },
    topic: String,
    type: String,
    goal: String,
    tone: String,
    mood: String,
    audience: String,
    instructions: String,
    content: String,
    is_published: { type: Boolean, default: false },
    published_platform: { type: String, default: '' },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GeneratedHistory', historySchema);
