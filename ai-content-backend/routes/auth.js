const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/hash');

// Signup
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    console.log('POST /auth/signup body:', req.body);
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

    try {
        const hashed = await hashPassword(password);
        const newUser = new User({ name, email, password: hashed });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        // return a safe user object (omit password)
        const userSafe = { _id: newUser._id, name: newUser.name, email: newUser.email };
        res.json({ token, user: userSafe });
    } catch (err) {
        console.error('Signup error:', err);
        // if duplicate key
        if (err.code === 11000) return res.status(400).json({ error: 'Email already registered' });
        res.status(500).json({ error: 'User already exists or DB error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('POST /auth/login body:', req.body);
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

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
