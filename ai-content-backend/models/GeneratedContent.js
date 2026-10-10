const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: String,
    type: String,
    goal: String,
    tone: String,
    mood: String,
    audience: String,
    instructions: String,
    content: String,
    is_favorite: { type: Boolean, default: false },
    is_published: { type: Boolean, default: false },
    published_at: { type: Date },
    published_platform: { type: String, default: '' },
    is_scheduled: { type: Boolean, default: false },
    scheduled_at: { type: Date },
    scheduled_platform: { type: String, default: 'LinkedIn' },
    schedule_status: { type: String, enum: ['none', 'pending', 'published', 'failed'], default: 'none' },
    schedule_error: { type: String, default: '' },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GeneratedContent', contentSchema);
