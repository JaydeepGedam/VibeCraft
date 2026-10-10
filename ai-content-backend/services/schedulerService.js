const GeneratedContent = require('../models/GeneratedContent');
const User = require('../models/User');
const { postToLinkedInForUser } = require('../routes/linkedin');

let intervalId = null;
let isProcessing = false;

const processDuePosts = async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const now = new Date();
    const duePosts = await GeneratedContent.find({
      is_scheduled: true,
      schedule_status: 'pending',
      scheduled_at: { $lte: now }
    }).limit(10);

    for (const post of duePosts) {
      try {
        const user = await User.findById(post.user_id).lean();
        if (!user) {
          post.schedule_status = 'failed';
          post.schedule_error = 'User not found';
          await post.save();
          continue;
        }

        if (post.scheduled_platform === 'LinkedIn') {
          if (!user.linkedIn || !user.linkedIn.accessToken) {
            post.schedule_status = 'failed';
            post.schedule_error = 'LinkedIn account is disconnected';
            await post.save();
            continue;
          }

          console.log(`[Scheduler] Auto-publishing post ${post._id} for user ${user._id} to LinkedIn...`);
          await postToLinkedInForUser(user, post.content);

          post.is_published = true;
          post.published_at = new Date();
          post.published_platform = 'LinkedIn';
          post.schedule_status = 'published';
          post.is_scheduled = false;
          post.schedule_error = '';
          await post.save();
          console.log(`[Scheduler] Post ${post._id} auto-published successfully!`);
        } else {
          post.is_published = true;
          post.published_at = new Date();
          post.schedule_status = 'published';
          post.is_scheduled = false;
          await post.save();
        }
      } catch (postErr) {
        console.error(`[Scheduler] Failed to publish post ${post._id}:`, postErr.message);
        post.schedule_status = 'failed';
        post.schedule_error = postErr.message || 'Auto-publishing failed';
        await post.save();
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error checking due posts:', err);
  } finally {
    isProcessing = false;
  }
};

const start = () => {
  if (intervalId) return;
  console.log('[Scheduler] Background post scheduler started (checking every 30s)...');
  setTimeout(processDuePosts, 5000);
  intervalId = setInterval(processDuePosts, 30000);
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

module.exports = { start, stop, processDuePosts };
