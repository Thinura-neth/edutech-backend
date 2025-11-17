const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../utils/database');

const router = express.Router();

// Get all courses
router.get('/', async (req, res) => {
    try {
        const courses = await db.query(
            'SELECT * FROM courses ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            courses: courses
        });

    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get course by ID
router.get('/:id', async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);

        const course = await db.get(
            'SELECT * FROM courses WHERE id = ?',
            [courseId]
        );

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json({
            success: true,
            course: course
        });

    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create course (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, price, duration_hours, category, image } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Course title is required' });
        }

        const result = await db.run(
            'INSERT INTO courses (title, description, price, duration_hours, category, image) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description || '', price || 0, duration_hours || 0, category || '', image || '📚']
        );

        const newCourse = await db.get('SELECT * FROM courses WHERE id = ?', [result.id]);

        res.status(201).json({
            success: true,
            message: 'Course created successfully',
            course: newCourse
        });

    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
