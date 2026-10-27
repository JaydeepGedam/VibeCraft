const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const GeneratedContent = require('../models/GeneratedContent');
const GeneratedHistory = require('../models/GeneratedHistory');

const User = require('../models/User');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Helper to get user-specific OpenAI client if BYOK (Bring Your Own Key) is configured
const getOpenAIClient = async (userId) => {
    if (userId) {
        try {
            const user = await User.findById(userId).select('preferences.customOpenAiKey').lean();
            const key = user?.preferences?.customOpenAiKey;
            if (key && key.trim().startsWith('sk-')) {
                return new OpenAI({ apiKey: key.trim() });
            }
        } catch (e) {
            // fallback to default
        }
    }
    return openai;
};

// Helper to convert numeric or raw mood into clear, descriptive instructions for the AI prompt
const getDescriptiveMood = (mood) => {
    if (typeof mood === 'number' || (!isNaN(mood) && typeof mood === 'string' && mood.trim() !== '')) {
        const num = Number(mood);
        if (num < 25) return 'Serious, authoritative, and analytical';
        if (num < 50) return 'Professional, balanced, and objective';
        if (num < 75) return 'Engaging, lively, and conversational';
        return 'Witty, humorous, and entertaining';
    }
    return mood || 'Balanced and engaging';
};

// Helper to verify generation quota for user (15 free generations, unlimited if BYOK)
const checkQuota = async (userId) => {
    if (!userId) return { allowed: true, hasCustomKey: false };
    const user = await User.findById(userId).select('preferences.customOpenAiKey generationsUsed freeGenerationLimit');
    if (!user) return { allowed: false, error: 'User not found' };

    const hasCustomKey = !!(user.preferences?.customOpenAiKey && user.preferences.customOpenAiKey.trim().startsWith('sk-'));
    if (hasCustomKey) {
        return { allowed: true, hasCustomKey: true, quota: { hasCustomKey: true } };
    }

    const limit = typeof user.freeGenerationLimit === 'number' ? user.freeGenerationLimit : 5;
    const used = typeof user.generationsUsed === 'number' ? user.generationsUsed : 0;

    if (used >= limit) {
        return {
            allowed: false,
            hasCustomKey: false,
            error: 'FREE_LIMIT_REACHED',
            message: `You have reached your limit of ${limit} free generations. Please add your own OpenAI API key in Settings to continue.`,
            quota: {
                generationsUsed: used,
                freeGenerationLimit: limit,
                remaining: 0,
                hasCustomKey: false
            }
        };
    }

    return {
        allowed: true,
        hasCustomKey: false,
        quota: {
            generationsUsed: used,
            freeGenerationLimit: limit,
            remaining: Math.max(0, limit - used),
            hasCustomKey: false
        }
    };
};

// Increment generation count by 1 (multi-variation counts as 1 credit per user choice)
const recordGenerationUsage = async (userId, hasCustomKey) => {
    if (!userId || hasCustomKey) return null;
    try {
        const updated = await User.findByIdAndUpdate(
            userId,
            { $inc: { generationsUsed: 1 } },
            { new: true }
        ).select('generationsUsed freeGenerationLimit');
        const limit = updated?.freeGenerationLimit ?? 5;
        const used = updated?.generationsUsed ?? 0;
        return {
            generationsUsed: used,
            freeGenerationLimit: limit,
            remaining: Math.max(0, limit - used),
            hasCustomKey: false
        };
    } catch (e) {
        console.error('Failed to record generation usage:', e);
        return null;
    }
};

