// routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Get overall dashboard stats
router.get('/stats', async (req, res) => {
  try {
    // Get active calls count
    const [activeCalls] = await db.query(
      'SELECT COUNT(*) as count FROM contacts WHERE status = "active"'
    );

    // Get waiting calls
    const [waitingCalls] = await db.query(
      'SELECT COUNT(*) as count FROM contacts WHERE status = "waiting"'
    );

    // Get average wait time
    const [avgWaitTime] = await db.query(`
      SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, connected_at)) as avg_wait_time 
      FROM contacts 
      WHERE DATE(created_at) = CURDATE() 
      AND connected_at IS NOT NULL
    `);

    // Get resolved calls today
    const [resolvedCalls] = await db.query(`
      SELECT COUNT(*) as count 
      FROM contacts 
      WHERE DATE(ended_at) = CURDATE() 
      AND status = "ended"
    `);

    res.json({
      activeCalls: activeCalls[0].count,
      waitingCalls: waitingCalls[0].count,
      averageWaitTime: avgWaitTime[0].avg_wait_time || 0,
      resolvedToday: resolvedCalls[0].count
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
});

// Get active agents and their status
router.get('/active-agents', async (req, res) => {
  try {
    const [agents] = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.last_login,
        COALESCE(b.name, 'Available') as status,
        b.duration_minutes
      FROM users u
      LEFT JOIN breaks b ON u.current_break_id = b.id
      JOIN users_groups ug ON u.id = ug.user_id
      JOIN \`groups\` g ON ug.group_id = g.id
      WHERE g.name = 'Agent'
      AND u.last_login > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    res.json(agents);
  } catch (error) {
    console.error('Active agents error:', error);
    res.status(500).json({ message: 'Error fetching active agents' });
  }
});

// Get call volume data
router.get('/call-volume', async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    let timeQuery;

    switch (period) {
      case 'week':
        timeQuery = 'DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        break;
      case 'month':
        timeQuery = 'DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        break;
      default:
        timeQuery = 'DATE(created_at) = CURDATE()';
    }

    const [callVolume] = await db.query(`
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as total_calls
      FROM contacts
      WHERE ${timeQuery}
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `);

    res.json(callVolume);
  } catch (error) {
    console.error('Call volume error:', error);
    res.status(500).json({ message: 'Error fetching call volume data' });
  }
});

// Get queue statistics
router.get('/queue-stats', async (req, res) => {
  try {
    const [queueStats] = await db.query(`
      SELECT 
        q.name as queue_name,
        COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_calls,
        COUNT(CASE WHEN c.status = 'waiting' THEN 1 END) as waiting_calls,
        AVG(CASE 
          WHEN c.connected_at IS NOT NULL 
          THEN TIMESTAMPDIFF(SECOND, c.created_at, c.connected_at)
          ELSE NULL 
        END) as avg_wait_time
      FROM queues q
      LEFT JOIN contacts c ON q.id = c.queue_id
      AND DATE(c.created_at) = CURDATE()
      GROUP BY q.id, q.name
    `);

    res.json(queueStats);
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({ message: 'Error fetching queue statistics' });
  }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    const [performance] = await db.query(`
      SELECT 
        COUNT(*) as total_calls,
        AVG(TIMESTAMPDIFF(SECOND, created_at, ended_at)) as avg_handle_time,
        COUNT(CASE WHEN status = 'ended' THEN 1 END) * 100.0 / COUNT(*) as resolution_rate
      FROM contacts
      WHERE DATE(created_at) = CURDATE()
    `);

    res.json(performance[0]);
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({ message: 'Error fetching performance metrics' });
  }
});

module.exports = router;