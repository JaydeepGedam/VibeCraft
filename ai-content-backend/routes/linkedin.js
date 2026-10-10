const express = require('express');
const axios = require('axios');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// LinkedIn OAuth URLs
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';

// Get LinkedIn auth URL
router.get('/auth-url', authMiddleware, (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const scope = 'openid profile email w_member_social';
  const redirectTo = req.query.redirect_to === 'generate' ? 'generate' : 'settings';
  const state = `${req.user.id}__${redirectTo}`;
  
  const authUrl = `${LINKEDIN_AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  
  res.json({ authUrl });
});

// Handle LinkedIn OAuth callback (GET request from LinkedIn redirect)
router.get('/callback', async (req, res) => {
  try {
    console.log('LI callback query:', req.query);
    const { code, state, error } = req.query;
    const [userId, targetPage] = (state || '').split('__');
    const redirectPath = targetPage === 'generate' ? '/generate' : '/settings';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    if (error) {
      return res.redirect(`${frontendUrl}${redirectPath}?linkedin_error=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state || !userId) {
      return res.redirect(`${frontendUrl}${redirectPath}?linkedin_error=missing_params`);
    }
    
    // Exchange code for access token
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI
    });
    
    const tokenResponse = await axios.post(LINKEDIN_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const { access_token, refresh_token } = tokenResponse.data;
    console.log('LI token OK for state:', state);
    
    // Get user profile
    const profileResponse = await axios.get(`${LINKEDIN_API_URL}/userinfo`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    const profile = profileResponse.data;
    
    // Get person URN for posting (required for UGC Posts API)
    let personUrn = profile.sub;
    if (!personUrn.startsWith('urn:li:person:')) {
      personUrn = `urn:li:person:${personUrn}`;
    }
    
    // Enforce one-to-one LinkedIn profile per Vibecraft user
    const existing = await User.findOne({ 'linkedIn.profileId': personUrn }, { _id: 1 }).lean();
    if (existing && existing._id.toString() !== userId) {
      return res.redirect(`${frontendUrl}${redirectPath}?linkedin_error=already_linked`);
    }

    // Update user with LinkedIn data (using userId)
    await User.findByIdAndUpdate(userId, {
      linkedIn: {
        accessToken: access_token,
        refreshToken: refresh_token,
        profileId: personUrn,
        profileName: profile.name,
        connectedAt: new Date(),
      },
    });
    console.log('LI update successful for user:', userId);
    
    // Redirect to frontend with success
    res.redirect(`${frontendUrl}${redirectPath}?linkedin_success=true`);
  } catch (error) {
    console.error('LinkedIn callback error:', error.response?.data || error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(`${frontendUrl}/settings?linkedin_error=connection_failed`);
  }
});

// Handle LinkedIn OAuth callback (POST for manual flow)
router.post('/callback', authMiddleware, async (req, res) => {
  try {
    const { code, state } = req.body;
    
    // Verify state matches user ID
    if (state !== req.user.id) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    // Exchange code for access token
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI
    });
    
    const tokenResponse = await axios.post(LINKEDIN_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const { access_token, refresh_token } = tokenResponse.data;
    
    // Get user profile
    const profileResponse = await axios.get(`${LINKEDIN_API_URL}/userinfo`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    const profile = profileResponse.data;
    
    // Get person URN for posting
    let personUrn = profile.sub;
    if (!personUrn.startsWith('urn:li:person:')) {
      personUrn = `urn:li:person:${personUrn}`;
    }
    
    // Enforce one-to-one LinkedIn profile per Vibecraft user
    const existing = await User.findOne({ 'linkedIn.profileId': personUrn }, { _id: 1 }).lean();
    if (existing && existing._id.toString() !== req.user.id) {
      return res.status(400).json({ error: 'already_linked' });
    }

    // Update user with LinkedIn data
    await User.findByIdAndUpdate(req.user.id, {
      linkedIn: {
        accessToken: access_token,
        refreshToken: refresh_token,
        profileId: personUrn,
        profileName: profile.name,
        connectedAt: new Date()
      }
    });
    
    res.json({ 
      success: true, 
      profile: { 
        name: profile.name,
        email: profile.email 
      }
    });
  } catch (error) {
    console.error('LinkedIn callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to connect LinkedIn account' });
  }
});

