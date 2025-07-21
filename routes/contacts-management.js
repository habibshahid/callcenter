// routes/contacts-management.js - Fixed version
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const { 
  normalizePhone, 
  validatePhone, 
  formatPhone 
} = require('../utils/phoneUtils');
const XLSX = require('xlsx');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed.'));
    }
  }
});

router.use(authenticateToken);

// ==================== CAMPAIGNS ====================

// Get all campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const [campaigns] = await db.query(`
      SELECT 
        c.*,
        u.username as created_by_name
      FROM campaigns c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.created_at DESC
    `);

    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: 'Error fetching campaigns' });
  }
});

// Create new campaign
router.post('/campaigns', async (req, res) => {
  try {
    const { name, description, custom_fields } = req.body;

    const [result] = await db.query(
      `INSERT INTO campaigns (name, description, custom_fields, created_by) 
       VALUES (?, ?, ?, ?)`,
      [name, description, JSON.stringify(custom_fields || {}), req.user.id]
    );

    res.json({ 
      id: result.insertId, 
      message: 'Campaign created successfully' 
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: 'Error creating campaign' });
  }
});

// ==================== CONTACTS ====================

// Get contacts with pagination and filtering - FIXED
router.get('/contacts', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      campaign_id,
      status,
      search,
      assigned_to,
      sort_by = 'created_at',
      sort_order = 'DESC',
      // Column-specific filters
      filter_name,
      filter_phone,
      filter_email,
      filter_company,
      filter_last_contact
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    // Build query conditions
    if (campaign_id && campaign_id !== '') {
      conditions.push('c.campaign_id = ?');
      params.push(campaign_id);
    }

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (assigned_to) {
      conditions.push('c.assigned_to = ?');
      params.push(assigned_to);
    }

    // Global search
    if (search) {
      conditions.push('(c.search_text LIKE ? OR c.phone_normalized LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Column-specific searches (case-insensitive)
    if (filter_name) {
      conditions.push(`(LOWER(CONCAT(IFNULL(c.first_name, ''), ' ', IFNULL(c.last_name, ''))) LIKE LOWER(?))`);
      params.push(`%${filter_name}%`);
    }

    if (filter_phone) {
      conditions.push('(c.phone_primary LIKE ? OR c.phone_normalized LIKE ?)');
      const phonePattern = `%${filter_phone}%`;
      params.push(phonePattern, phonePattern);
    }

    if (filter_email) {
      conditions.push('LOWER(c.email) LIKE LOWER(?)');
      params.push(`%${filter_email}%`);
    }

    if (filter_company) {
      conditions.push('LOWER(c.company) LIKE LOWER(?)');
      params.push(`%${filter_company}%`);
    }

    if (filter_last_contact) {
      // Search by date pattern
      conditions.push('DATE(c.last_contacted_at) = ?');
      params.push(filter_last_contact);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM contacts c ${whereClause}`;
    const [countResult] = await db.query(countQuery, params);

    // Get contacts
    const contactsQuery = `
      SELECT 
        c.*,
        c.phone_primary as phone_display,
        cam.name as campaign_name,
        u.username as assigned_to_name,
        (
          SELECT COUNT(*) 
          FROM contact_interactions ci 
          WHERE ci.contact_id = c.id
        ) as interaction_count,
        (
          SELECT ci.created_at 
          FROM contact_interactions ci 
          WHERE ci.contact_id = c.id 
          ORDER BY ci.created_at DESC 
          LIMIT 1
        ) as last_interaction
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON c.assigned_to = u.id
      ${whereClause}
      ORDER BY c.${sort_by} ${sort_order}
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const [contacts] = await db.query(contactsQuery, params);

    // Format phone numbers for display
    contacts.forEach(contact => {
      contact.phone_display = formatPhone(contact.phone_primary);
      if (contact.custom_data) {
        try {
          contact.custom_data = typeof contact.custom_data === 'string' 
            ? JSON.parse(contact.custom_data) 
            : contact.custom_data;
        } catch (e) {
          contact.custom_data = {};
        }
      }
      if (contact.tags) {
        try {
          contact.tags = typeof contact.tags === 'string' 
            ? JSON.parse(contact.tags) 
            : contact.tags;
        } catch (e) {
          contact.tags = [];
        }
      }
    });

    res.json({
      contacts,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Error fetching contacts' });
  }
});

// Get single contact
router.get('/contacts/:id', async (req, res) => {
  try {
    const [contacts] = await db.query(`
      SELECT 
        c.*,
        cam.name as campaign_name,
        u.username as assigned_to_name,
        creator.username as created_by_name
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users creator ON c.created_by = creator.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!contacts.length) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const contact = contacts[0];
    contact.phone_display = formatPhone(contact.phone_primary);

    // Get interaction history
    const [interactions] = await db.query(`
      SELECT 
        ci.*,
        u.username as agent_name
      FROM contact_interactions ci
      LEFT JOIN users u ON ci.agent_id = u.id
      WHERE ci.contact_id = ?
      ORDER BY ci.created_at DESC
      LIMIT 20
    `, [req.params.id]);

    contact.interactions = interactions;

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ message: 'Error fetching contact' });
  }
});

