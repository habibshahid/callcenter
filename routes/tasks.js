// routes/tasks.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Helper function to convert ISO date to MySQL datetime format
const toMySQLDateTime = (isoDate) => {
  if (!isoDate) return null;
  try {
    return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
  } catch (error) {
    console.error('Invalid date format:', isoDate);
    return null;
  }
};

// Get tasks for calendar view
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, contact_id, status } = req.query;
    
    let query = `
      SELECT 
        t.*,
        c.first_name,
        c.last_name,
        c.phone_primary,
        c.company,
        cam.name as campaign_name,
        u.username as assigned_to_name
      FROM tasks t
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // If contact_id is provided, only show tasks for that contact
    if (contact_id && contact_id !== 'null' && contact_id !== 'undefined') {
      query += ' AND t.contact_id = ?';
      params.push(contact_id);
    } else {
      // Otherwise show tasks for the current user
      query += ' AND (t.created_by = ? OR t.assigned_to = ?)';
      params.push(req.user.id, req.user.id);
    }
    
    if (start_date && end_date) {
      // Convert ISO dates to MySQL datetime format
      const startDateTime = toMySQLDateTime(start_date);
      const endDateTime = toMySQLDateTime(end_date);
      
      query += ' AND t.due_date BETWEEN ? AND ?';
      params.push(startDateTime, endDateTime);
    }
    
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY t.due_date ASC';
    
    const [tasks] = await db.query(query, params);
    
    // Ensure we always return an array
    res.json(Array.isArray(tasks) ? tasks : []);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const [tasks] = await db.query(
      `SELECT t.*, c.first_name, c.last_name, c.phone_primary 
       FROM tasks t
       LEFT JOIN contacts c ON t.contact_id = c.id
       WHERE t.id = ? AND (t.created_by = ? OR t.assigned_to = ?)`,
      [req.params.id, req.user.id, req.user.id]
    );
    
    if (!tasks.length) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(tasks[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Error fetching task' });
  }
});

// Create task
router.post('/', async (req, res) => {
  try {
    const {
      contact_id,
      title,
      description,
      due_date,
      reminder_minutes,
      priority,
      type
    } = req.body;
    
    // Validate required fields
    if (!title || !due_date) {
      return res.status(400).json({ message: 'Title and due date are required' });
    }
    
    // Convert ISO date to MySQL datetime format
    const mysqlDateTime = toMySQLDateTime(due_date);
    
    const [result] = await db.query(
      `INSERT INTO tasks (
        contact_id, title, description, due_date, 
        reminder_minutes, priority, type, status,
        created_by, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        contact_id || null,
        title,
        description || null,
        mysqlDateTime,
        reminder_minutes || 30,
        priority || 'medium',
        type || 'task',
        req.user.id,
        req.user.id
      ]
    );
    
    // Log activity if contact_id exists
    if (contact_id) {
      await db.query(
        `INSERT INTO contact_interactions (
          contact_id, interaction_type, agent_id, details
        ) VALUES (?, 'note', ?, ?)`,
        [
          contact_id,
          req.user.id,
          JSON.stringify({
            type: 'task_created',
            task_id: result.insertId,
            title: title,
            due_date: due_date
          })
        ]
      );
    }
    
    res.json({ 
      id: result.insertId, 
      message: 'Task created successfully' 
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Error creating task' });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const {
      contact_id,
      title,
      description,
      due_date,
      reminder_minutes,
      priority,
      type,
      status,
      assigned_to
    } = req.body;
    
    // Check if user owns or is assigned to the task
    const [tasks] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND (created_by = ? OR assigned_to = ?)',
      [req.params.id, req.user.id, req.user.id]
    );
    
    if (!tasks.length) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Build dynamic update query based on provided fields
    const updateFields = [];
    const params = [];
    
    if (contact_id !== undefined) {
      updateFields.push('contact_id = ?');
      params.push(contact_id);
    }
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      params.push(title);
    }
    
    if (description !== undefined) {
      updateFields.push('description = ?');
      params.push(description === '' ? null : description);
    }
    
    if (due_date !== undefined) {
      updateFields.push('due_date = ?');
      params.push(toMySQLDateTime(due_date));
    }
    
    if (reminder_minutes !== undefined) {
      updateFields.push('reminder_minutes = ?');
      params.push(reminder_minutes);
    }
    
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      params.push(priority);
    }
    
    if (type !== undefined) {
      updateFields.push('type = ?');
      params.push(type);
    }
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    
    if (assigned_to !== undefined) {
      updateFields.push('assigned_to = ?');
      params.push(assigned_to || req.user.id);
    }
    
    // Add the WHERE parameter
    params.push(req.params.id);
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    const query = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await db.query(query, params);
    
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Error updating task' });
  }
});

