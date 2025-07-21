// client/src/components/CustomFieldsDisplay.js
import React from 'react';
import { Database, Tag } from 'lucide-react';

export default function CustomFieldsDisplay({ 
  customData, 
  matchedFields = [], 
  displayMode = 'inline', // 'inline', 'card', 'table'
  maxFields = 0 // 0 means show all
}) {
  if (!customData || Object.keys(customData).length === 0) {
    return null;
  }

  const fields = Object.entries(customData);
  const displayFields = maxFields > 0 ? fields.slice(0, maxFields) : fields;
  const hasMore = maxFields > 0 && fields.length > maxFields;

  // Check if a field is matched
  const isMatched = (fieldName) => {
    return matchedFields.some(match => match.field === fieldName);
  };

  if (displayMode === 'inline') {
    return (
      <div className="custom-fields-inline">
        {displayFields.map(([key, value]) => (
          <span 
            key={key} 
            className={`badge me-1 mb-1 ${isMatched(key) ? 'bg-warning text-dark' : 'bg-light text-dark'}`}
          >
            <small>{key}: {value || '(empty)'}</small>
          </span>
        ))}
        {hasMore && (
          <span className="badge bg-secondary me-1 mb-1">
            <small>+{fields.length - maxFields} more</small>
          </span>
        )}
      </div>
    );
  }

  if (displayMode === 'card') {
    return (
      <div className="card border-0 bg-light">
        <div className="card-body py-2 px-3">
          <div className="d-flex align-items-center mb-2">
            <Database size={16} className="text-muted me-2" />
            <small className="text-muted fw-bold">Custom Fields</small>
          </div>
          <div className="row g-2">
            {displayFields.map(([key, value]) => (
              <div key={key} className="col-6">
                <div className={`small ${isMatched(key) ? 'bg-warning rounded px-2 py-1' : ''}`}>
                  <span className="text-muted">{key}:</span>
                  <div className="fw-medium">{value || '(empty)'}</div>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="text-muted small mt-2">
              And {fields.length - maxFields} more fields...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (displayMode === 'table') {
    return (
      <div className="custom-fields-table">
        <table className="table table-sm table-borderless mb-0">
          <tbody>
            {displayFields.map(([key, value]) => (
              <tr key={key} className={isMatched(key) ? 'bg-warning bg-opacity-25' : ''}>
                <td className="text-muted" style={{ width: '40%' }}>
                  {isMatched(key) && <Tag size={14} className="me-1" />}
                  {key}
                </td>
                <td className="fw-medium">
                  {value || <span className="text-muted">(empty)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="text-muted small text-center py-1">
            {fields.length - maxFields} more fields not shown
          </div>
        )}
      </div>
    );
  }

  return null;
}