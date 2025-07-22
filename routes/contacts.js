// routes/contacts.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { normalizePhone } = require('../utils/phoneUtils');

router.use(authenticateToken);

/// Get all contacts
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Return empty array for now to maintain compatibility
    res.json([]);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Error fetching contacts' });
  }
});

router.get('/lookup/:phone', authenticateToken, async (req, res) => {
  try {
    const normalizedPhone = normalizePhone(req.params.phone);
    
    // Check the new contacts management table
    const [managedContacts] = await db.query(`
      SELECT 
        c.id,
        CONCAT_WS(' ', c.first_name, c.last_name) as name,
        c.phone_primary as phone,
        c.email,
        cam.name as campaign_name,
        c.status,
        c.company,
        c.custom_data,
        'managed_contact' as source
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      WHERE c.phone_normalized = ?
      LIMIT 1
    `, [normalizedPhone]);

    if (managedContacts && managedContacts.length > 0) {
      const contact = managedContacts[0];
      // Parse custom_data if it exists
      if (contact.custom_data) {
        try {
          contact.custom_data = JSON.parse(contact.custom_data);
        } catch (e) {
          contact.custom_data = {};
        }
      }
      
      // Log the interaction
      await db.query(
        `INSERT INTO contact_interactions 
         (contact_id, interaction_type, direction, details) 
         VALUES (?, 'call', 'inbound', ?)`,
        [contact.id, JSON.stringify({ phone: req.params.phone })]
      );
      
      // Update last contacted
      await db.query(
        `UPDATE contacts 
         SET last_contacted_at = NOW(), contact_attempts = contact_attempts + 1 
         WHERE id = ?`,
        [contact.id]
      );
      
      return res.json(contact);
    }

    // No contact found
    res.json(null);
  } catch (error) {
    console.error('Error looking up contact:', error);
    res.status(500).json({ message: 'Error looking up contact' });
  }
});

// Log call interaction
router.post('/log-call', authenticateToken, async (req, res) => {
  try {
    const { phone, direction, type } = req.body;
    const normalized = normalizePhone(phone);
    
    // Find contact by phone
    const [contacts] = await db.query(
      'SELECT * FROM contacts WHERE phone_normalized = ? LIMIT 1',
      [normalized]
    );
    
    if (contacts.length > 0) {
      const contact = contacts[0];
      
      // Log interaction
      await db.query(
        `INSERT INTO contact_interactions 
         (contact_id, interaction_type, direction, agent_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          contact.id,
          type || 'call',
          direction,
          req.user.id,
          JSON.stringify({ phone, timestamp: new Date() })
        ]
      );
      
      // Update contact
      await db.query(
        `UPDATE contacts 
         SET last_contacted_at = NOW(), 
             contact_attempts = contact_attempts + 1 
         WHERE id = ?`,
        [contact.id]
      );
      
      // Return contact info for display
      res.json({
        id: contact.id,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        company: contact.company,
        campaign_id: contact.campaign_id,
        custom_data: contact.custom_data
      });
    } else {
      res.json({ phone, found: false });
    }
  } catch (error) {
    console.error('Error logging call:', error);
    res.status(500).json({ message: 'Error logging call' });
  }
});

// Get contact history
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const [history] = await db.query(`
      SELECT 
        ci.*,
        u.username as agent_name
      FROM contact_interactions ci
      LEFT JOIN users u ON ci.agent_id = u.id
      WHERE ci.contact_id = ?
      ORDER BY ci.created_at DESC
      LIMIT 20
    `, [req.params.id]);

    res.json(history);
  } catch (error) {
    console.error('Error fetching contact history:', error);
    res.status(500).json({ message: 'Error fetching contact history' });
  }
});

// End call
router.post('/:id/end', authenticateToken, async (req, res) => {
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
router.post('/:id/hold', authenticateToken, async (req, res) => {
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
router.post('/:id/transfer', authenticateToken, async (req, res) => {
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
router.post('/:id/recording', authenticateToken, async (req, res) => {
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

// Backend routes using your existing contact_interactions table

// 1. Add Contact Interaction (Call Notes)
router.post('/contacts/:contactId/interactions', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { interaction_type, direction, duration, details } = req.body;
    const agentId = req.user.id;

    const query = `
      INSERT INTO contact_interactions 
      (contact_id, agent_id, interaction_type, direction, duration, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      contactId, 
      agentId, 
      interaction_type, 
      direction || 'internal', 
      duration || null, 
      JSON.stringify(details)
    ];
    
    const [result] = await db.query(query, values);
    
    // Get the inserted record with agent info
    const [rows] = await db.query(`
      SELECT ci.*, CONCAT_WS(' ', u.first_name, u.last_name) as agent_name
      FROM contact_interactions ci
      LEFT JOIN users u ON ci.agent_id = u.id
      WHERE ci.id = ?
    `, [result.insertId]);
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error adding interaction:', error);
    res.status(500).json({ error: 'Failed to add interaction' });
  }
});

// 2. Update Contact Details (Tags)
router.patch('/contacts/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { tags } = req.body;

    if (tags && Array.isArray(tags)) {
      // First, clear existing tags
      await db.query('DELETE FROM contact_tags WHERE contact_id = ?', [contactId]);
      
      // Insert new tags
      for (const tagName of tags) {
        // Get or create tag
        const [tagRows] = await db.query(
          'SELECT id FROM tags WHERE name = ?', 
          [tagName]
        );
        
        let tagId;
        if (tagRows.length === 0) {
          const [insertResult] = await db.query(
            'INSERT INTO tags (name) VALUES (?)',
            [tagName]
          );
          tagId = insertResult.insertId;
        } else {
          tagId = tagRows[0].id;
        }
        
        // Link tag to contact
        await db.query(
          'INSERT INTO contact_tags (contact_id, tag_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE contact_id = contact_id',
          [contactId, tagId]
        );
      }
    }
    
    // Get updated contact with tags
    const [contactRows] = await db.query(`
      SELECT c.*, 
        GROUP_CONCAT(DISTINCT t.name) as tags
      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.id = ?
      GROUP BY c.id
    `, [contactId]);
    
    // Convert tags string to array
    if (contactRows[0] && contactRows[0].tags) {
      contactRows[0].tags = contactRows[0].tags.split(',');
    } else {
      contactRows[0].tags = [];
    }
    
    res.json(contactRows[0]);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// 3. Get Dispositions
router.get('/dispositions', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM dispositions WHERE active = 1 ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching dispositions:', error);
    res.status(500).json({ error: 'Failed to fetch dispositions' });
  }
});

// 4. Get Tags
router.get('/tags', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tags ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// 5. Get Contact Interactions (for viewing history)
router.get('/contacts/:contactId/interactions', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const [rows] = await db.query(`
      SELECT ci.*, u.name as agent_name
      FROM contact_interactions ci
      LEFT JOIN users u ON ci.agent_id = u.id
      WHERE ci.contact_id = ?
      ORDER BY ci.created_at DESC
      LIMIT ? OFFSET ?
    `, [contactId, parseInt(limit), parseInt(offset)]);
    
    // Parse JSON details for each row
    rows.forEach(row => {
      if (row.details && typeof row.details === 'string') {
        try {
          row.details = JSON.parse(row.details);
        } catch (e) {
          console.error('Error parsing details JSON:', e);
        }
      }
    });
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  }
});

module.exports = router;