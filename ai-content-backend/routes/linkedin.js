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
  const state = req.user.id; // Use user ID as state for security
  
  const authUrl = `${LINKEDIN_AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  
  res.json({ authUrl });
});

// Handle LinkedIn OAuth callback (GET request from LinkedIn redirect)
router.get('/callback', async (req, res) => {
  try {
    console.log('LI callback query:', req.query);
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?linkedin_error=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?linkedin_error=missing_params`);
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
    if (existing && existing._id.toString() !== state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?linkedin_error=already_linked`);
    }

    // Update user with LinkedIn data (using state as user ID)
    await User.findByIdAndUpdate(state, {
      linkedIn: {
        accessToken: access_token,
        refreshToken: refresh_token,
        profileId: personUrn,
        profileName: profile.name,
        connectedAt: new Date(),
      },
    });
    const fetched = await User.findById(state).lean();
    console.log('LI update result: fetched linkedIn =', fetched?.linkedIn);
    
    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?linkedin_success=true`);
  } catch (error) {
    console.error('LinkedIn callback error:', error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?linkedin_error=connection_failed`);
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

// Post to LinkedIn
router.post('/post', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const user = await User.findById(req.user.id).lean();
    
    if (!user.linkedIn || !user.linkedIn.accessToken) {
      return res.status(400).json({ error: 'LinkedIn account not connected' });
    }
    
    // Ensure profileId is in correct format
    let authorUrn = user.linkedIn.profileId;
    if (!authorUrn.startsWith('urn:li:person:')) {
      authorUrn = `urn:li:person:${authorUrn}`;
    }
    
    // Create LinkedIn post using UGC Posts API
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
    
    const response = await axios.post(`${LINKEDIN_API_URL}/ugcPosts`, postData, {
      headers: {
        'Authorization': `Bearer ${user.linkedIn.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    
    res.json({ 
      success: true, 
      postId: response.data.id,
      message: 'Posted to LinkedIn successfully!' 
    });
  } catch (error) {
    console.error('LinkedIn post error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      res.status(401).json({ error: 'LinkedIn token expired. Please reconnect your account.' });
    } else if (error.response?.data) {
      res.status(error.response.status).json({ 
        error: error.response.data.message || 'Failed to post to LinkedIn',
        details: error.response.data
      });
    } else {
      res.status(500).json({ error: 'Failed to post to LinkedIn' });
    }
  }
});

module.exports = router;