// Create contact
router.post('/contacts', async (req, res) => {
  try {
    const {
      phone_primary,
      phone_secondary,
      first_name,
      last_name,
      email,
      company,
      campaign_id,
      custom_data,
      tags,
      source = 'manual'
    } = req.body;

    // Validate phone
    const phoneValidation = validatePhone(phone_primary);
    if (!phoneValidation.valid) {
      return res.status(400).json({ message: phoneValidation.error });
    }

    // Check for duplicate
    const normalized = normalizePhone(phone_primary);
    const [existing] = await db.query(
      'SELECT id FROM contacts WHERE phone_normalized = ? AND campaign_id = ?',
      [normalized, campaign_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ 
        message: 'Contact with this phone number already exists in this campaign' 
      });
    }

    // Insert contact
    const [result] = await db.query(
      `INSERT INTO contacts (
        phone_primary, phone_secondary, first_name, last_name, 
        email, company, campaign_id, custom_data, tags, 
        source, created_by, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        phone_primary,
        phone_secondary,
        first_name,
        last_name,
        email,
        company,
        campaign_id,
        JSON.stringify(custom_data || {}),
        JSON.stringify(tags || []),
        source,
        req.user.id,
        req.user.id
      ]
    );

    // Log creation
    await db.query(
      `INSERT INTO contact_interactions 
       (contact_id, interaction_type, agent_id, details) 
       VALUES (?, 'note', ?, ?)`,
      [
        result.insertId,
        req.user.id,
        JSON.stringify({ note: 'Contact created' })
      ]
    );

    res.json({ 
      id: result.insertId, 
      message: 'Contact created successfully' 
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ message: 'Error creating contact' });
  }
});

// Update contact
router.put('/contacts/:id', async (req, res) => {
  try {
    const updates = [];
    const params = [];

    // Build update query dynamically
    const allowedFields = [
      'first_name', 'last_name', 'email', 'company',
      'status', 'custom_data', 'tags', 'assigned_to'
    ];

    allowedFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        updates.push(`${field} = ?`);
        params.push(
          ['custom_data', 'tags'].includes(field) 
            ? JSON.stringify(req.body[field]) 
            : req.body[field]
        );
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    params.push(req.params.id);

    await db.query(
      `UPDATE contacts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    res.json({ message: 'Contact updated successfully' });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ message: 'Error updating contact' });
  }
});

// ==================== SEARCH ====================

