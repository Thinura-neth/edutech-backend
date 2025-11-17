const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../utils/database');

const router = express.Router();

// Enroll in course
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { course_id } = req.body;
        const user_id = req.user.id;

        if (!course_id) {
            return res.status(400).json({ error: 'Course ID is required' });
        }

        // Check if course exists
        const course = await db.get('SELECT * FROM courses WHERE id = ?', [course_id]);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Check if already enrolled
        const existingEnrollment = await db.get(
            'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
            [user_id, course_id]
        );

        if (existingEnrollment) {
            return res.status(409).json({ error: 'Already enrolled in this course' });
        }

        // Create enrollment
        await db.run(
            'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [user_id, course_id]
        );

        // Log enrollment
        await db.run(
            'INSERT INTO user_logs (user_id, log_type, email, full_name, action) VALUES (?, ?, ?, ?, ?)',
            [user_id, 'COURSE_ENROLLMENT', req.user.email, req.user.full_name, `Enrolled in: ${course.title}`]
        );

        res.status(201).json({
            success: true,
            message: 'Successfully enrolled in course'
        });

    } catch (error) {
        console.error('Enrollment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's enrolled courses
router.get('/my-courses', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.id;

        const enrollments = await db.query(`
            SELECT e.*, c.title, c.description, c.price, c.duration_hours, c.category, c.image
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.user_id = ?
            ORDER BY e.enrolled_at DESC
        `, [user_id]);

        res.json({
            success: true,
            enrollments: enrollments
        });

    } catch (error) {
        console.error('Get user courses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update course progress
router.patch('/:courseId/progress', authenticateToken, async (req, res) => {
    try {
        const { courseId } = req.params;
        const { progress_percentage } = req.body;
        const user_id = req.user.id;

        if (progress_percentage === undefined || progress_percentage < 0 || progress_percentage > 100) {
            return res.status(400).json({ error: 'Progress percentage must be between 0 and 100' });
        }

        // Check if enrolled
        const enrollment = await db.get(
            'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
            [user_id, courseId]
        );

        if (!enrollment) {
            return res.status(404).json({ error: 'Not enrolled in this course' });
        }

        // Update progress
        await db.run(
            'UPDATE enrollments SET progress_percentage = ? WHERE user_id = ? AND course_id = ?',
            [progress_percentage, user_id, courseId]
        );

        res.json({
            success: true,
            message: 'Progress updated successfully'
        });

    } catch (error) {
        console.error('Update progress error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
