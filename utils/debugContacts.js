// utils/debugContacts.js - Fixed version
require('dotenv').config();
const db = require('../config/database');

async function debugContacts() {
  try {
    console.log('🔍 Debugging Contacts...\n');

    // 1. Check total contacts
    const [total] = await db.query('SELECT COUNT(*) as count FROM contacts');
    console.log(`Total contacts in database: ${total[0].count}\n`);

    // 2. Check campaigns
    const [campaigns] = await db.query('SELECT id, name, total_contacts FROM campaigns');
    console.log('Campaigns:');
    campaigns.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id}): ${c.total_contacts || 0} contacts`);
    });

    // 3. Get sample contacts - WITHOUT parameters first
    console.log('\nSample contacts (without parameters):');
    const [contacts] = await db.query(`
      SELECT 
        id,
        phone_primary,
        phone_normalized,
        first_name,
        last_name,
        campaign_id,
        status,
        created_at
      FROM contacts 
      LIMIT 5
    `);
    
    contacts.forEach(c => {
      console.log(`\nID: ${c.id}`);
      console.log(`Phone: ${c.phone_primary} (normalized: ${c.phone_normalized})`);
      console.log(`Name: ${c.first_name || ''} ${c.last_name || ''}`);
      console.log(`Campaign: ${c.campaign_id}, Status: ${c.status}`);
      console.log(`Created: ${c.created_at}`);
    });

    // 4. Test the query with inline values
    console.log('\n📋 Testing contacts query with inline LIMIT...');
    const testQueryInline = `
      SELECT 
        c.*,
        cam.name as campaign_name,
        u.username as assigned_to_name
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON c.assigned_to = u.id
      ORDER BY c.created_at DESC
      LIMIT 10 OFFSET 0
    `;
    
    const [testResultsInline] = await db.query(testQueryInline);
    console.log(`✅ Inline query returned ${testResultsInline.length} contacts`);

    // 5. Test with string concatenation (temporary workaround)
    console.log('\n📋 Testing with string concatenation...');
    const limit = 10;
    const offset = 0;
    const testQueryConcat = `
      SELECT 
        c.*,
        cam.name as campaign_name,
        u.username as assigned_to_name
      FROM contacts c
      LEFT JOIN campaigns cam ON c.campaign_id = cam.id
      LEFT JOIN users u ON c.assigned_to = u.id
      ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    const [testResultsConcat] = await db.query(testQueryConcat);
    console.log(`✅ Concatenated query returned ${testResultsConcat.length} contacts`);

    // 6. Show a sample contact with all fields
    if (testResultsInline.length > 0) {
      console.log('\n📄 Sample contact with all fields:');
      const sample = testResultsInline[0];
      console.log(JSON.stringify(sample, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

debugContacts();