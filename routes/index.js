// routes/index.js
const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const userRoutes = require('./user');
const contactsRoutes = require('./contacts');
const dashboardRoutes = require('./dashboard');
const breaksRoutes = require('./breaks');
const sipRoutes = require('./sip');
const agentRoutes = require('./agents');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/user', authenticateToken, userRoutes);
router.use('/contacts', authenticateToken, contactsRoutes);
router.use('/dashboard', authenticateToken, dashboardRoutes);
router.use('/breaks', authenticateToken, breaksRoutes);
router.use('/sip', authenticateToken, sipRoutes);
router.use('/agent', authenticateToken, agentRoutes);

module.exports = router;