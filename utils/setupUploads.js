// utils/setupUploads.js
const fs = require('fs');
const path = require('path');

function setupUploadsDirectory() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const tempDir = path.join(uploadsDir, 'temp');

  // Create directories if they don't exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log('✅ Created uploads directory');
  }

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
    console.log('✅ Created uploads/temp directory');
  }

  // Create .gitignore in uploads directory to exclude uploaded files
  const gitignorePath = path.join(uploadsDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
    console.log('✅ Created uploads/.gitignore');
  }

  console.log('✅ Uploads directory setup complete');
}

// Run if called directly
if (require.main === module) {
  setupUploadsDirectory();
}

module.exports = setupUploadsDirectory;