// Search contacts
router.get('/search', async (req, res) => {
  try {
    const { q, campaign_id, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    let query = `
      SELECT 
        id, phone_primary, first_name, last_name, 
        email, company, campaign_id
      FROM contacts 
      WHERE 
    `;

    const params = [];

    // Check if search query is a phone number
    const phonePattern = /^[\d\s\-\(\)\+]+$/;
    if (phonePattern.test(q)) {
      const normalized = normalizePhone(q);
      query += `phone_normalized LIKE ?`;
      params.push(`${normalized}%`);
    } else {
      // Use LIKE search for names/email
      query += `(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?)`;
      const searchPattern = `%${q}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (campaign_id) {
      query += ` AND campaign_id = ?`;
      params.push(campaign_id);
    }

    // Add LIMIT using string interpolation to avoid parameter binding issue
    query += ` LIMIT ${parseInt(limit)}`;

    const [results] = await db.query(query, params);

    // Format results
    results.forEach(contact => {
      contact.phone_display = formatPhone(contact.phone_primary);
      contact.display_name = [contact.first_name, contact.last_name]
        .filter(Boolean)
        .join(' ') || contact.phone_display;
    });

    res.json(results);
  } catch (error) {
    console.error('Error searching contacts:', error);
    res.status(500).json({ message: 'Error searching contacts' });
  }
});

// ==================== CSV IMPORT ====================

// Import CSV - Updated to handle the CSV format properly
router.post('/import', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { campaign_id } = req.body;
    let field_mapping = req.body.field_mapping;
    
    if (!campaign_id) {
      return res.status(400).json({ message: 'Campaign ID is required' });
    }

    // Parse field_mapping if it's a string
    if (typeof field_mapping === 'string') {
      try {
        field_mapping = JSON.parse(field_mapping);
      } catch (e) {
        field_mapping = {
          'Phone': 'phone_primary',
          'First Name': 'first_name',
          'Last Name': 'last_name',
          'Email': 'email',
          'Company': 'company'
        };
      }
    }

    // Create import job
    const [jobResult] = await db.query(
      `INSERT INTO import_jobs 
       (campaign_id, filename, status, field_mapping, created_by) 
       VALUES (?, ?, 'processing', ?, ?)`,
      [
        campaign_id,
        req.file.originalname,
        JSON.stringify(field_mapping || {}),
        req.user.id
      ]
    );

    const jobId = jobResult.insertId;

    // Process CSV in background
    processCSVImport(jobId, filePath, campaign_id, field_mapping || {}, req.user.id);

    res.json({ 
      jobId,
      message: 'Import started successfully' 
    });
  } catch (error) {
    console.error('Error starting import:', error);
    if (filePath) fs.unlinkSync(filePath);
    res.status(500).json({ message: 'Error starting import' });
  }
});

// Get import job status
router.get('/import/:jobId', async (req, res) => {
  try {
    const [jobs] = await db.query(
      'SELECT * FROM import_jobs WHERE id = ?',
      [req.params.jobId]
    );

    if (!jobs.length) {
      return res.status(404).json({ message: 'Import job not found' });
    }

    res.json(jobs[0]);
  } catch (error) {
    console.error('Error fetching import job:', error);
    res.status(500).json({ message: 'Error fetching import job' });
  }
});

// Log call interaction
router.post('/log-call', async (req, res) => {
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

// ==================== HELPER FUNCTIONS ====================

async function processCSVImport(jobId, filePath, campaignId, fieldMapping, userId) {
  const errors = [];
  let rowCount = 0;
  let successCount = 0;

  try {
    // Update job status
    await db.query(
      'UPDATE import_jobs SET started_at = NOW() WHERE id = ?',
      [jobId]
    );

    const rows = [];
    
    // Read and parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim(), // Trim whitespace from headers
          skipEmptyLines: true
        }))
        .on('data', (row) => {
          rows.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Process all rows
    for (const row of rows) {
      rowCount++;
      
      try {
        // Map fields based on mapping configuration
        const contact = {
          campaign_id: campaignId,
          created_by: userId,
          source: 'csv_import',
          custom_data: {}
        };

        // Map standard fields
        Object.keys(fieldMapping).forEach(csvField => {
          const dbField = fieldMapping[csvField];
          const value = row[csvField];
          
          if (value) {
            if (['first_name', 'last_name', 'email', 'company', 'phone_primary', 'phone_secondary'].includes(dbField)) {
              contact[dbField] = value.trim();
            } else {
              // Custom field
              contact.custom_data[dbField] = value.trim();
            }
          }
        });

        // Validate phone
        if (!contact.phone_primary) {
          throw new Error('Phone number is required');
        }

        const phoneValidation = validatePhone(contact.phone_primary);
        if (!phoneValidation.valid) {
          throw new Error(phoneValidation.error);
        }

        // Insert contact with duplicate handling
        await db.query(
          `INSERT INTO contacts 
           (phone_primary, phone_secondary, first_name, last_name, 
            email, company, campaign_id, custom_data, source, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           first_name = COALESCE(VALUES(first_name), first_name),
           last_name = COALESCE(VALUES(last_name), last_name),
           email = COALESCE(VALUES(email), email),
           company = COALESCE(VALUES(company), company),
           updated_at = NOW()`,
          [
            contact.phone_primary,
            contact.phone_secondary || null,
            contact.first_name || null,
            contact.last_name || null,
            contact.email || null,
            contact.company || null,
            contact.campaign_id,
            JSON.stringify(contact.custom_data),
            contact.source,
            contact.created_by
          ]
        );

        successCount++;
      } catch (error) {
        errors.push({
          row: rowCount,
          error: error.message,
          data: row
        });
      }

      // Update progress every 10 rows
      if (rowCount % 10 === 0) {
        await db.query(
          `UPDATE import_jobs 
           SET processed_rows = ?, successful_rows = ?, failed_rows = ?
           WHERE id = ?`,
          [rowCount, successCount, errors.length, jobId]
        );
      }
    }

    // Final update
    await db.query(
      `UPDATE import_jobs 
       SET status = 'completed', 
           completed_at = NOW(),
           total_rows = ?,
           processed_rows = ?,
           successful_rows = ?,
           failed_rows = ?,
           error_log = ?
       WHERE id = ?`,
      [
        rowCount,
        rowCount,
        successCount,
        errors.length,
        JSON.stringify(errors.slice(0, 100)), // Store first 100 errors
        jobId
      ]
    );

    // Update campaign contact count
    await db.query(
      `UPDATE campaigns 
       SET total_contacts = (
         SELECT COUNT(*) FROM contacts WHERE campaign_id = ?
       ) 
       WHERE id = ?`,
      [campaignId, campaignId]
    );

    console.log(`Import completed: ${successCount}/${rowCount} contacts imported successfully`);

  } catch (error) {
    console.error('Import job error:', error);
    
    await db.query(
      `UPDATE import_jobs 
       SET status = 'failed', 
           error_log = ?,
           completed_at = NOW()
       WHERE id = ?`,
      [JSON.stringify({ error: error.message }), jobId]
    );
  } finally {
    // Clean up temp file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

const uploadExcel = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Enhanced import endpoint that handles both CSV and Excel
router.post('/import-enhanced', uploadExcel.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { campaign_id } = req.body;
    let field_mapping = req.body.field_mapping;
    
    if (!campaign_id) {
      return res.status(400).json({ message: 'Campaign ID is required' });
    }

    // Parse field_mapping if it's a string
    if (typeof field_mapping === 'string') {
      try {
        field_mapping = JSON.parse(field_mapping);
      } catch (e) {
        field_mapping = null;
      }
    }

    // Detect file type and get preview
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    let preview = null;

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Handle Excel files
      preview = await previewExcelFile(filePath);
    } else {
      // Handle CSV files
      preview = await previewCSVFile(filePath);
    }

    // If no field mapping provided, return preview for mapping
    if (!field_mapping) {
      return res.json({
        preview,
        headers: preview.headers,
        requiresMapping: true
      });
    }

    // Create import job
    const [jobResult] = await db.query(
      `INSERT INTO import_jobs 
       (campaign_id, filename, status, field_mapping, created_by) 
       VALUES (?, ?, 'processing', ?, ?)`,
      [
        campaign_id,
        req.file.originalname,
        JSON.stringify(field_mapping),
        req.user.id
      ]
    );

    const jobId = jobResult.insertId;

    // Process file based on type
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      processExcelImport(jobId, filePath, campaign_id, field_mapping, req.user.id);
    } else {
      processCSVImport(jobId, filePath, campaign_id, field_mapping, req.user.id);
    }

    res.json({ 
      jobId,
      message: 'Import started successfully' 
    });
  } catch (error) {
    console.error('Error starting import:', error);
    if (filePath) fs.unlinkSync(filePath);
    res.status(500).json({ message: 'Error starting import' });
  }
});

// Preview Excel file
// Preview Excel file
async function previewExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        error: 'No sheets found in Excel file'
      };
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        error: 'Excel file is empty'
      };
    }

    const headers = jsonData[0] || [];
    const rows = jsonData.slice(1, 6); // Get first 5 rows for preview

    return {
      headers,
      rows,
      totalRows: Math.max(0, jsonData.length - 1)
    };
  } catch (error) {
    console.error('Error previewing Excel file:', error);
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      error: error.message
    };
  }
}

router.post('/search-advanced', authenticateToken, async (req, res) => {
  try {
    const { 
      campaign_id, 
      criteria, 
      page = 1, 
      limit = 50 
    } = req.body;

    if (!criteria || criteria.length === 0) {
      return res.json({ contacts: [], pagination: { total: 0, page: 1, limit, pages: 0 } });
    }

    // Build WHERE conditions
    const conditions = [];
    const params = [];

    if (campaign_id) {
      conditions.push('c.campaign_id = ?');
      params.push(campaign_id);
    }

    // Process each search criterion
    criteria.forEach((criterion, index) => {
      const { field, operator, value } = criterion;
      
      if (!value || value.trim() === '') return;

      // Handle different field types
      if (field === 'any') {
        // Search across all standard fields
        conditions.push(`(
          c.search_text LIKE ? OR 
          c.phone_normalized LIKE ? OR
          JSON_SEARCH(c.custom_data, 'all', ?) IS NOT NULL
        )`);
        const searchPattern = operator === 'equals' ? value : `%${value}%`;
        params.push(searchPattern, searchPattern, value);
      } 
      else if (field.startsWith('custom.')) {
        // Custom field search
        const customFieldKey = field.replace('custom.', '');
        
        switch (operator) {
          case 'equals':
            conditions.push(`JSON_EXTRACT(c.custom_data, '$.${customFieldKey}') = ?`);
            params.push(value);
            break;
          case 'contains':
            conditions.push(`JSON_EXTRACT(c.custom_data, '$.${customFieldKey}') LIKE ?`);
            params.push(`%${value}%`);
            break;
          case 'starts_with':
            conditions.push(`JSON_EXTRACT(c.custom_data, '$.${customFieldKey}') LIKE ?`);
            params.push(`${value}%`);
            break;
          case 'ends_with':
            conditions.push(`JSON_EXTRACT(c.custom_data, '$.${customFieldKey}') LIKE ?`);
            params.push(`%${value}`);
            break;
          case 'not_contains':
            conditions.push(`(JSON_EXTRACT(c.custom_data, '$.${customFieldKey}') NOT LIKE ? OR JSON_EXTRACT(c.custom_data, '$.${customFieldKey}') IS NULL)`);
            params.push(`%${value}%`);
            break;
        }
      } 
      else {
        // Standard field search
        let dbField = field;
        if (field === 'phone') dbField = 'phone_normalized';
        
        switch (operator) {
          case 'equals':
            conditions.push(`c.${dbField} = ?`);
            params.push(value);
            break;
          case 'contains':
            conditions.push(`c.${dbField} LIKE ?`);
            params.push(`%${value}%`);
            break;
          case 'starts_with':
            conditions.push(`c.${dbField} LIKE ?`);
            params.push(`${value}%`);
            break;
          case 'ends_with':
            conditions.push(`c.${dbField} LIKE ?`);
            params.push(`%${value}`);
            break;
          case 'not_contains':
            conditions.push(`(c.${dbField} NOT LIKE ? OR c.${dbField} IS NULL)`);
            params.push(`%${value}%`);
            break;
        }
      }
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM contacts c ${whereClause}`;
    const [countResult] = await db.query(countQuery, params);

    // Get contacts
    const contactsQuery = `
      SELECT 
        c.*,
        c.phone_primary as phone_display,
        cam.name as campaign_name,
        u.username as assigned_to_name,
        (
          SELECT COUNT(*) 
          FROM contact_interactions ci 
          WHERE ci.contact_id = c.id
        ) as interaction_count,
        (
          SELECT ci.created_at 
          FROM contact_interactions ci 
          WHERE ci.contact_id = c.id 
          ORDER BY ci.created_at DESC 
          LIMIT 1
        ) as last_interaction
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON c.assigned_to = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const [contacts] = await db.query(contactsQuery, params);

    // Format response
    contacts.forEach(contact => {
      contact.phone_display = formatPhone(contact.phone_primary);
      if (contact.custom_data) {
        try {
          contact.custom_data = typeof contact.custom_data === 'string' 
            ? JSON.parse(contact.custom_data) 
            : contact.custom_data;
        } catch (e) {
          contact.custom_data = {};
        }
      }
    });

    res.json({
      contacts,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ message: 'Error performing search' });
  }
});

// Add this custom fields search endpoint to routes/contacts-management.js

// Search by custom fields
router.post('/search-custom-fields', authenticateToken, async (req, res) => {
  try {
    const { 
      campaign_id, 
      custom_field_filters, 
      page = 1, 
      limit = 50,
      include_standard_filters = {},
      column_filters = {} // Add column filters support
    } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ message: 'Campaign ID is required' });
    }

    // Build WHERE conditions
    const conditions = ['c.campaign_id = ?'];
    const params = [campaign_id];

    // Apply standard filters if provided
    if (include_standard_filters.status) {
      conditions.push('c.status = ?');
      params.push(include_standard_filters.status);
    }

    if (include_standard_filters.assigned_to) {
      conditions.push('c.assigned_to = ?');
      params.push(include_standard_filters.assigned_to);
    }

    // Apply column filters (case-insensitive)
    if (column_filters.name) {
      conditions.push(`LOWER(CONCAT(IFNULL(c.first_name, ''), ' ', IFNULL(c.last_name, ''))) LIKE LOWER(?)`);
      params.push(`%${column_filters.name}%`);
    }

    if (column_filters.phone) {
      conditions.push('(c.phone_primary LIKE ? OR c.phone_normalized LIKE ?)');
      params.push(`%${column_filters.phone}%`, `%${column_filters.phone}%`);
    }

    if (column_filters.email) {
      conditions.push('LOWER(c.email) LIKE LOWER(?)');
      params.push(`%${column_filters.email}%`);
    }

    if (column_filters.company) {
      conditions.push('LOWER(c.company) LIKE LOWER(?)');
      params.push(`%${column_filters.company}%`);
    }

    // Build custom field conditions (case-insensitive)
    if (custom_field_filters && custom_field_filters.length > 0) {
      const customConditions = [];
      
      custom_field_filters.forEach(filter => {
        const { field, operator, value } = filter;
        
        if (!value || value.trim() === '') return;

        switch (operator) {
          case 'equals':
            // Case-insensitive equals using LOWER
            customConditions.push(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.custom_data, '$.${field}'))) = LOWER(?)`);
            params.push(value);
            break;
          case 'contains':
            // Case-insensitive LIKE
            customConditions.push(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.custom_data, '$.${field}'))) LIKE LOWER(?)`);
            params.push(`%${value}%`);
            break;
          case 'starts_with':
            customConditions.push(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.custom_data, '$.${field}'))) LIKE LOWER(?)`);
            params.push(`${value}%`);
            break;
          case 'ends_with':
            customConditions.push(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.custom_data, '$.${field}'))) LIKE LOWER(?)`);
            params.push(`%${value}`);
            break;
          case 'greater_than':
            customConditions.push(`CAST(JSON_EXTRACT(c.custom_data, '$.${field}') AS DECIMAL) > ?`);
            params.push(parseFloat(value));
            break;
          case 'less_than':
            customConditions.push(`CAST(JSON_EXTRACT(c.custom_data, '$.${field}') AS DECIMAL) < ?`);
            params.push(parseFloat(value));
            break;
          case 'is_empty':
            customConditions.push(`(JSON_EXTRACT(c.custom_data, '$.${field}') IS NULL OR JSON_EXTRACT(c.custom_data, '$.${field}') = '' OR JSON_EXTRACT(c.custom_data, '$.${field}') = 'null')`);
            break;
          case 'is_not_empty':
            customConditions.push(`(JSON_EXTRACT(c.custom_data, '$.${field}') IS NOT NULL AND JSON_EXTRACT(c.custom_data, '$.${field}') != '' AND JSON_EXTRACT(c.custom_data, '$.${field}') != 'null')`);
            break;
        }
      });

      if (customConditions.length > 0) {
        conditions.push(`(${customConditions.join(' AND ')})`);
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM contacts c ${whereClause}`;
    const [countResult] = await db.query(countQuery, params);

    // Get contacts with custom fields
    const contactsQuery = `
      SELECT 
        c.*,
        c.phone_primary as phone_display,
        cam.name as campaign_name,
        u.username as assigned_to_name,
        (
          SELECT COUNT(*) 
          FROM contact_interactions ci 
          WHERE ci.contact_id = c.id
        ) as interaction_count,
        (
          SELECT ci.created_at 
          FROM contact_interactions ci 
          WHERE ci.contact_id = c.id 
          ORDER BY ci.created_at DESC 
          LIMIT 1
        ) as last_interaction
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON c.assigned_to = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const [contacts] = await db.query(contactsQuery, params);

    // Format response with emphasis on custom data
    contacts.forEach(contact => {
      contact.phone_display = formatPhone(contact.phone_primary);
      if (contact.custom_data) {
        try {
          contact.custom_data = typeof contact.custom_data === 'string' 
            ? JSON.parse(contact.custom_data) 
            : contact.custom_data;
        } catch (e) {
          contact.custom_data = {};
        }
      } else {
        contact.custom_data = {};
      }
      
      // Add matched custom fields for highlighting
      contact.matched_custom_fields = [];
      if (custom_field_filters) {
        custom_field_filters.forEach(filter => {
          if (contact.custom_data[filter.field]) {
            contact.matched_custom_fields.push({
              field: filter.field,
              value: contact.custom_data[filter.field]
            });
          }
        });
      }
    });

    res.json({
      contacts,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Custom fields search error:', error);
    res.status(500).json({ message: 'Error searching custom fields' });
  }
});

// Get all unique custom fields for a campaign
router.get('/campaigns/:campaignId/custom-fields-list', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Get a sample of contacts to extract custom field keys
    const [contacts] = await db.query(`
      SELECT custom_data 
      FROM contacts 
      WHERE campaign_id = ? 
      AND custom_data IS NOT NULL 
      AND custom_data != '{}'
      LIMIT 100
    `, [campaignId]);

    const fieldSet = new Set();
    const fieldTypes = {};

    contacts.forEach(contact => {
      try {
        const customData = typeof contact.custom_data === 'string' 
          ? JSON.parse(contact.custom_data) 
          : contact.custom_data;
        
        Object.entries(customData).forEach(([key, value]) => {
          fieldSet.add(key);
          
          // Detect field type
          if (!fieldTypes[key]) {
            if (!isNaN(value) && value !== '') {
              fieldTypes[key] = 'number';
            } else if (value === 'true' || value === 'false' || typeof value === 'boolean') {
              fieldTypes[key] = 'boolean';
            } else {
              fieldTypes[key] = 'text';
            }
          }
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });

    const fields = Array.from(fieldSet).map(field => ({
      name: field,
      type: fieldTypes[field] || 'text',
      label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));

    res.json({ fields });
  } catch (error) {
    console.error('Error getting custom fields list:', error);
    res.status(500).json({ message: 'Error getting custom fields list' });
  }
});

// Preview CSV file
async function previewCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;
    
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('headers', (hdrs) => {
        headers = hdrs;
      })
      .on('data', (row) => {
        if (rows.length < 5) {
          rows.push(Object.values(row));
        }
      })
      .on('end', () => {
        resolve({
          headers,
          rows,
          totalRows: rows.length
        });
      })
      .on('error', reject);
  });
}

// Process Excel import
async function processExcelImport(jobId, filePath, campaignId, fieldMapping, userId) {
  const errors = [];
  let rowCount = 0;
  let successCount = 0;

  try {
    // Update job status
    await db.query(
      'UPDATE import_jobs SET started_at = NOW() WHERE id = ?',
      [jobId]
    );

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // Process each row
    for (const row of jsonData) {
      rowCount++;
      
      try {
        // Map fields based on mapping configuration
        const contact = {
          campaign_id: campaignId,
          created_by: userId,
          source: 'excel_import',
          custom_data: {}
        };

        // Map standard fields
        Object.keys(fieldMapping).forEach(excelField => {
          const dbField = fieldMapping[excelField];
          const value = row[excelField];
          
          if (value !== undefined && value !== null && value !== '') {
            if (['first_name', 'last_name', 'email', 'company', 'phone_primary', 'phone_secondary'].includes(dbField)) {
              contact[dbField] = String(value).trim();
            } else {
              // Custom field
              contact.custom_data[dbField] = String(value).trim();
            }
          }
        });

        // Validate phone
        if (!contact.phone_primary) {
          throw new Error('Phone number is required');
        }

        const phoneValidation = validatePhone(contact.phone_primary);
        if (!phoneValidation.valid) {
          throw new Error(phoneValidation.error);
        }

        // Insert contact
        await db.query(
          `INSERT INTO contacts 
           (phone_primary, phone_secondary, first_name, last_name, 
            email, company, campaign_id, custom_data, source, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           first_name = COALESCE(VALUES(first_name), first_name),
           last_name = COALESCE(VALUES(last_name), last_name),
           email = COALESCE(VALUES(email), email),
           company = COALESCE(VALUES(company), company),
           updated_at = NOW()`,
          [
            contact.phone_primary,
            contact.phone_secondary || null,
            contact.first_name || null,
            contact.last_name || null,
            contact.email || null,
            contact.company || null,
            contact.campaign_id,
            JSON.stringify(contact.custom_data),
            contact.source,
            contact.created_by
          ]
        );

        successCount++;
      } catch (error) {
        errors.push({
          row: rowCount,
          error: error.message,
          data: row
        });
      }

      // Update progress every 10 rows
      if (rowCount % 10 === 0) {
        await db.query(
          `UPDATE import_jobs 
           SET processed_rows = ?, successful_rows = ?, failed_rows = ?
           WHERE id = ?`,
          [rowCount, successCount, errors.length, jobId]
        );
      }
    }

    // Final update
    await db.query(
      `UPDATE import_jobs 
       SET status = 'completed', 
           completed_at = NOW(),
           total_rows = ?,
           processed_rows = ?,
           successful_rows = ?,
           failed_rows = ?,
           error_log = ?
       WHERE id = ?`,
      [
        rowCount,
        rowCount,
        successCount,
        errors.length,
        JSON.stringify(errors.slice(0, 100)),
        jobId
      ]
    );

    // Update campaign contact count
    await db.query(
      `UPDATE campaigns 
       SET total_contacts = (
         SELECT COUNT(*) FROM contacts WHERE campaign_id = ?
       ) 
       WHERE id = ?`,
      [campaignId, campaignId]
    );

    console.log(`Excel import completed: ${successCount}/${rowCount} contacts imported successfully`);

  } catch (error) {
    console.error('Excel import error:', error);
    
    await db.query(
      `UPDATE import_jobs 
       SET status = 'failed', 
           error_log = ?,
           completed_at = NOW()
       WHERE id = ?`,
      [JSON.stringify({ error: error.message }), jobId]
    );
  } finally {
    // Clean up temp file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// Add to routes/contacts-management.js - Bulk operations and export

// ==================== BULK OPERATIONS ====================

// Bulk update contacts
router.post('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const { contactIds, updates } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'No contacts selected' });
    }

    // Build update query
    const updateFields = [];
    const params = [];

    // Handle standard fields
    const allowedFields = ['status', 'assigned_to', 'campaign_id'];
    allowedFields.forEach(field => {
      if (updates.hasOwnProperty(field)) {
        updateFields.push(`${field} = ?`);
        params.push(updates[field]);
      }
    });

    // Handle custom data merge
    if (updates.custom_data) {
      updateFields.push(`custom_data = JSON_MERGE_PATCH(custom_data, ?)`);
      params.push(JSON.stringify(updates.custom_data));
    }

    // Handle tags
    if (updates.tags) {
      if (updates.tags.add) {
        updateFields.push(`tags = JSON_ARRAY_APPEND(tags, '$', ?)`);
        params.push(JSON.stringify(updates.tags.add));
      }
      if (updates.tags.remove) {
        updateFields.push(`tags = JSON_REMOVE(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', ?)))`);
        params.push(updates.tags.remove);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    // Create placeholders for IN clause
    const placeholders = contactIds.map(() => '?').join(',');
    
    // Execute update
    const query = `
      UPDATE contacts 
      SET ${updateFields.join(', ')}, updated_at = NOW() 
      WHERE id IN (${placeholders})
    `;

    const [result] = await db.query(query, [...params, ...contactIds]);

    // Log bulk action
    await db.query(
      `INSERT INTO contact_interactions 
       (contact_id, interaction_type, agent_id, details) 
       SELECT id, 'bulk_update', ?, ? 
       FROM contacts 
       WHERE id IN (${placeholders})`,
      [req.user.id, JSON.stringify(updates), ...contactIds]
    );

    res.json({ 
      message: 'Contacts updated successfully',
      affected: result.affectedRows 
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ message: 'Error updating contacts' });
  }
});

