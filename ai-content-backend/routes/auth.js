const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const PendingSignup = require('../models/PendingSignup');
const { hashPassword, comparePassword } = require('../utils/hash');

// Generate a cryptographically random 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const buildOtpEmailHtml = (otp) => `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f0f0f;border-radius:12px;color:#fff;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
            <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;padding:8px;display:inline-block;">
                <span style="font-size:20px;">✦</span>
            </div>
            <span style="font-size:22px;font-weight:700;color:#8b5cf6;margin-left:8px;">VibeCraft</span>
        </div>
        <h2 style="font-size:20px;margin:0 0 8px;">Verify your email</h2>
        <p style="color:#a0a0a0;margin:0 0 28px;font-size:15px;">Enter the code below to complete your VibeCraft signup. It expires in <strong style="color:#fff;">10 minutes</strong>.</p>
        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px;">
            <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#8b5cf6;">${otp}</span>
        </div>
        <p style="color:#666;font-size:13px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
    </div>
`;

const sendOtpEmail = async ({ email, otp }) => {
    const payload = {
        sender: {
            name: 'VibeCraft',
            email: process.env.SENDER_EMAIL || process.env.GMAIL_USER
        },
        to: [{ email }],
        subject: 'Your VibeCraft verification code',
        htmlContent: buildOtpEmailHtml(otp)
    };

    const brevoHeaders = {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
    };

    try {
        if (process.env.BREVO_API_KEY && process.env.SENDER_EMAIL) {
            await axios.post('https://api.brevo.com/v3/smtp/email', payload, { headers: brevoHeaders });
            return;
        }
    } catch (error) {
        const status = error.response?.status;
        const isAuthFailure = status === 401 || status === 403 || !process.env.BREVO_API_KEY;

        if (!isAuthFailure) {
            throw error;
        }

        const gmailUser = process.env.GMAIL_USER;
        const gmailPass = process.env.GMAIL_APP_PASSWORD;

        if (!gmailUser || !gmailPass) {
            throw error;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });

        await transporter.sendMail({
            from: `"VibeCraft" <${gmailUser}>`,
            to: email,
            subject: 'Your VibeCraft verification code',
            html: buildOtpEmailHtml(otp)
        });
        return;
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
        throw new Error('OTP delivery provider is not configured. Set BREVO_API_KEY/SENDER_EMAIL or GMAIL credentials.');
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailUser,
            pass: gmailPass
        }
    });

    await transporter.sendMail({
        from: `"VibeCraft" <${gmailUser}>`,
        to: email,
        subject: 'Your VibeCraft verification code',
        html: buildOtpEmailHtml(otp)
    });
};

// Mask email for display in the UI (e.g. j***p@gmail.com)
const maskEmail = (email) => {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
};

// Step 1: Validate fields, check for duplicate, store pending signup, send OTP email
router.post('/send-otp', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }

    // Password strength validation
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongPasswordRegex.test(password)) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters and include uppercase, lowercase, number and symbol.'
        });
    }

    try {
        // Check if a verified account already exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists. Please login.' });
        }

        const otp = generateOtp();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const hashedPassword = await hashPassword(password);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Upsert pending signup (overwrite if they re-request OTP)
        await PendingSignup.findOneAndUpdate(
            { email },
            { name, hashedPassword, hashedOtp, expiresAt },
            { upsert: true, new: true }
        );

        // Send OTP email via the configured provider, falling back if Brevo rejects the key.
        await sendOtpEmail({ email, otp });

        res.json({
            success: true,
            maskedEmail: maskEmail(email),
            message: 'OTP sent to your email address'
        });
    } catch (err) {
        console.error('Send OTP error:', err);
        await PendingSignup.deleteOne({ email }).catch(() => {});
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Email already exists. Please login.' });
        }
        return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }
});

// Step 2: Verify OTP and create real user account
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    try {
        const pending = await PendingSignup.findOne({ email });
        if (!pending) {
            return res.status(400).json({ error: 'No pending signup found. Please sign up again.' });
        }

        // Check expiry
        if (new Date() > pending.expiresAt) {
            await PendingSignup.deleteOne({ email });
            return res.status(400).json({ error: 'OTP has expired. Please sign up again.' });
        }

        // Verify OTP
        const isValid = await bcrypt.compare(otp.trim(), pending.hashedOtp);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
        }

        // Double-check no account was created in the meantime
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            await PendingSignup.deleteOne({ email });
            return res.status(400).json({ error: 'Email already exists. Please login.' });
        }

        // Create the real user
        const newUser = new User({
            name: pending.name,
            email,
            password: pending.hashedPassword
        });
        await newUser.save();

        // Clean up pending record
        await PendingSignup.deleteOne({ email });

        const token = jwt.sign({ id: newUser._id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const userSafe = { _id: newUser._id, name: newUser.name, email: newUser.email };
        res.json({ token, user: userSafe });
    } catch (err) {
        console.error('Verify OTP error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Email already exists. Please login.' });
        }
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
});

// Login (unchanged)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('POST /auth/login email:', email);
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "User doesn't exist, please sign up" });

        const valid = await comparePassword(password, user.password);
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const userSafe = { _id: user._id, name: user.name, email: user.email };
        res.json({ token, user: userSafe });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
