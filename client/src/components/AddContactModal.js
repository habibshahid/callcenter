// client/src/components/AddContactModal.js
import React, { useState } from 'react';
import { X, Phone, Mail, Building, User, Save } from 'lucide-react';
import { api } from '../services/api';

export default function AddContactModal({ campaigns, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    phone_primary: '',
    phone_secondary: '',
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    campaign_id: campaigns.length > 0 ? campaigns[0].id : '',
    status: 'new',
    custom_data: {}
  });
  
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState([]);

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
    
    if (!formData.phone_primary) {
      newErrors.phone_primary = 'Phone number is required';
    } else if (!/^[\d\s\-\(\)\+\.]+$/.test(formData.phone_primary)) {
      newErrors.phone_primary = 'Invalid phone number format';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.campaign_id) {
      newErrors.campaign_id = 'Campaign is required';
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
      await api.createContact(formData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating contact:', error);
      setErrors({ submit: error.message || 'Error creating contact' });
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
              Add New Contact
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

              <div className="row">
                {/* Campaign Selection */}
                <div className="col-12 mb-3">
                  <label className="form-label">Campaign <span className="text-danger">*</span></label>
                  <select 
                    className={`form-select ${errors.campaign_id ? 'is-invalid' : ''}`}
                    name="campaign_id"
                    value={formData.campaign_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Campaign</option>
                    {campaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                  {errors.campaign_id && (
                    <div className="invalid-feedback">{errors.campaign_id}</div>
                  )}
                </div>

                {/* Phone Numbers */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    <Phone size={16} className="me-1" />
                    Primary Phone <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="text" 
                    className={`form-control ${errors.phone_primary ? 'is-invalid' : ''}`}
                    name="phone_primary"
                    value={formData.phone_primary}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                    required
                  />
                  {errors.phone_primary && (
                    <div className="invalid-feedback">{errors.phone_primary}</div>
                  )}
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Secondary Phone</label>
                  <input 
                    type="text" 
                    className="form-control"
                    name="phone_secondary"
                    value={formData.phone_secondary}
                    onChange={handleChange}
                    placeholder="(555) 123-4568"
                  />
                </div>

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
                    Save Contact
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