// Save AI-generated content
router.post('/save', authMiddleware, async (req, res) => {
    const { topic, type, goal, tone, mood, audience, instructions, content, is_favorite, is_published, published_platform } = req.body;
    try {
        const newContent = await GeneratedContent.create({
            user_id: req.user.id,
            topic, type, goal, tone, mood, audience, instructions, content,
            is_favorite: !!is_favorite,
            is_published: !!is_published,
            published_at: is_published ? new Date() : undefined,
            published_platform: published_platform || ''
        });
        // Also save a copy to History collection so History is separate
        try {
          await GeneratedHistory.create({
            user_id: req.user.id,
            original_content_id: newContent._id,
            topic, type, goal, tone, mood, audience, instructions, content,
            is_published: !!is_published,
            published_platform: published_platform || ''
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

// Helper to construct in-depth, high-value prompt with explicit length and structure guidelines
const buildContentPrompt = ({ type, topic, tone, goal, descriptiveMood, audience = '', instructions = '', angleInstruction = '' }) => {
    const normalizedType = (type || '').toLowerCase();
    
    let formatGuidelines = '';
    if (normalizedType.includes('linkedin')) {
        formatGuidelines = `Format Guidelines:
- Length: Comprehensive, substantive, and impactful (approx. 200–350 words). NEVER write a short 2-sentence summary.
- Structure:
  1. A captivating opening hook (first 1–2 lines) that commands attention and stops scrolling.
  2. Short, readable paragraphs with breathing room and line spacing for mobile readability.
  3. 3–5 bulleted or numbered takeaways / actionable insights delivering genuine depth and value.
  4. An engaging closing thought or thought-provoking question to drive comments (Call to Action).
  5. 3–5 relevant, high-visibility hashtags at the very bottom.`;
    } else if (normalizedType.includes('blog')) {
        formatGuidelines = `Format Guidelines:
- Length: In-depth, well-developed blog post (approx. 350–550 words).
- Structure:
  1. Catchy headline (# Title).
  2. Engaging introduction setting the premise and context.
  3. 2–3 structured body sections with subheadings (## Section Title) providing concrete advice, examples, or frameworks.
  4. Strong summary conclusion with a clear call-to-action (CTA).`;
    } else if (normalizedType.includes('product')) {
        formatGuidelines = `Format Guidelines:
- Length: Persuasive, full-featured product description (approx. 150–250 words).
- Structure:
  1. Attention-grabbing tagline / hook.
  2. Compelling paragraph highlighting the specific problem and how the product solves it.
  3. Bulleted list of 4–6 core features with their practical and emotional benefits.
  4. High-conversion call-to-action (CTA).`;
    } else if (normalizedType.includes('twitter') || normalizedType.includes('thread')) {
        formatGuidelines = `Format Guidelines:
- Format: Engaging Twitter/X Thread.
- Length: 5–7 numbered tweets (e.g. 1/, 2/, ...).
- Each individual tweet must be punchy, standalone, and strictly under 260 characters.
- Structure:
  1. Hook tweet (1/) to stop the scroll and create curiosity.
  2. Body tweets delivering high-value insights, steps, or takeaways.
  3. Final tweet with a recap and a strong call-to-action (CTA).`;
    } else if (normalizedType.includes('email') || normalizedType.includes('cold email')) {
        formatGuidelines = `Format Guidelines:
- Format: High-converting Cold Email.
- Length: Concise and focused (100–180 words).
- Structure:
  1. 2–3 catchy Subject Line options.
  2. Personalized opening hook / pattern interrupt.
  3. Clear value proposition focused on benefits and pain points.
  4. Low-friction Call to Action (e.g., "Open to a 5-minute chat next Tuesday?").`;
    } else if (normalizedType.includes('instagram') || normalizedType.includes('caption')) {
        formatGuidelines = `Format Guidelines:
- Format: Engaging Instagram Caption.
- Length: 150–250 words.
- Structure:
  1. Bold, scroll-stopping first line (hook visible before "...more").
  2. Relatable storytelling or micro-insights with clean line breaks and emojis.
  3. Community question / comment CTA.
  4. 15–20 relevant, categorized hashtags at the end.`;
    } else {
        formatGuidelines = `Format Guidelines:
- Length: Comprehensive and substantial (approx. 200–300 words).
- Include an introduction, structured body with clear key points, and strong conclusion.`;
    }

    return `Create a complete, high-quality, ready-to-publish ${type} about "${topic}".

Tone: ${tone}
Goal: ${goal}
Mood: ${descriptiveMood}
${audience ? `Target Audience: ${audience}\n` : ''}${instructions ? `Specific User Instructions & Key Points to Include:\n${instructions}\n` : ''}${angleInstruction ? `Approach Angle: ${angleInstruction}\n` : ''}${formatGuidelines}

Important Instructions:
- Write the FULL, complete content directly.
- NEVER produce short, superficial summaries, teaser outlines, or placeholders.
- Use natural spacing and tasteful emojis where fitting for the tone.
- Do NOT include conversational preamble like "Here is your post:".`;
};

// Generate content via OpenAI (supports full-length multi-variation)
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        const quotaStatus = await checkQuota(req.user.id);
        if (!quotaStatus.allowed) {
            return res.status(403).json({
                error: quotaStatus.error || 'FREE_LIMIT_REACHED',
                message: quotaStatus.message,
                quota: quotaStatus.quota
            });
        }

        const { topic, type, goal, tone, mood, audience, instructions, count = 1 } = req.body;
        const descriptiveMood = getDescriptiveMood(mood);
        const variationCount = Math.min(3, Math.max(1, parseInt(count) || 1));
        const aiClient = await getOpenAIClient(req.user.id);
        
        if (variationCount > 1) {
            const angles = [
                'Angle 1 (Storytelling & Experience): Start with a relatable scenario, personal experience, or practical observation before revealing the key lessons.',
                'Angle 2 (Actionable Framework & Best Practices): Jump straight into a high-impact, practical, step-by-step breakdown with clear bullet points.',
                'Angle 3 (Contrarian & Thought-Provoking): Challenge a common myth or conventional industry belief with fresh counter-intuitive insights.'
            ];

            // Generate full-length variations in parallel for maximum depth and fast speed
            const variationPromises = angles.slice(0, variationCount).map(async (angleInstruction) => {
                const prompt = buildContentPrompt({
                    type,
                    topic,
                    tone,
                    goal,
                    descriptiveMood,
                    audience,
                    instructions,
                    angleInstruction
                });

                const completion = await aiClient.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are an elite copywriter and content strategist. You write thorough, high-converting, publication-ready content with substantial depth. Never write shallow summaries." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 1200,
                    temperature: 0.75
                });

                return completion.choices[0].message.content.trim();
            });

            const results = await Promise.all(variationPromises);

            const newQuota = await recordGenerationUsage(req.user.id, quotaStatus.hasCustomKey);

            return res.json({
                content: results[0],
                variations: results,
                quota: newQuota || quotaStatus.quota
            });
        }

        const prompt = buildContentPrompt({
            type,
            topic,
            tone,
            goal,
            descriptiveMood,
            audience,
            instructions
        });
        
        const completion = await aiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an elite copywriter and content strategist. Never produce brief summaries. Always write complete, in-depth content." },
                { role: "user", content: prompt }
            ],
            max_tokens: 1200,
            temperature: 0.7
        });

        const generatedContent = completion.choices[0].message.content.trim();
        const newQuota = await recordGenerationUsage(req.user.id, quotaStatus.hasCustomKey);

        res.json({
            content: generatedContent,
            variations: [generatedContent],
            quota: newQuota || quotaStatus.quota
        });
    } catch (err) {
        console.error('AI generation failed:', err);
        res.status(500).json({ error: 'AI generation failed' });
    }
});

