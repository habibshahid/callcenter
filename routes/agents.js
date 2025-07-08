// routes/agent.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const AMIService = require('../utils/ami');

// routes/agent.js
router.post('/status', authenticateToken, async (req, res) => {
  const { status, breakId } = req.body;
  const agentId = req.user.id;

  try {
    // Get user details
    const [users] = await db.query(
      'SELECT extension, username FROM users WHERE id = ?',
      [agentId]
    );

    if (!users.length || !users[0].extension) {
      return res.status(400).json({ message: 'Agent extension not found' });
    }

    const sipInterface = `PJSIP/${users[0].extension}`;
    const agentName = users[0].username;

    // Get agent's queues
    const [agentQueues] = await db.query(
      'SELECT q.name, q.id, qam.penalty ' +
      'FROM queues q ' +
      'JOIN queue_agent_memberships qam ON qam.queue_id = q.id ' +
      'WHERE qam.agent_id = ?',
      [agentId]
    );

    for (const queue of agentQueues) {
      try {
        // Check if agent is already in queue
        const [existingMember] = await db.query(
          'SELECT * FROM queue_members WHERE interface = ? AND queue_name = ?',
          [sipInterface, queue.name]
        );

        if (status === 'Ready') {
          if (!existingMember.length) {
            // Add to queue if not exists
            await db.query(
              'INSERT INTO queue_members (membername, queue_name, interface, penalty, paused) ' +
              'VALUES (?, ?, ?, ?, 0)',
              [agentName, queue.name, sipInterface, queue.penalty || 0]
            );

            try {
              await AMIService.addQueueMember(
                queue.name,
                sipInterface,
                agentName,
                queue.penalty || 0
              );
            } catch (amiError) {
              if (!amiError.message?.includes('Already there')) {
                throw amiError;
              }
            }
          }

          // Ensure member is unpaused
          await AMIService.pauseQueueMember(queue.name, sipInterface, false);
          await db.query(
            'UPDATE queue_members SET paused = 0, pause_reason = NULL ' +
            'WHERE interface = ? AND queue_name = ?',
            [sipInterface, queue.name]
          );
        } 
        else if (status === 'Off-Queue') {
          if (!existingMember.length) {
            // Add to queue in paused state if not exists
            await db.query(
              'INSERT INTO queue_members (membername, queue_name, interface, penalty, paused, pause_reason) ' +
              'VALUES (?, ?, ?, ?, 1, ?)',
              [agentName, queue.name, sipInterface, queue.penalty || 0, 'Off-Queue']
            );

            try {
              await AMIService.addQueueMember(
                queue.name,
                sipInterface,
                agentName,
                queue.penalty || 0
              );
            } catch (amiError) {
              if (!amiError.message?.includes('Already there')) {
                throw amiError;
              }
            }
          }

          // Pause the member
          await AMIService.pauseQueueMember(queue.name, sipInterface, true, 'Off-Queue');
          await db.query(
            'UPDATE queue_members SET paused = 1, pause_reason = ? ' +
            'WHERE interface = ? AND queue_name = ?',
            ['Off-Queue', sipInterface, queue.name]
          );
        } 
        else {
          // Handle breaks
          if (!breakId) {
            return res.status(400).json({ message: 'Break ID is required for break status' });
          }

          const [breakDetails] = await db.query(
            'SELECT name FROM breaks WHERE id = ?',
            [breakId]
          );

          if (!breakDetails.length) {
            return res.status(400).json({ message: 'Invalid break ID' });
          }

          const breakName = breakDetails[0].name;

          if (!existingMember.length) {
            // Add to queue in paused state with break if not exists
            await db.query(
              'INSERT INTO queue_members (membername, queue_name, interface, penalty, paused, pause_reason) ' +
              'VALUES (?, ?, ?, ?, 1, ?)',
              [agentName, queue.name, sipInterface, queue.penalty || 0, breakName]
            );

            try {
              await AMIService.addQueueMember(
                queue.name,
                sipInterface,
                agentName,
                queue.penalty || 0
              );
            } catch (amiError) {
              if (!amiError.message?.includes('Already there')) {
                throw amiError;
              }
            }
          }

          // Update pause state with break reason
          await AMIService.pauseQueueMember(queue.name, sipInterface, true, breakName);
          await db.query(
            'UPDATE queue_members SET paused = 1, pause_reason = ? ' +
            'WHERE interface = ? AND queue_name = ?',
            [breakName, sipInterface, queue.name]
          );
        }
      } catch (queueError) {
        console.error(`Error handling queue ${queue.name}:`, queueError);
        throw queueError;
      }
    }

    // Update agent's current status in users table
    await db.query(
      'UPDATE users SET current_status = ?, current_break_id = ? WHERE id = ?',
      [status, status === 'Ready' || status === 'Off-Queue' ? null : breakId, agentId]
    );

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({ 
      message: 'Error updating agent status',
      detail: error.message 
    });
  }
});

router.get('/ami-status', authenticateToken, async (req, res) => {
  try {
    const isConnected = amiService.isConnected();
    if (isConnected) {
      const pingResult = await amiService.testConnection();
      res.json({
        status: 'connected',
        ping: pingResult
      });
    } else {
      res.json({
        status: 'disconnected'
      });
    }
  } catch (error) {
    console.error('AMI Status Check Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;