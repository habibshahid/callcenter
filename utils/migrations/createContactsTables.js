// utils/migrations/createContactsTables.js
require('dotenv').config();
const db = require('../../config/database');

async function createContactsTables() {
  try {
    console.log('Creating contacts management tables...');

    // Create campaigns table
    await db.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('active', 'paused', 'completed') DEFAULT 'active',
        total_contacts INT DEFAULT 0,
        custom_fields JSON,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create contacts table with optimized structure
    await db.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        
        -- Core fields for performance
        phone_primary VARCHAR(20) NOT NULL,
        phone_normalized VARCHAR(20) GENERATED ALWAYS AS (
          REGEXP_REPLACE(REGEXP_REPLACE(phone_primary, '[^0-9+]', ''), '^\\\\+?1?', '')
        ) STORED,
        phone_secondary VARCHAR(20),
        
        -- Common fields (indexed)
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        company VARCHAR(255),
        
        -- Campaign association
        campaign_id INT,
        
        -- Status tracking
        status ENUM('new', 'contacted', 'interested', 'not_interested', 'do_not_call', 'invalid') DEFAULT 'new',
        last_contacted_at TIMESTAMP NULL,
        contact_attempts INT DEFAULT 0,
        
        -- Dynamic fields
        custom_data JSON,
        tags JSON,
        
        -- Search optimization
        search_text TEXT GENERATED ALWAYS AS (
          LOWER(CONCAT_WS(' ', 
            IFNULL(first_name, ''), 
            IFNULL(last_name, ''), 
            IFNULL(email, ''), 
            IFNULL(company, ''),
            IFNULL(phone_primary, ''),
            IFNULL(phone_secondary, '')
          ))
        ) STORED,
        
        -- Metadata
        source VARCHAR(50),
        created_by INT,
        assigned_to INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Indexes for performance
        INDEX idx_phone_normalized (phone_normalized),
        INDEX idx_phone_primary (phone_primary),
        INDEX idx_campaign_id (campaign_id),
        INDEX idx_status (status),
        INDEX idx_email (email),
        INDEX idx_name (first_name, last_name),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_created_at (created_at),
        FULLTEXT idx_search (search_text),
        
        -- Foreign keys
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        
        -- Constraints
        UNIQUE KEY unique_phone_campaign (phone_normalized, campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create contact interactions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS contact_interactions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        contact_id BIGINT NOT NULL,
        interaction_type ENUM('call', 'email', 'sms', 'note', 'status_change') NOT NULL,
        direction ENUM('inbound', 'outbound', 'internal') DEFAULT 'internal',
        agent_id INT,
        details JSON,
        duration INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_contact_id (contact_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_created_at (created_at),
        INDEX idx_type (interaction_type),
        
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create import jobs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT,
        filename VARCHAR(255),
        total_rows INT DEFAULT 0,
        processed_rows INT DEFAULT 0,
        successful_rows INT DEFAULT 0,
        failed_rows INT DEFAULT 0,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        field_mapping JSON,
        error_log JSON,
        created_by INT,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_status (status),
        INDEX idx_campaign_id (campaign_id),
        
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Contacts management tables created successfully');

    // Insert sample campaign
    await db.query(`
      INSERT INTO campaigns (name, description, custom_fields) 
      VALUES (
        'Default Campaign', 
        'Default campaign for general contacts',
        JSON_OBJECT(
          'industry', JSON_OBJECT('type', 'text', 'required', false),
          'lead_source', JSON_OBJECT('type', 'text', 'required', false),
          'budget', JSON_OBJECT('type', 'number', 'required', false)
        )
      )
    `);

    console.log('✅ Sample campaign created');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating contacts tables:', error);
    process.exit(1);
  }
}

createContactsTables();