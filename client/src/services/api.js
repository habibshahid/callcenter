// src/services/api.js
const API_URL = 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const handleResponse = async (response) => {
  const text = await response.text(); // Get response as text first
  
  let data;
  try {
    data = text ? JSON.parse(text) : {}; // Try to parse if there's content
  } catch (e) {
    console.error('Error parsing response:', text);
    data = { message: text };
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    
    console.error('API Error:', {
      status: response.status,
      data: data,
      url: response.url
    });
    
    throw new Error(data.message || 'Something went wrong');
  }
  
  return data;
};

export const api = {
  // Auth related methods
  login: (credentials) => 
    fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }).then(handleResponse),
  
  logout: async () => {
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: getHeaders()
      });
      await handleResponse(response);
      return true;
    } catch (error) {
      console.error('Logout API error:', error);
      throw error;
    }
  },
  
  register: (userData) =>
    fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    }).then(handleResponse),

  // User related methods
  getUserProfile: () =>
    fetch(`${API_URL}/user/profile`, {
      headers: getHeaders()
    }).then(handleResponse),

  updateProfile: (profileData) =>
    fetch(`${API_URL}/user/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(profileData)
    }).then(handleResponse),

  changePassword: (passwords) =>
    fetch(`${API_URL}/user/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(passwords)
    }).then(handleResponse),

  // Breaks related methods
  getBreaks: () =>
    fetch(`${API_URL}/breaks`, {
      headers: getHeaders()
    }).then(handleResponse),

  // Contact related methods
  getContacts: () =>
    fetch(`${API_URL}/contacts`, {
      headers: getHeaders()
    }).then(handleResponse),

  getContactHistory: (contactId) =>
    fetch(`${API_URL}/contacts/${contactId}/history`, {
      headers: getHeaders()
    }).then(handleResponse),

  endCall: (contactId) =>
    fetch(`${API_URL}/contacts/${contactId}/end`, {
      method: 'POST',
      headers: getHeaders()
    }).then(handleResponse),

  holdCall: (contactId, isHold) =>
    fetch(`${API_URL}/contacts/${contactId}/hold`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ isHold })
    }).then(handleResponse),

  transferCall: (contactId, targetAgent) =>
    fetch(`${API_URL}/contacts/${contactId}/transfer`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ targetAgent })
    }).then(handleResponse),

  toggleRecording: (contactId, isPaused) =>
    fetch(`${API_URL}/contacts/${contactId}/recording`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ isPaused })
    }).then(handleResponse),

  // Permissions related methods
  getPermissions: () =>
    fetch(`${API_URL}/user/permissions`, {
      headers: getHeaders()
    }).then(handleResponse),

  // Notifications related methods
  getNotifications: () =>
    fetch(`${API_URL}/notifications`, {
      headers: getHeaders()
    }).then(handleResponse),

  markNotificationRead: (notificationId) =>
    fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: getHeaders()
    }).then(handleResponse),

  // Settings related methods
  getUserSettings: () =>
    fetch(`${API_URL}/user/settings`, {
      headers: getHeaders()
    }).then(handleResponse),

  updateUserSettings: (settings) =>
    fetch(`${API_URL}/user/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings)
    }).then(handleResponse),

  // Dashboard related methods
  getDashboardStats: () =>
    fetch(`${API_URL}/dashboard/stats`, {
      headers: getHeaders()
    }).then(handleResponse),

  getActiveAgents: () =>
    fetch(`${API_URL}/dashboard/active-agents`, {
      headers: getHeaders()
    }).then(handleResponse),
  
  getSipConfig: () =>
    fetch(`${API_URL}/sip/config`, {
      headers: getHeaders()
    }).then(handleResponse),

  lookupContact: (phoneNumber) =>
    fetch(`${API_URL}/contacts/lookup/${phoneNumber}`, {
      headers: getHeaders()
    }).then(handleResponse),

  // Add new contact
  addContact: (contactData) =>
    fetch(`${API_URL}/contacts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(contactData)
    }).then(handleResponse),

  // Update contact
  updateContact: (contactId, contactData) =>
    fetch(`${API_URL}/contacts/${contactId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(contactData)
    }).then(handleResponse),
  
  updateAgentStatus: (status) => 
    fetch(`${API_URL}/agent/status`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(status)
    }).then(handleResponse),
  
  getUserStatus: () =>
    fetch(`${API_URL}/user/status`, {
      headers: getHeaders()
    }).then(handleResponse),

  updateUserStatus: (statusData) =>
    fetch(`${API_URL}/user/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(statusData)
    }).then(handleResponse),
  // Add debug method
  testSipConfig: async () => {
    try {
      const response = await fetch(`${API_URL}/sip/config`, {
        headers: getHeaders()
      });
      const text = await response.text();
      console.log('Raw SIP config response:', text);
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('JSON parse error:', e);
        throw new Error('Invalid JSON response');
      }
    } catch (error) {
      console.error('SIP config fetch error:', error);
      throw error;
    }
  }
};

export default api;