// Stream AI generation in real-time (Server-Sent Events)
router.post('/generate-stream', authMiddleware, async (req, res) => {
    try {
        const quotaStatus = await checkQuota(req.user.id);
        if (!quotaStatus.allowed) {
            return res.status(403).json({
                error: quotaStatus.error || 'FREE_LIMIT_REACHED',
                message: quotaStatus.message,
                quota: quotaStatus.quota
            });
        }

        const { topic, type, goal, tone, mood, audience, instructions } = req.body;
        const descriptiveMood = getDescriptiveMood(mood);
        const prompt = buildContentPrompt({
            type,
            topic,
            tone,
            goal,
            descriptiveMood,
            audience,
            instructions
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') res.flushHeaders();

        const aiClient = await getOpenAIClient(req.user.id);

        const stream = await aiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an elite copywriter and content strategist. Never produce brief summaries. Always write complete, in-depth content." },
                { role: "user", content: prompt }
            ],
            stream: true,
            max_tokens: 1500,
            temperature: 0.7
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
                res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
            }
        }

        const newQuota = await recordGenerationUsage(req.user.id, quotaStatus.hasCustomKey);
        if (newQuota) {
            res.write(`data: ${JSON.stringify({ quota: newQuota })}\n\n`);
        }

        res.write(`data: [DONE]\n\n`);
        res.end();
    } catch (err) {
        console.error('Streaming error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Streaming AI generation failed' });
        } else {
            res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
            res.end();
        }
    }
});

