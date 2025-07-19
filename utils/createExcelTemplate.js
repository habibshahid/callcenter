// utils/createExcelTemplate.js - Creates a sample Excel template
const XLSX = require('xlsx');
const path = require('path');

function createExcelTemplate() {
  // Sample data
  const data = [
    {
      'Phone': '(555) 123-4567',
      'First Name': 'John',
      'Last Name': 'Doe',
      'Email': 'john.doe@example.com',
      'Company': 'ABC Corporation',
      'Lead Source': 'Website',
      'Budget': 50000,
      'Notes': 'Interested in premium package'
    },
    {
      'Phone': '555-234-5678',
      'First Name': 'Jane',
      'Last Name': 'Smith',
      'Email': 'jane.smith@example.com',
      'Company': 'XYZ Industries',
      'Lead Source': 'Referral',
      'Budget': 75000,
      'Notes': 'Contacted via LinkedIn'
    },
    {
      'Phone': '+1 (555) 345-6789',
      'First Name': 'Michael',
      'Last Name': 'Johnson',
      'Email': 'mjohnson@techcorp.com',
      'Company': 'Tech Corp',
      'Lead Source': 'Trade Show',
      'Budget': 100000,
      'Notes': 'Met at conference 2024'
    }
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Create worksheet from data
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 15 }, // Phone
    { wch: 12 }, // First Name
    { wch: 12 }, // Last Name
    { wch: 25 }, // Email
    { wch: 20 }, // Company
    { wch: 15 }, // Lead Source
    { wch: 10 }, // Budget
    { wch: 30 }  // Notes
  ];
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
  
  // Create instructions sheet
  const instructions = [
    ['Import Instructions'],
    [''],
    ['1. Phone number is REQUIRED - can be in any format'],
    ['2. Standard fields: First Name, Last Name, Email, Company'],
    ['3. Custom fields: Any additional columns will be imported as custom data'],
    ['4. Save as .xlsx or .csv format'],
    ['5. Maximum file size: 10MB'],
    ['6. Duplicates will be detected by phone number'],
    [''],
    ['Tips:'],
    ['- Phone numbers are automatically normalized'],
    ['- International numbers should include country code'],
    ['- Empty cells are allowed except for Phone'],
    ['- You can add unlimited custom columns']
  ];
  
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
  
  // Write file
  const filename = path.join(__dirname, '..', 'public', 'contacts_import_template.xlsx');
  XLSX.writeFile(wb, filename);
  
  console.log(`✅ Excel template created at: ${filename}`);
  console.log('Users can download it from: /contacts_import_template.xlsx');
}

// Run if called directly
if (require.main === module) {
  createExcelTemplate();
}

module.exports = createExcelTemplate;