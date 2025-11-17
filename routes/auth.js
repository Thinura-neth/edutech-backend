const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../utils/database');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await db.get(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Log login
        await db.run(
            'INSERT INTO user_logs (user_id, log_type, email, full_name, action) VALUES (?, ?, ?, ?, ?)',
            [user.id, 'LOGIN', user.email, user.full_name, 'User logged in']
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        const existingUser = await db.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            return res.status(409).json({ error: 'User already exists with this email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const result = await db.run(
            'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
            [email, hashedPassword, full_name || '']
        );

        // Log registration
        await db.run(
            'INSERT INTO user_logs (user_id, log_type, email, full_name, action) VALUES (?, ?, ?, ?, ?)',
            [result.id, 'REGISTRATION', email, full_name || '', 'New user registration']
        );

        // Generate token for auto-login
        const token = jwt.sign(
            { 
                id: result.id, 
                email: email, 
                role: 'user' 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: result.id,
                email: email,
                full_name: full_name || '',
                role: 'user'
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify token
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await db.get(
            'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: user
        });

    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
