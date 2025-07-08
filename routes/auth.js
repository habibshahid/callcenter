// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { generateToken, revokeToken, authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const { loginValidation, validateRequest } = require('../middleware/validation');
const AMIService = require('../utils/ami');

router.post('/login', loginValidation, validateRequest, async (req, res) => {
  try {
    const { username, password } = req.body;
    // Get user with extension
    const [users] = await db.query(
      'SELECT id, username, password, email, first_name, last_name, extension, is_active FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
   
    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = await generateToken(user, req);

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Remove sensitive data
    delete user.password;

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        extension: user.extension  // Include extension in response
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Logout route
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const sipInterface = `PJSIP/${req.user.extension}`;

    // Get user's queues
    const [agentQueues] = await db.query(
      'SELECT q.name FROM queues q ' +
      'JOIN queue_agent_memberships qam ON qam.queue_id = q.id ' +
      'WHERE qam.agent_id = ?',
      [req.user.id]
    );
    console.log(agentQueues)
    // Remove from all queues
    for (const queue of agentQueues) {
      try {
        // Remove from queue_members table
        await db.query(
          'DELETE FROM queue_members WHERE interface = ? AND queue_name = ?',
          [sipInterface, queue.name]
        );
        
        await db.query(
          'UPDATE users SET current_status = "Off-Queue", current_break_id = NULL WHERE id = ?',
          [req.user.id]
        );
        
        // Remove from Asterisk queue
        await AMIService.action({
          Action: 'QueueRemove',
          Queue: queue.name,
          Interface: sipInterface
        });
            
        console.log({
          Action: 'QueueRemove',
          Queue: queue.name,
          Interface: sipInterface
        })
      } catch (error) {
        console.error(`Error removing from queue ${queue.name}:`, error);
      }
    }

    // Revoke token if you're using token blacklist
    if (req.tokenId) {
      await revokeToken(req.tokenId);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error during logout' });
  }
});

module.exports = router;