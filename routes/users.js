const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../utils/database');

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await db.query(
            'SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            users: users,
            count: users.length
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Users can only view their own profile unless admin
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const user = await db.get(
            'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: user
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Prevent self-deletion
        if (req.user.id === userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Get user info before deletion for logging
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ error: 'Cannot delete admin accounts' });
        }

        // Delete user
        await db.run('DELETE FROM users WHERE id = ?', [userId]);

        // Log deletion
        await db.run(
            'INSERT INTO user_logs (user_id, log_type, email, full_name, action) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'USER_DELETED', user.email, user.full_name, `User deleted by admin: ${req.user.email}`]
        );

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user logs (Admin only)
router.get('/:id/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const logs = await db.query(
            'SELECT * FROM user_logs WHERE user_id = ? ORDER BY logged_at DESC',
            [userId]
        );

        res.json({
            success: true,
            logs: logs
        });

    } catch (error) {
        console.error('Get user logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