// Bulk delete contacts
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'No contacts selected' });
    }

    const placeholders = contactIds.map(() => '?').join(',');

    // Delete contacts (interactions will be cascade deleted)
    const [result] = await db.query(
      `DELETE FROM contacts WHERE id IN (${placeholders})`,
      contactIds
    );

    res.json({ 
      message: 'Contacts deleted successfully',
      deleted: result.affectedRows 
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    res.status(500).json({ message: 'Error deleting contacts' });
  }
});

// Bulk assign contacts
router.post('/bulk-assign', authenticateToken, async (req, res) => {
  try {
    const { contactIds, assignTo } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'No contacts selected' });
    }

    const placeholders = contactIds.map(() => '?').join(',');

    // Update assignment
    const [result] = await db.query(
      `UPDATE contacts 
       SET assigned_to = ?, updated_at = NOW() 
       WHERE id IN (${placeholders})`,
      [assignTo, ...contactIds]
    );

    // Log assignments
    await db.query(
      `INSERT INTO contact_interactions 
       (contact_id, interaction_type, agent_id, details) 
       SELECT id, 'assignment', ?, ? 
       FROM contacts 
       WHERE id IN (${placeholders})`,
      [req.user.id, JSON.stringify({ assigned_to: assignTo }), ...contactIds]
    );

    res.json({ 
      message: 'Contacts assigned successfully',
      affected: result.affectedRows 
    });
  } catch (error) {
    console.error('Error in bulk assign:', error);
    res.status(500).json({ message: 'Error assigning contacts' });
  }
});

