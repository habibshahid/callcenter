const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

router.use(authenticateToken);

// Get all global settings
router.get('/global', async (req, res) => {
  try {
    const [settings] = await db.query(
      'SELECT setting_key, setting_value FROM global_settings'
    );
    
    // Convert to object format
    const settingsObject = {};
    settings.forEach(setting => {
      // Parse boolean values
      if (setting.setting_value === 'true') {
        settingsObject[setting.setting_key] = true;
      } else if (setting.setting_value === 'false') {
        settingsObject[setting.setting_key] = false;
      } else {
        settingsObject[setting.setting_key] = setting.setting_value;
      }
    });
    
    res.json(settingsObject);
  } catch (error) {
    console.error('Error fetching global settings:', error);
    res.status(500).json({ message: 'Error fetching global settings' });
  }
});

// Get specific global setting
router.get('/global/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const [settings] = await db.query(
      'SELECT setting_value FROM global_settings WHERE setting_key = ?',
      [key]
    );
    
    if (!settings.length) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    let value = settings[0].setting_value;
    // Parse boolean values
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    
    res.json({ key, value });
  } catch (error) {
    console.error('Error fetching global setting:', error);
    res.status(500).json({ message: 'Error fetching global setting' });
  }
});

module.exports = router;