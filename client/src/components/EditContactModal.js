// client/src/components/EditContactModal.js
import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, Building, User, Save } from 'lucide-react';
import { api } from '../services/api';

export default function EditContactModal({ contact, campaigns, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    status: 'new',
    custom_data: {}
  });
  
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    if (contact) {
      // Initialize form with contact data
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        company: contact.company || '',
        status: contact.status || 'new',
        custom_data: contact.custom_data || {}
      });
      
      // Extract custom field keys
      if (contact.custom_data && typeof contact.custom_data === 'object') {
        setCustomFields(Object.keys(contact.custom_data));
      }
    }
  }, [contact]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCustomFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      custom_data: {
        ...prev.custom_data,
        [key]: value
      }
    }));
  };

  const addCustomField = () => {
    const fieldName = prompt('Enter custom field name:');
    if (fieldName && !customFields.includes(fieldName)) {
      setCustomFields([...customFields, fieldName]);
    }
  };

  const removeCustomField = (field) => {
    setCustomFields(customFields.filter(f => f !== field));
    const newCustomData = { ...formData.custom_data };
    delete newCustomData[field];
    setFormData(prev => ({ ...prev, custom_data: newCustomData }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    
    try {
      await api.updateContactDetails(contact.id, formData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating contact:', error);
      setErrors({ submit: error.message || 'Error updating contact' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <User size={20} className="me-2" />
              Edit Contact
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={saving}
            />
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {errors.submit && (
                <div className="alert alert-danger alert-dismissible">
                  {errors.submit}
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setErrors(prev => ({ ...prev, submit: '' }))}
                  />
                </div>
              )}

              {/* Contact Info (Read-only) */}
              <div className="bg-light p-3 rounded mb-3">
                <div className="row">
                  <div className="col-md-4">
                    <small className="text-muted">Phone</small>
                    <div className="fw-medium">{contact.phone_primary}</div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted">Campaign</small>
                    <div className="fw-medium">{contact.campaign_name}</div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted">Created</small>
                    <div className="fw-medium">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
                {/* Name Fields */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">First Name</label>
                  <input 
                    type="text" 
                    className="form-control"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="John"
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Last Name</label>
                  <input 
                    type="text" 
                    className="form-control"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Doe"
                  />
                </div>

                {/* Email and Company */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    <Mail size={16} className="me-1" />
                    Email
                  </label>
                  <input 
                    type="email" 
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john.doe@example.com"
                  />
                  {errors.email && (
                    <div className="invalid-feedback">{errors.email}</div>
                  )}
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    <Building size={16} className="me-1" />
                    Company
                  </label>
                  <input 
                    type="text" 
                    className="form-control"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="ABC Corporation"
                  />
                </div>

                {/* Status */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">Status</label>
                  <select 
                    className="form-select"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="do_not_call">Do Not Call</option>
                  </select>
                </div>
              </div>

              {/* Custom Fields Section */}
              <div className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">Custom Fields</h6>
                  <button 
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addCustomField}
                  >
                    Add Custom Field
                  </button>
                </div>

                {customFields.map(field => (
                  <div key={field} className="row mb-2">
                    <div className="col-4">
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        value={field}
                        disabled
                      />
                    </div>
                    <div className="col-7">
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        value={formData.custom_data[field] || ''}
                        onChange={(e) => handleCustomFieldChange(field, e.target.value)}
                        placeholder="Value"
                      />
                    </div>
                    <div className="col-1">
                      <button 
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeCustomField(field)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary d-flex align-items-center gap-2"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 