// Get LinkedIn connection status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    console.log('LI status check user:', req.user.id, 'linkedIn:', user?.linkedIn);
    const isConnected = !!(user && user.linkedIn && user.linkedIn.accessToken);
    
    res.json({
      isConnected,
      profile: isConnected ? {
        name: user.linkedIn.profileName,
        connectedAt: user.linkedIn.connectedAt
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get LinkedIn status' });
  }
});

// Disconnect LinkedIn
router.delete('/disconnect', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $unset: { linkedIn: 1 } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect LinkedIn account' });
  }
});

// Helper to post using modern LinkedIn REST Posts API
const tryRestPost = async (accessToken, authorUrn, content) => {
  return axios.post('https://api.linkedin.com/rest/posts', {
    author: authorUrn,
    commentary: content,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  }, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });
};

// Helper to post using legacy UGC Posts API
const tryUgcPost = async (accessToken, authorUrn, content) => {
  const postData = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: content
        },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };
  return axios.post(`${LINKEDIN_API_URL}/ugcPosts`, postData, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });
};

// Helper to refresh expired LinkedIn access token
const refreshLinkedInToken = async (user) => {
  if (!user.linkedIn?.refreshToken) return null;
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.linkedIn.refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    });
    const res = await axios.post(LINKEDIN_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token, refresh_token } = res.data;
    await User.findByIdAndUpdate(user._id, {
      'linkedIn.accessToken': access_token,
      ...(refresh_token ? { 'linkedIn.refreshToken': refresh_token } : {})
    });
    return access_token;
  } catch (err) {
    console.error('Failed to auto-refresh LinkedIn token:', err.response?.data || err.message);
    return null;
  }
};

// Reusable helper to post content for a given user
const postToLinkedInForUser = async (user, content) => {
  if (!user || !user.linkedIn || !user.linkedIn.accessToken) {
    throw new Error('LinkedIn account not connected');
  }

  let authorUrn = user.linkedIn.profileId;
  if (!authorUrn.startsWith('urn:li:person:')) {
    authorUrn = `urn:li:person:${authorUrn}`;
  }

  let accessToken = user.linkedIn.accessToken;
  let response;
  let postMethod = 'ugc';

  try {
    response = await tryUgcPost(accessToken, authorUrn, content);
  } catch (ugcErr) {
    console.warn('UGC post attempt failed, attempting fallback to REST Posts API...', ugcErr.response?.data || ugcErr.message);

    if (ugcErr.response?.status === 401) {
      const refreshed = await refreshLinkedInToken(user);
      if (refreshed) {
        accessToken = refreshed;
      } else {
        throw new Error('LinkedIn token expired. Please reconnect your account in Settings.');
      }
    }

    try {
      response = await tryRestPost(accessToken, authorUrn, content);
      postMethod = 'rest';
    } catch (restErr) {
      console.error('LinkedIn REST Post error:', restErr.response?.data || restErr.message);
      const errData = restErr.response?.data || ugcErr.response?.data;
      const msg = errData?.message || errData?.errorDetails?.message || errData?.description || restErr.message;
      throw new Error(`Failed to post to LinkedIn: ${msg}`);
    }
  }

  const postId = response.data?.id || response.headers?.['x-restli-id'] || 'published';
  return { postId, method: postMethod };
};

// Post to LinkedIn
router.post('/post', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const user = await User.findById(req.user.id).lean();
    const result = await postToLinkedInForUser(user, content);
    res.json({
      success: true,
      postId: result.postId,
      method: result.method,
      message: 'Posted to LinkedIn successfully!'
    });
  } catch (error) {
    console.error('LinkedIn post error:', error.message);
    const status = error.message.includes('expired') || error.message.includes('not connected') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to post to LinkedIn' });
  }
});

router.postToLinkedInForUser = postToLinkedInForUser;
module.exports = router;
module.exports.postToLinkedInForUser = postToLinkedInForUser;


