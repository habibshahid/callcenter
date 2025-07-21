// client/src/components/AdvancedSearchModal.js
import React, { useState, useEffect } from 'react';
import { Search, X, Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api';

export default function AdvancedSearchModal({ campaigns, onClose, onSearch }) {
  const [searchCriteria, setSearchCriteria] = useState([
    { field: 'any', value: '', operator: 'contains' }
  ]);
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');

  // Standard fields always available
  const standardFields = [
    { value: 'any', label: 'Any Field' },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'company', label: 'Company' },
    { value: 'phone', label: 'Phone' },
    { value: 'status', label: 'Status' }
  ];

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignCustomFields();
    }
  }, [selectedCampaign]);

  const loadCampaignCustomFields = async () => {
    try {
      const fields = await api.getCampaignFields(selectedCampaign);
      const customFieldOptions = Object.keys(fields).map(key => ({
        value: `custom.${key}`,
        label: `Custom: ${key}`
      }));
      setAvailableFields([...standardFields, ...customFieldOptions]);
    } catch (error) {
      console.error('Error loading custom fields:', error);
      setAvailableFields(standardFields);
    }
  };

  const addCriteria = () => {
    setSearchCriteria([...searchCriteria, { field: 'any', value: '', operator: 'contains' }]);
  };

  const removeCriteria = (index) => {
    setSearchCriteria(searchCriteria.filter((_, i) => i !== index));
  };

  const updateCriteria = (index, key, value) => {
    const updated = [...searchCriteria];
    updated[index][key] = value;
    setSearchCriteria(updated);
  };

  const handleSearch = () => {
    // Build search parameters
    const searchParams = {
      campaign_id: selectedCampaign,
      advanced: true,
      criteria: searchCriteria.filter(c => c.value.trim() !== '')
    };

    onSearch(searchParams);
    onClose();
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <Search size={20} className="me-2" />
              Advanced Search
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            />
          </div>
          
          <div className="modal-body">
            {/* Campaign Selection */}
            <div className="mb-4">
              <label className="form-label">Campaign</label>
              <select 
                className="form-select"
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
              >
                <option value="">All Campaigns</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              {selectedCampaign && (
                <small className="text-muted">
                  Select a campaign to search its custom fields
                </small>
              )}
            </div>

            {/* Search Criteria */}
            <div className="mb-3">
              <label className="form-label">Search Criteria</label>
              {searchCriteria.map((criteria, index) => (
                <div key={index} className="row mb-2">
                  <div className="col-md-4">
                    <select 
                      className="form-select"
                      value={criteria.field}
                      onChange={(e) => updateCriteria(index, 'field', e.target.value)}
                    >
                      {(selectedCampaign ? availableFields : standardFields).map(field => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <select 
                      className="form-select"
                      value={criteria.operator}
                      onChange={(e) => updateCriteria(index, 'operator', e.target.value)}
                    >
                      <option value="contains">Contains</option>
                      <option value="equals">Equals</option>
                      <option value="starts_with">Starts With</option>
                      <option value="ends_with">Ends With</option>
                      <option value="not_contains">Not Contains</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="Search value..."
                      value={criteria.value}
                      onChange={(e) => updateCriteria(index, 'value', e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSearch();
                      }}
                    />
                  </div>
                  <div className="col-md-1">
                    {searchCriteria.length > 1 && (
                      <button 
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeCriteria(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button 
                type="button"
                className="btn btn-sm btn-outline-primary mt-2"
                onClick={addCriteria}
              >
                <Plus size={16} className="me-1" />
                Add Criteria
              </button>
            </div>

            {/* Search Tips */}
            <div className="alert alert-info">
              <h6 className="alert-heading">Search Tips:</h6>
              <ul className="mb-0 small">
                <li>Select "Any Field" to search across all contact fields</li>
                <li>Choose a specific field to narrow your search</li>
                <li>Custom fields are available when a campaign is selected</li>
                <li>Use multiple criteria for more precise results</li>
              </ul>
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={!searchCriteria.some(c => c.value.trim())}
            >
              <Search size={18} className="me-2" />
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}