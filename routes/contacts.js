// routes/contacts.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

/// Get all contacts
router.get('/', async (req, res) => {
  try {
    const [contacts] = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        q.name as queue,
        c.status,
        c.dnis,
        c.address,
        c.on_hold,
        c.recording_paused,
        DATE_FORMAT(c.created_at, '%H:%i') as call_time
      FROM contacts c
      LEFT JOIN queues q ON c.queue_id = q.id
      WHERE c.status = 'active'
    `);

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Error fetching contacts' });
  }
});

router.get('/lookup/:phone', async (req, res) => {
  try {
    const [contacts] = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        q.name as queue,
        c.status,
        c.dnis,
        c.address,
        c.on_hold,
        c.recording_paused,
        DATE_FORMAT(c.created_at, '%H:%i') as call_time
      FROM contacts c
      LEFT JOIN queues q ON c.queue_id = q.id
      WHERE c.phone = ?
      LIMIT 1
    `, [req.params.phone]);

    if (contacts && contacts.length > 0) {
      res.json(contacts[0]);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error looking up contact:', error);
    res.status(500).json({ message: 'Error looking up contact' });
  }
});

// Get contact history
router.get('/:id/history', async (req, res) => {
  try {
    const [history] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%h:%i %p') as time,
        'Cancel Order' as action,
        'Sandra Anderson' as agent,
        'Queue_Voice_EP' as queue,
        '05:23' as duration,
        DATE_FORMAT(created_at, '%M %d, %Y') as date
      FROM contacts 
      WHERE id = ?
      UNION ALL
      SELECT 
        DATE_FORMAT(DATE_SUB(created_at, INTERVAL 1 HOUR), '%h:%i %p'),
        'Cancel Order',
        'Sandra Anderson',
        'Queue_Voice_EP',
        '05:23',
        DATE_FORMAT(created_at, '%M %d, %Y')
      FROM contacts 
      WHERE id = ?
    `, [req.params.id, req.params.id]);

    res.json(history);
  } catch (error) {
    console.error('Error fetching contact history:', error);
    res.status(500).json({ message: 'Error fetching contact history' });
  }
});

// End call
router.post('/:id/end', async (req, res) => {
  try {
    await db.query(
      `UPDATE contacts SET status = 'ended', ended_at = NOW() 
       WHERE id = ? AND agent_id = ?`,
      [req.params.id, req.user.id]
    );
    
    await db.query(
      `INSERT INTO contact_history (contact_id, agent_id, action, details) 
       VALUES (?, ?, 'call_ended', ?)`,
      [req.params.id, req.user.id, JSON.stringify({ reason: req.body.reason || 'normal' })]
    );

    res.json({ message: 'Call ended successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error ending call' });
  }
});

// Hold/unhold call
router.post('/:id/hold', async (req, res) => {
  try {
    const { isHold } = req.body;
    await db.query(
      'UPDATE contacts SET on_hold = ? WHERE id = ? AND agent_id = ?',
      [isHold, req.params.id, req.user.id]
    );

    await db.query(
      `INSERT INTO contact_history (contact_id, agent_id, action, details) 
       VALUES (?, ?, ?, ?)`,
      [req.params.id, req.user.id, isHold ? 'call_held' : 'call_resumed', '{}']
    );

    res.json({ message: isHold ? 'Call held successfully' : 'Call resumed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating hold status' });
  }
});

// Transfer call
router.post('/:id/transfer', async (req, res) => {
  try {
    const { targetAgent } = req.body;
    await db.query(
      'UPDATE contacts SET agent_id = ? WHERE id = ? AND agent_id = ?',
      [targetAgent, req.params.id, req.user.id]
    );

    await db.query(
      `INSERT INTO contact_history (contact_id, agent_id, action, details) 
       VALUES (?, ?, 'call_transferred', ?)`,
      [req.params.id, req.user.id, JSON.stringify({ target_agent: targetAgent })]
    );

    res.json({ message: 'Call transferred successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error transferring call' });
  }
});

// Toggle recording
router.post('/:id/recording', async (req, res) => {
  try {
    const { isPaused } = req.body;
    await db.query(
      'UPDATE contacts SET recording_paused = ? WHERE id = ? AND agent_id = ?',
      [isPaused, req.params.id, req.user.id]
    );

    await db.query(
      `INSERT INTO contact_history (contact_id, agent_id, action, details) 
       VALUES (?, ?, ?, ?)`,
      [req.params.id, req.user.id, isPaused ? 'recording_paused' : 'recording_resumed', '{}']
    );

    res.json({ message: isPaused ? 'Recording paused' : 'Recording resumed' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating recording status' });
  }
});

module.exports = router;