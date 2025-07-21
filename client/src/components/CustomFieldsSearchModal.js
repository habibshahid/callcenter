// client/src/components/CustomFieldsSearchModal.js
import React, { useState, useEffect } from 'react';
import { Search, X, Plus, Trash2, Filter, Database } from 'lucide-react';
import { api } from '../services/api';

export default function CustomFieldsSearchModal({ campaignId, onClose, onSearch }) {
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState([
    { field: '', value: '', operator: 'contains' }
  ]);

  useEffect(() => {
    if (campaignId) {
      loadCustomFields();
    }
  }, [campaignId]);

  const loadCustomFields = async () => {
    try {
      setLoading(true);
      const response = await api.getCampaignCustomFields(campaignId);
      setCustomFields(response.fields || []);
      
      // If we have fields, set the first filter to use the first field
      if (response.fields && response.fields.length > 0) {
        setFilters([{
          field: response.fields[0].name,
          value: '',
          operator: 'contains'
        }]);
      }
    } catch (error) {
      console.error('Error loading custom fields:', error);
      setCustomFields([]);
    } finally {
      setLoading(false);
    }
  };

  const addFilter = () => {
    const defaultField = customFields.length > 0 ? customFields[0].name : '';
    setFilters([...filters, { field: defaultField, value: '', operator: 'contains' }]);
  };

  const removeFilter = (index) => {
    if (filters.length > 1) {
      setFilters(filters.filter((_, i) => i !== index));
    }
  };

  const updateFilter = (index, key, value) => {
    const updated = [...filters];
    updated[index][key] = value;
    setFilters(updated);
  };

  const getOperatorsForField = (fieldName) => {
    const field = customFields.find(f => f.name === fieldName);
    const fieldType = field?.type || 'text';

    const baseOperators = [
      { value: 'contains', label: 'Contains' },
      { value: 'equals', label: 'Equals' },
      { value: 'is_empty', label: 'Is Empty' },
      { value: 'is_not_empty', label: 'Is Not Empty' }
    ];

    if (fieldType === 'text') {
      return [
        ...baseOperators,
        { value: 'starts_with', label: 'Starts With' },
        { value: 'ends_with', label: 'Ends With' }
      ];
    } else if (fieldType === 'number') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
        { value: 'is_empty', label: 'Is Empty' },
        { value: 'is_not_empty', label: 'Is Not Empty' }
      ];
    }

    return baseOperators;
  };

  const handleSearch = () => {
    const validFilters = filters.filter(f => 
      f.field && (f.value.trim() !== '' || ['is_empty', 'is_not_empty'].includes(f.operator))
    );

    if (validFilters.length === 0) {
      alert('Please add at least one filter with a value');
      return;
    }

    onSearch({
      campaign_id: campaignId,
      custom_field_filters: validFilters
    });
    onClose();
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <Database size={20} className="me-2" />
              Search Custom Fields
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            />
          </div>
          
          <div className="modal-body">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border" />
                <p className="mt-2">Loading custom fields...</p>
              </div>
            ) : customFields.length === 0 ? (
              <div className="alert alert-info">
                <h6>No Custom Fields Found</h6>
                <p className="mb-0">
                  This campaign doesn't have any contacts with custom fields yet. 
                  Custom fields are automatically detected when you import contacts with additional columns.
                </p>
              </div>
            ) : (
              <>
                <div className="alert alert-info mb-4">
                  <strong>Available Custom Fields:</strong>
                  <div className="mt-2">
                    {customFields.map((field, index) => (
                      <span key={field.name} className="badge bg-secondary me-2 mb-1">
                        {field.label} ({field.type})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">
                    <Filter size={16} className="me-1" />
                    Filter Conditions
                  </label>
                  
                  {filters.map((filter, index) => (
                    <div key={index} className="row mb-2 align-items-end">
                      <div className="col-md-4">
                        {index === 0 && <label className="form-label small">Custom Field</label>}
                        <select 
                          className="form-select"
                          value={filter.field}
                          onChange={(e) => updateFilter(index, 'field', e.target.value)}
                        >
                          <option value="">Select Field</option>
                          {customFields.map(field => (
                            <option key={field.name} value={field.name}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3">
                        {index === 0 && <label className="form-label small">Operator</label>}
                        <select 
                          className="form-select"
                          value={filter.operator}
                          onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                          disabled={!filter.field}
                        >
                          {getOperatorsForField(filter.field).map(op => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        {index === 0 && <label className="form-label small">Value</label>}
                        <input 
                          type="text"
                          className="form-control"
                          placeholder={['is_empty', 'is_not_empty'].includes(filter.operator) ? '(not required)' : 'Enter value...'}
                          value={filter.value}
                          onChange={(e) => updateFilter(index, 'value', e.target.value)}
                          disabled={!filter.field || ['is_empty', 'is_not_empty'].includes(filter.operator)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && index === filters.length - 1) {
                              handleSearch();
                            }
                          }}
                        />
                      </div>
                      <div className="col-md-1">
                        {filters.length > 1 && (
                          <button 
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => removeFilter(index)}
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
                    onClick={addFilter}
                  >
                    <Plus size={16} className="me-1" />
                    Add Another Filter
                  </button>
                </div>

                <div className="border-top pt-3">
                  <h6 className="mb-2">Search Tips:</h6>
                  <ul className="small text-muted mb-0">
                    <li>All filter conditions must match (AND logic)</li>
                    <li>Text searches are case-insensitive</li>
                    <li>Number fields support comparison operators</li>
                    <li>Use "Is Empty" to find contacts missing a custom field</li>
                  </ul>
                </div>
              </>
            )}
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
              disabled={loading || customFields.length === 0}
            >
              <Search size={18} className="me-2" />
              Search Custom Fields
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}