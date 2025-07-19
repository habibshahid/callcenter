// utils/phoneUtils.js

/**
 * Normalize phone number for consistent storage and searching
 * Removes all non-numeric characters except + at the beginning
 * @param {string} phone - Raw phone number
 * @returns {string} - Normalized phone number
 */
function normalizePhone(phone) {
  if (!phone) return '';
  
  // Remove all non-numeric characters except leading +
  let normalized = phone.toString().replace(/[^\d+]/g, '');
  
  // Remove + if not at the beginning
  normalized = normalized.replace(/\+(?!^)/g, '');
  
  // Handle common formats
  if (normalized.startsWith('+1') && normalized.length === 12) {
    // US/Canada with +1
    normalized = normalized.substring(2);
  } else if (normalized.startsWith('1') && normalized.length === 11) {
    // US/Canada with 1
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

/**
 * Format phone number for display
 * @param {string} phone - Phone number
 * @param {string} format - Output format (US, INTL, E164)
 * @returns {string} - Formatted phone number
 */
function formatPhone(phone, format = 'US') {
  const normalized = normalizePhone(phone);
  
  if (!normalized) return '';
  
  switch (format) {
    case 'US':
      if (normalized.length === 10) {
        return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
      }
      break;
      
    case 'E164':
      if (normalized.length === 10) {
        return `+1${normalized}`;
      } else if (normalized.length > 10) {
        return `+${normalized}`;
      }
      break;
      
    case 'INTL':
      // Basic international format
      if (normalized.length >= 10) {
        return `+${normalized}`;
      }
      break;
  }
  
  return phone; // Return original if can't format
}

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {object} - { valid: boolean, error?: string }
 */
function validatePhone(phone) {
  if (!phone) {
    return { valid: false, error: 'Phone number is required' };
  }
  
  const normalized = normalizePhone(phone);
  
  // Check minimum length
  if (normalized.length < 10) {
    return { valid: false, error: 'Phone number too short' };
  }
  
  // Check maximum length
  if (normalized.length > 15) {
    return { valid: false, error: 'Phone number too long' };
  }
  
  // Check if it's all numbers (after normalization)
  if (!/^\+?\d+$/.test(normalized)) {
    return { valid: false, error: 'Invalid characters in phone number' };
  }
  
  return { valid: true };
}

/**
 * Extract multiple phone numbers from text
 * @param {string} text - Text containing phone numbers
 * @returns {array} - Array of normalized phone numbers
 */
function extractPhones(text) {
  if (!text) return [];
  
  // Common phone patterns
  const patterns = [
    /\+?1?\s*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/g,
    /\+(\d{1,3})\s*(\d{4,14})/g,
    /(\d{10,15})/g
  ];
  
  const phones = new Set();
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const normalized = normalizePhone(match);
        if (normalized && normalized.length >= 10) {
          phones.add(normalized);
        }
      });
    }
  });
  
  return Array.from(phones);
}

/**
 * Check if two phone numbers are the same
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} - True if numbers match
 */
function comparePhones(phone1, phone2) {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

module.exports = {
  normalizePhone,
  formatPhone,
  validatePhone,
  extractPhones,
  comparePhones
};