// Quick AI Polish and Refinement
router.post('/refine', authMiddleware, async (req, res) => {
    try {
        const { content, action, instruction } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Content is required for refinement' });
        }

        let instructionText = '';
        switch (action) {
            case 'shorten':
                instructionText = 'Make this content more concise and punchy. Trim unnecessary fluff and filler while preserving all core value, takeaways, and tone.';
                break;
            case 'expand':
                instructionText = 'Elaborate and expand on this content. Add depth, actionable real-world examples, and compelling explanations while maintaining natural flow.';
                break;
            case 'emojis':
                instructionText = 'Add tasteful, modern, and engaging emojis alongside clean line breaks to optimize readability and engagement for social platforms.';
                break;
            case 'fix_grammar':
                instructionText = 'Carefully polish and fix any grammatical errors, awkward phrasing, or spelling mistakes while preserving the exact tone and voice.';
                break;
            case 'hashtags':
                instructionText = 'Analyze this content and generate 6-10 highly relevant, trending, and platform-optimized hashtags for discovery and reach. Return the original content followed by a clean blank line and the hashtags.';
                break;
            default:
                instructionText = instruction || 'Improve and polish this content.';
        }

        const prompt = `You are an expert editor and content strategist.
Original Content:
"""
${content}
"""

Task:
${instructionText}

Return ONLY the final polished content without introductory remarks or conversational wrappers.`;

        const aiClient = await getOpenAIClient(req.user.id);
        const completion = await aiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1500,
            temperature: 0.6
        });

        const refinedContent = completion.choices[0].message.content.trim();
        res.json({ content: refinedContent });
    } catch (err) {
        console.error('Refine error:', err);
        res.status(500).json({ error: 'Failed to refine content' });
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


// Toggle favorite
router.patch('/:id/favorite', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid content id' });
  }
  try {
    const item = await GeneratedContent.findOne({ _id: id, user_id: req.user.id });
    if (!item) return res.status(404).json({ error: 'Content not found' });
    item.is_favorite = !item.is_favorite;
    await item.save();
    res.json({ success: true, is_favorite: item.is_favorite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark content as published (e.g. to LinkedIn)
router.patch('/:id/published', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { platform = 'LinkedIn' } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid content id' });
  }
  try {
    const item = await GeneratedContent.findOne({ _id: id, user_id: req.user.id });
    if (!item) return res.status(404).json({ error: 'Content not found' });
    item.is_published = true;
    item.published_at = new Date();
    item.published_platform = platform;
    await item.save();

    try {
      await GeneratedHistory.updateMany(
        { original_content_id: item._id, user_id: req.user.id },
        { is_published: true, published_platform: platform }
      );
    } catch (hErr) {
      console.error('Failed to update history published state:', hErr);
    }

    res.json({ success: true, is_published: true, published_platform: platform, published_at: item.published_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Schedule content to be auto-published
router.post('/schedule', authMiddleware, async (req, res) => {
  try {
    const {
      contentId,
      topic,
      type,
      goal,
      tone,
      mood,
      audience,
      instructions,
      content,
      scheduledAt,
      platform = 'LinkedIn'
    } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required to schedule' });
    }
    if (!scheduledAt) {
      return res.status(400).json({ error: 'Scheduled date and time is required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduled date' });
    }

    const now = new Date();
    if (scheduledDate.getTime() <= now.getTime()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    // If scheduling for LinkedIn, check that user has connected LinkedIn
    if (platform === 'LinkedIn') {
      const user = await User.findById(req.user.id).select('linkedIn').lean();
      if (!user?.linkedIn?.accessToken) {
        return res.status(400).json({
          error: 'Please connect your LinkedIn account first to schedule LinkedIn posts.'
        });
      }
    }

    let contentDoc;
    if (contentId && mongoose.Types.ObjectId.isValid(contentId)) {
      contentDoc = await GeneratedContent.findOne({ _id: contentId, user_id: req.user.id });
    }

    if (contentDoc) {
      contentDoc.topic = topic || contentDoc.topic;
      contentDoc.type = type || contentDoc.type;
      contentDoc.goal = goal || contentDoc.goal;
      contentDoc.tone = tone || contentDoc.tone;
      contentDoc.mood = mood !== undefined ? String(mood) : contentDoc.mood;
      contentDoc.audience = audience || contentDoc.audience;
      contentDoc.instructions = instructions !== undefined ? instructions : contentDoc.instructions;
      contentDoc.content = content;
      contentDoc.is_scheduled = true;
      contentDoc.scheduled_at = scheduledDate;
      contentDoc.scheduled_platform = platform;
      contentDoc.schedule_status = 'pending';
      contentDoc.schedule_error = '';
      contentDoc.is_published = false;
      await contentDoc.save();
    } else {
      contentDoc = new GeneratedContent({
        user_id: req.user.id,
        topic: topic || 'Scheduled Post',
        type: type || 'LinkedIn',
        goal: goal || 'Educate',
        tone: tone || 'Professional',
        mood: mood !== undefined ? String(mood) : '50',
        audience: audience || 'General',
        instructions: instructions || '',
        content,
        is_scheduled: true,
        scheduled_at: scheduledDate,
        scheduled_platform: platform,
        schedule_status: 'pending',
        schedule_error: '',
        is_published: false
      });
      await contentDoc.save();
    }

    res.json({
      success: true,
      content: contentDoc,
      message: `Post successfully scheduled for ${scheduledDate.toLocaleString()}`
    });
  } catch (err) {
    console.error('Schedule error:', err);
    res.status(500).json({ error: 'Failed to schedule post' });
  }
});

// Cancel a scheduled post
router.post('/cancel-schedule/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid content id' });
  }
  try {
    const item = await GeneratedContent.findOne({ _id: id, user_id: req.user.id });
    if (!item) return res.status(404).json({ error: 'Content not found' });
    item.is_scheduled = false;
    item.schedule_status = 'none';
    item.schedule_error = '';
    await item.save();
    res.json({ success: true, message: 'Scheduled post cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's scheduled posts
router.get('/scheduled/all', authMiddleware, async (req, res) => {
  try {
    const items = await GeneratedContent.find({
      user_id: req.user.id,
      is_scheduled: true,
      schedule_status: 'pending'
    }).sort({ scheduled_at: 1 });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