// ==================== EXPORT ====================

// Export contacts
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const {
      format = 'csv',
      campaign_id,
      status,
      assigned_to,
      fields
    } = req.query;

    // Build query
    const conditions = [];
    const params = [];

    if (campaign_id) {
      conditions.push('c.campaign_id = ?');
      params.push(campaign_id);
    }

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (assigned_to) {
      conditions.push('c.assigned_to = ?');
      params.push(assigned_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get contacts
    const [contacts] = await db.query(`
      SELECT 
        c.*,
        cam.name as campaign_name,
        u.username as assigned_to_name
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON c.assigned_to = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `, params);

    // Parse custom fields
    contacts.forEach(contact => {
      if (contact.custom_data) {
        try {
          const customData = JSON.parse(contact.custom_data);
          Object.keys(customData).forEach(key => {
            contact[`custom_${key}`] = customData[key];
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Generate export based on format
    if (format === 'csv') {
      const csv = await generateCSV(contacts, fields);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="contacts_export_${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'excel') {
      const buffer = await generateExcel(contacts, fields);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="contacts_export_${Date.now()}.xlsx"`);
      res.send(buffer);
    } else {
      res.status(400).json({ message: 'Invalid export format' });
    }
  } catch (error) {
    console.error('Error exporting contacts:', error);
    res.status(500).json({ message: 'Error exporting contacts' });
  }
});

// Generate CSV
async function generateCSV(contacts, fieldsParam) {
  const fields = fieldsParam ? fieldsParam.split(',') : [
    'phone_primary', 'first_name', 'last_name', 'email', 
    'company', 'status', 'campaign_name', 'assigned_to_name'
  ];

  // Header row
  const header = fields.join(',');
  
  // Data rows
  const rows = contacts.map(contact => {
    return fields.map(field => {
      const value = contact[field] || '';
      // Escape quotes and wrap in quotes if contains comma
      if (value.toString().includes(',') || value.toString().includes('"')) {
        return `"${value.toString().replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

// Generate Excel
async function generateExcel(contacts, fieldsParam) {
  const fields = fieldsParam ? fieldsParam.split(',') : [
    'phone_primary', 'first_name', 'last_name', 'email', 
    'company', 'status', 'campaign_name', 'assigned_to_name'
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare data
  const data = contacts.map(contact => {
    const row = {};
    fields.forEach(field => {
      row[field] = contact[field] || '';
    });
    return row;
  });

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
  
  // Generate buffer
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Find duplicates
router.get('/duplicates', authenticateToken, async (req, res) => {
  try {
    const { campaign_id } = req.query;
    
    const conditions = campaign_id ? 'WHERE campaign_id = ?' : '';
    const params = campaign_id ? [campaign_id] : [];

    // Find contacts with duplicate phone numbers
    const [duplicates] = await db.query(`
      SELECT 
        phone_normalized,
        COUNT(*) as count,
        GROUP_CONCAT(id) as contact_ids,
        GROUP_CONCAT(CONCAT(IFNULL(first_name, ''), ' ', IFNULL(last_name, '')) SEPARATOR '|') as names,
        GROUP_CONCAT(IFNULL(email, '') SEPARATOR '|') as emails,
        GROUP_CONCAT(IFNULL(company, '') SEPARATOR '|') as companies,
        MIN(created_at) as first_created,
        MAX(updated_at) as last_updated
      FROM contacts
      ${conditions}
      GROUP BY phone_normalized
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 100
    `, params);

    // Format the results
    const formattedDuplicates = duplicates.map(dup => {
      const ids = dup.contact_ids.split(',').map(id => parseInt(id));
      const names = dup.names.split('|');
      const emails = dup.emails.split('|');
      const companies = dup.companies.split('|');
      
      const contacts = ids.map((id, index) => ({
        id,
        name: names[index]?.trim() || '',
        email: emails[index] || '',
        company: companies[index] || ''
      }));

      return {
        phone: dup.phone_normalized,
        count: dup.count,
        contacts,
        first_created: dup.first_created,
        last_updated: dup.last_updated
      };
    });

    res.json({
      total: formattedDuplicates.length,
      duplicates: formattedDuplicates
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ message: 'Error finding duplicates' });
  }
});

// Merge duplicates
router.post('/merge', authenticateToken, async (req, res) => {
  try {
    const { keepId, mergeIds } = req.body;

    if (!keepId || !mergeIds || !Array.isArray(mergeIds) || mergeIds.length === 0) {
      return res.status(400).json({ message: 'Invalid merge parameters' });
    }

    // Start transaction
    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get all contacts to merge
      const placeholders = [keepId, ...mergeIds].map(() => '?').join(',');
      const [contacts] = await connection.query(
        `SELECT * FROM contacts WHERE id IN (${placeholders})`,
        [keepId, ...mergeIds]
      );

      if (contacts.length < 2) {
        throw new Error('Not enough contacts to merge');
      }

      // Find the keep contact
      const keepContact = contacts.find(c => c.id === keepId);
      if (!keepContact) {
        throw new Error('Keep contact not found');
      }

      // Merge data - keep non-empty values from other contacts
      const mergedData = {
        first_name: keepContact.first_name,
        last_name: keepContact.last_name,
        email: keepContact.email,
        company: keepContact.company,
        custom_data: JSON.parse(keepContact.custom_data || '{}')
      };

      // Merge other contacts data
      for (const contact of contacts) {
        if (contact.id === keepId) continue;
        
        if (!mergedData.first_name && contact.first_name) {
          mergedData.first_name = contact.first_name;
        }
        if (!mergedData.last_name && contact.last_name) {
          mergedData.last_name = contact.last_name;
        }
        if (!mergedData.email && contact.email) {
          mergedData.email = contact.email;
        }
        if (!mergedData.company && contact.company) {
          mergedData.company = contact.company;
        }
        
        // Merge custom data
        const customData = JSON.parse(contact.custom_data || '{}');
        Object.keys(customData).forEach(key => {
          if (!mergedData.custom_data[key]) {
            mergedData.custom_data[key] = customData[key];
          }
        });
      }

      // Update the keep contact with merged data
      await connection.query(
        `UPDATE contacts 
         SET first_name = ?, last_name = ?, email = ?, company = ?, 
             custom_data = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          mergedData.first_name,
          mergedData.last_name,
          mergedData.email,
          mergedData.company,
          JSON.stringify(mergedData.custom_data),
          keepId
        ]
      );

      // Move all interactions to the keep contact
      const mergePlaceholders = mergeIds.map(() => '?').join(',');
      await connection.query(
        `UPDATE contact_interactions 
         SET contact_id = ?
         WHERE contact_id IN (${mergePlaceholders})`,
        [keepId, ...mergeIds]
      );

      // Delete the merged contacts
      await connection.query(
        `DELETE FROM contacts WHERE id IN (${mergePlaceholders})`,
        mergeIds
      );

      // Log the merge
      await connection.query(
        `INSERT INTO contact_interactions 
         (contact_id, interaction_type, agent_id, details)
         VALUES (?, 'merge', ?, ?)`,
        [
          keepId,
          req.user.id,
          JSON.stringify({
            merged_ids: mergeIds,
            merged_count: mergeIds.length
          })
        ]
      );

      await connection.commit();

      res.json({
        message: 'Contacts merged successfully',
        merged_count: mergeIds.length
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error merging contacts:', error);
    res.status(500).json({ message: 'Error merging contacts' });
  }
});

// ==================== CUSTOM FIELDS MANAGEMENT ====================

// Get campaign custom fields
router.get('/campaigns/:id/fields', authenticateToken, async (req, res) => {
  try {
    const [campaigns] = await db.query(
      'SELECT custom_fields FROM campaigns WHERE id = ?',
      [req.params.id]
    );

    if (!campaigns.length) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const fields = JSON.parse(campaigns[0].custom_fields || '{}');
    res.json(fields);
  } catch (error) {
    console.error('Error fetching campaign fields:', error);
    res.status(500).json({ message: 'Error fetching campaign fields' });
  }
});

// Update campaign custom fields
router.put('/campaigns/:id/fields', authenticateToken, async (req, res) => {
  try {
    const { fields } = req.body;

    await db.query(
      'UPDATE campaigns SET custom_fields = ? WHERE id = ?',
      [JSON.stringify(fields), req.params.id]
    );

    res.json({ message: 'Campaign fields updated successfully' });
  } catch (error) {
    console.error('Error updating campaign fields:', error);
    res.status(500).json({ message: 'Error updating campaign fields' });
  }
});

module.exports = router;