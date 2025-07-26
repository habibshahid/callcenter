// utils/migrations/createTasksTables.js
require('dotenv').config();
const db = require('../../config/database');

async function createTasksTables() {
  try {
    console.log('Creating tasks tables...');

    // Create tasks table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contact_id BIGINT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATETIME NOT NULL,
        reminder_minutes INT DEFAULT 30,
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        type ENUM('task', 'call', 'meeting', 'follow_up') DEFAULT 'task',
        status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
        created_by INT NOT NULL,
        assigned_to INT,
        parent_task_id INT,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_contact_id (contact_id),
        INDEX idx_due_date (due_date),
        INDEX idx_status (status),
        INDEX idx_created_by (created_by),
        INDEX idx_assigned_to (assigned_to),
        
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Tasks table created successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tasks tables:', error);
    process.exit(1);
  }
}

createTasksTables();