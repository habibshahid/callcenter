// routes/breaks.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Get all breaks
router.get('/', async (req, res) => {
  try {
    const [breaks] = await db.query(
      'SELECT * FROM breaks WHERE is_active = true ORDER BY name'
    );
    res.json(breaks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching breaks' });
  }
});

// Set agent status/break
router.post('/status', async (req, res) => {
  try {
    const { breakId } = req.body;
    
    if (breakId) {
      // Setting break
      await db.query(
        'UPDATE users SET current_break_id = ?, break_started_at = NOW() WHERE id = ?',
        [breakId, req.user.id]
      );

      // Log break start
      await db.query(
        'INSERT INTO break_logs (user_id, break_id, started_at) VALUES (?, ?, NOW())',
        [req.user.id, breakId]
      );
    } else {
      // Ending break
      const [currentBreak] = await db.query(
        'SELECT current_break_id, break_started_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (currentBreak[0].current_break_id) {
        // Update break log with end time
        await db.query(
          `UPDATE break_logs 
           SET ended_at = NOW(),
               duration = TIMESTAMPDIFF(MINUTE, started_at, NOW())
           WHERE user_id = ? 
           AND break_id = ? 
           AND ended_at IS NULL`,
          [req.user.id, currentBreak[0].current_break_id]
        );
      }

      // Clear break status
      await db.query(
        'UPDATE users SET current_break_id = NULL, break_started_at = NULL WHERE id = ?',
        [req.user.id]
      );
    }

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ message: 'Error updating status' });
  }
});

// Get agent's break history
router.get('/history', async (req, res) => {
  try {
    const [history] = await db.query(`
      SELECT 
        bl.*,
        b.name as break_name,
        b.duration_minutes as expected_duration
      FROM break_logs bl
      JOIN breaks b ON bl.break_id = b.id
      WHERE bl.user_id = ?
      ORDER BY bl.started_at DESC
      LIMIT 50
    `, [req.user.id]);

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching break history' });
  }
});

module.exports = router;