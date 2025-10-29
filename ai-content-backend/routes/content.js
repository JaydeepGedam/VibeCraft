const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const GeneratedContent = require('../models/GeneratedContent');
const GeneratedHistory = require('../models/GeneratedHistory');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Save AI-generated content
router.post('/save', authMiddleware, async (req, res) => {
    const { topic, type, goal, tone, mood, content } = req.body;
    try {
        const newContent = await GeneratedContent.create({
            user_id: req.user.id,
            topic, type, goal, tone, mood, content
        });
        // Also save a copy to History collection so History is separate
        try {
          await GeneratedHistory.create({
            user_id: req.user.id,
            original_content_id: newContent._id,
            topic, type, goal, tone, mood, content
          });
        } catch (histErr) {
          console.error('Failed to save to history:', histErr);
          // don't fail the main save if history save fails
        }
        res.json({ success: true, content_id: newContent._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB error' });
    }
});

// Fetch user content (dashboard/history)
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const contents = await GeneratedContent.find({ user_id: req.user.id }).sort({ created_at: -1 });
        res.json(contents);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB error' });
    }
});

// Generate content via OpenAI
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        const { topic, type, goal, tone, mood } = req.body;
        
        const prompt = `Generate a ${type} about "${topic}" with a ${tone} tone for the goal of ${goal}. The mood should be ${mood}. Make it engaging and well-structured.`;
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000,
            temperature: 0.7
        });

    const generatedContent = completion.choices[0].message.content;

    // NOTE: Previously this route saved generated content automatically.
    // To let the frontend control when a generated item is persisted (only on explicit Save),
    // we no longer write to the database here. The frontend should call POST /content/save
    // when the user clicks the Save button.

    res.json({ content: generatedContent });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'AI generation failed' });
    }
});

// Update content
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { topic, type, goal, tone, mood, content } = req.body;

  try {
    const updatedContent = await GeneratedContent.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { topic, type, goal, tone, mood, content },
      { new: true }
    );

    if (!updatedContent) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({ success: true, updatedContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// History endpoints
// Save to history explicitly
router.post('/history', authMiddleware, async (req, res) => {
  const { topic, type, goal, tone, mood, content, original_content_id } = req.body;
  try {
    const newHist = await GeneratedHistory.create({
      user_id: req.user.id,
      original_content_id,
      topic, type, goal, tone, mood, content
    });
    res.json({ success: true, history_id: newHist._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Get user history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const items = await GeneratedHistory.find({ user_id: req.user.id }).sort({ created_at: -1 });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Delete from history (only history collection)
router.delete('/history/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await GeneratedHistory.findOneAndDelete({ _id: id, user_id: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'History item not found' });
    res.json({ success: true, message: 'Removed from history' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single content by id
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  // validate id to avoid CastError when path segments like 'history' are passed
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid content id' });
  }
  try {
    const content = await GeneratedContent.findOne({ _id: id, user_id: req.user.id });
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json(content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete content
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedContent = await GeneratedContent.findOneAndDelete({ _id: id, user_id: req.user.id });

    if (!deletedContent) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({ success: true, message: 'Content deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