// Update task status
router.patch('/:id/status', async (req, res) => {
  console.log(req.body)
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const [tasks] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND (created_by = ? OR assigned_to = ?)',
      [req.params.id, req.user.id, req.user.id]
    );
    
    if (!tasks.length) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    await db.query(
      'UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?',
      [status, status === 'completed' ? toMySQLDateTime(new Date()) : null, req.params.id]
    );
    
    // Log activity if contact exists
    if (tasks[0].contact_id) {
      await db.query(
        `INSERT INTO contact_interactions (
          contact_id, interaction_type, agent_id, details
        ) VALUES (?, 'note', ?, ?)`,
        [
          tasks[0].contact_id,
          req.user.id,
          JSON.stringify({
            type: 'task_status_changed',
            task_id: req.params.id,
            title: tasks[0].title,
            old_status: tasks[0].status,
            new_status: status
          })
        ]
      );
    }
    
    res.json({ message: 'Task status updated successfully' });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ message: 'Error updating task status' });
  }
});

// Reschedule task (create new task and cancel old one)
router.post('/:id/reschedule', async (req, res) => {
  try {
    const { new_due_date, reason } = req.body;
    
    if (!new_due_date) {
      return res.status(400).json({ message: 'New due date is required' });
    }
    
    // Get original task
    const [tasks] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND (created_by = ? OR assigned_to = ?)',
      [req.params.id, req.user.id, req.user.id]
    );
    
    if (!tasks.length) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const originalTask = tasks[0];
    
    // Convert ISO date to MySQL datetime format
    const mysqlDateTime = toMySQLDateTime(new_due_date);
    
    // Create new task
    const [result] = await db.query(
      `INSERT INTO tasks (
        contact_id, title, description, due_date, 
        reminder_minutes, priority, type, status,
        created_by, assigned_to, parent_task_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        originalTask.contact_id,
        originalTask.title,
        `${originalTask.description || ''}\n\nRescheduled from: ${originalTask.due_date}\nReason: ${reason || 'Not specified'}`,
        mysqlDateTime,
        originalTask.reminder_minutes,
        originalTask.priority,
        originalTask.type,
        req.user.id,
        originalTask.assigned_to,
        originalTask.id
      ]
    );
    
    // Cancel original task
    await db.query(
      'UPDATE tasks SET status = ? WHERE id = ?',
      ['cancelled', req.params.id]
    );
    
    res.json({ 
      id: result.insertId, 
      message: 'Task rescheduled successfully' 
    });
  } catch (error) {
    console.error('Error rescheduling task:', error);
    res.status(500).json({ message: 'Error rescheduling task' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const [tasks] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );
    
    if (!tasks.length) {
      return res.status(404).json({ message: 'Task not found or unauthorized' });
    }
    
    await db.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Error deleting task' });
  }
});

// Get task statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' AND due_date < NOW() THEN 1 END) as overdue,
        COUNT(CASE WHEN status = 'pending' AND DATE(due_date) = CURDATE() THEN 1 END) as today,
        COUNT(CASE WHEN status = 'pending' AND due_date > NOW() THEN 1 END) as upcoming,
        COUNT(CASE WHEN status = 'completed' AND DATE(completed_at) = CURDATE() THEN 1 END) as completed_today
      FROM tasks
      WHERE created_by = ? OR assigned_to = ?
    `, [req.user.id, req.user.id]);
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ message: 'Error fetching task statistics' });
  }
});

module.exports = router;