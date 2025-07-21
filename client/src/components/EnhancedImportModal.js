// client/src/components/EnhancedImportModal.js
import React, { useState } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export default function EnhancedImportModal({ campaigns, onClose, onImportComplete }) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Fields, 3: Import
  const [file, setFile] = useState(null);
  const [campaignId, setCampaignId] = useState('');
  const [preview, setPreview] = useState(null);
  const [fieldMapping, setFieldMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [error, setError] = useState(null);

  // Standard fields that can be mapped
  const standardFields = [
    { value: 'phone_primary', label: 'Phone Number (Required)', required: true },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'company', label: 'Company' },
    { value: 'phone_secondary', label: 'Secondary Phone' }
  ];

  const handleFileUpload = async () => {
    if (!file || !campaignId) {
      alert('Please select a file and campaign');
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaign_id', campaignId);

    try {
      const result = await api.importContactsEnhanced(formData);
      
      console.log('Import API Response:', result);
      
      if (result.requiresMapping) {
        // Validate the response structure
        if (!result.headers || !Array.isArray(result.headers)) {
          throw new Error('Invalid file structure - no headers found');
        }
        
        // Create a properly structured preview object
        const validatedPreview = {
          headers: result.headers,
          rows: Array.isArray(result.rows) ? result.rows : [],
          totalRows: result.totalRows || 0
        };
        
        console.log('Validated Preview:', validatedPreview);
        
        if (validatedPreview.headers.length === 0) {
          throw new Error('The uploaded file appears to be empty');
        }
        
        setPreview(validatedPreview);
        setStep(2);
        
        // Auto-map common field names
        const autoMapping = {};
        validatedPreview.headers.forEach(header => {
          const lowerHeader = header.toLowerCase().trim();
          if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('cell')) {
            autoMapping[header] = 'phone_primary';
          } else if (lowerHeader === 'first name' || lowerHeader === 'firstname' || lowerHeader === 'fname') {
            autoMapping[header] = 'first_name';
          } else if (lowerHeader === 'last name' || lowerHeader === 'lastname' || lowerHeader === 'lname') {
            autoMapping[header] = 'last_name';
          } else if (lowerHeader === 'email' || lowerHeader === 'e-mail') {
            autoMapping[header] = 'email';
          } else if (lowerHeader === 'company' || lowerHeader === 'organization') {
            autoMapping[header] = 'company';
          }
        });
        setFieldMapping(autoMapping);
      } else if (result.message) {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Error uploading file');
      alert(error.message || 'Error uploading file');
    }
  };

  const handleImport = async () => {
    // Validate that phone_primary is mapped
    const hasPhoneMapping = Object.values(fieldMapping).includes('phone_primary');
    if (!hasPhoneMapping) {
      alert('Please map at least one column to Phone Number');
      return;
    }

    setImporting(true);
    setStep(3);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaign_id', campaignId);
    formData.append('field_mapping', JSON.stringify(fieldMapping));

    try {
      const result = await api.importContactsEnhanced(formData);
      
      if (result.jobId) {
        setImportStatus(result);
        pollImportStatus(result.jobId);
      } else {
        throw new Error('No job ID returned from import');
      }
    } catch (error) {
      console.error('Import error:', error);
      setError(error.message || 'Error importing file');
      setImporting(false);
    }
  };

  const pollImportStatus = async (jobId) => {
    const checkStatus = async () => {
      try {
        const status = await api.getImportStatus(jobId);
        setImportStatus(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          setImporting(false);
          if (status.status === 'completed') {
            setTimeout(onImportComplete, 1500);
          }
        } else {
          setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error('Error checking import status:', error);
        setError('Error checking import status');
        setImporting(false);
      }
    };
    
    checkStatus();
  };

  const updateFieldMapping = (header, value) => {
    setFieldMapping(prev => ({
      ...prev,
      [header]: value
    }));
  };

  const getSampleData = (rowIndex, columnIndex) => {
    try {
      if (!preview || !preview.rows || !Array.isArray(preview.rows)) {
        return '(no data)';
      }
      
      const row = preview.rows[rowIndex];
      if (!row || !Array.isArray(row)) {
        return '(no data)';
      }
      
      const value = row[columnIndex];
      if (value === null || value === undefined || value === '') {
        return '(empty)';
      }
      
      const stringValue = String(value);
      if (stringValue.length > 50) {
        return stringValue.substring(0, 47) + '...';
      }
      
      return stringValue;
    } catch (e) {
      console.error('Error getting sample data:', e);
      return '(error)';
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {step === 1 && 'Import Contacts'}
              {step === 2 && 'Map Fields'}
              {step === 3 && 'Import Progress'}
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={importing}
            />
          </div>
          
          <div className="modal-body">
            {/* Error Display */}
            {error && (
              <div className="alert alert-danger alert-dismissible" role="alert">
                <AlertCircle size={18} className="me-2" />
                {error}
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setError(null)}
                />
              </div>
            )}

            {/* Step 1: Upload File */}
            {step === 1 && (
              <>
                <div className="mb-3">
                  <label className="form-label">Campaign</label>
                  <select 
                    className="form-select"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                  >
                    <option value="">Select Campaign</option>
                    {campaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label">File</label>
                  <input 
                    type="file" 
                    className="form-control"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <div className="form-text">
                    Supported formats: CSV, Excel (.xlsx, .xls)
                  </div>
                </div>

                {file && (
                  <div className="alert alert-info">
                    <FileText size={18} className="me-2" />
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                )}

                <div className="alert alert-secondary">
                  <h6>File Requirements:</h6>
                  <ul className="mb-0">
                    <li>Must have a header row with column names</li>
                    <li>Phone number column is required</li>
                    <li>Common columns: Phone, First Name, Last Name, Email, Company</li>
                    <li>Additional columns will be imported as custom fields</li>
                  </ul>
                </div>
              </>
            )}

            {/* Step 2: Map Fields */}
            {step === 2 && preview && preview.headers && preview.headers.length > 0 ? (
              <>
                <div className="alert alert-info">
                  <p className="mb-1">Map your file columns to contact fields</p>
                  <small>Phone Number is required. Other fields are optional.</small>
                </div>

                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                  <table className="table table-sm">
                    <thead className="sticky-top bg-white">
                      <tr>
                        <th>File Column</th>
                        <th>Sample Data</th>
                        <th>Map To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.headers.map((header, index) => (
                        <tr key={`${header}-${index}`}>
                          <td className="fw-medium">{header}</td>
                          <td className="text-muted small">
                            {getSampleData(0, index)}
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={fieldMapping[header] || ''}
                              onChange={(e) => updateFieldMapping(header, e.target.value)}
                            >
                              <option value="">-- Skip this column --</option>
                              {standardFields.map(field => (
                                <option 
                                  key={field.value} 
                                  value={field.value}
                                  disabled={
                                    field.value !== fieldMapping[header] &&
                                    Object.values(fieldMapping).includes(field.value)
                                  }
                                >
                                  {field.label}
                                </option>
                              ))}
                              <option value="custom">Custom Field</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3">
                  <small className="text-muted">
                    Preview shows {Math.min(preview.rows.length, 5)} sample rows. 
                    Total rows in file: {preview.totalRows}
                  </small>
                </div>
              </>
            ) : step === 2 ? (
              // Error state for step 2 when preview is invalid
              <div className="text-center py-4">
                <AlertCircle size={48} className="text-danger mb-3" />
                <h5>Unable to Preview File</h5>
                <p>The file structure could not be read. Please ensure your file:</p>
                <ul className="text-start mx-auto" style={{ maxWidth: '400px' }}>
                  <li>Is a valid CSV or Excel file</li>
                  <li>Has at least one header row</li>
                  <li>Contains data</li>
                  <li>Is not corrupted</li>
                </ul>
                <button 
                  className="btn btn-primary mt-3"
                  onClick={() => {
                    setStep(1);
                    setPreview(null);
                    setFile(null);
                    setError(null);
                  }}
                >
                  Try Another File
                </button>
              </div>
            ) : null}

            {/* Step 3: Import Progress */}
            {step === 3 && importStatus && (
              <div>
                <div className="d-flex align-items-center mb-3">
                  {importing ? (
                    <div className="spinner-border text-primary me-2" />
                  ) : importStatus.status === 'completed' ? (
                    <CheckCircle size={24} className="text-success me-2" />
                  ) : (
                    <AlertCircle size={24} className="text-danger me-2" />
                  )}
                  <span className="fs-5">
                    {importing ? 'Importing...' : 
                     importStatus.status === 'completed' ? 'Import Complete!' : 
                     'Import Failed'}
                  </span>
                </div>

                {importStatus.total_rows > 0 && (
                  <>
                    <div className="progress mb-3" style={{ height: '25px' }}>
                      <div 
                        className="progress-bar progress-bar-striped progress-bar-animated" 
                        style={{ 
                          width: `${(importStatus.processed_rows / importStatus.total_rows * 100) || 0}%` 
                        }}
                      >
                        {Math.round((importStatus.processed_rows / importStatus.total_rows * 100) || 0)}%
                      </div>
                    </div>

                    <div className="row text-center">
                      <div className="col">
                        <h4>{importStatus.total_rows}</h4>
                        <small className="text-muted">Total Rows</small>
                      </div>
                      <div className="col">
                        <h4 className="text-success">{importStatus.successful_rows}</h4>
                        <small className="text-muted">Imported</small>
                      </div>
                      <div className="col">
                        <h4 className="text-danger">{importStatus.failed_rows}</h4>
                        <small className="text-muted">Failed</small>
                      </div>
                    </div>
                  </>
                )}

                {importStatus.status === 'completed' && importStatus.failed_rows > 0 && (
                  <div className="alert alert-warning mt-3">
                    <AlertCircle size={18} className="me-2" />
                    {importStatus.failed_rows} rows failed to import. Common reasons include invalid phone numbers or duplicates.
                  </div>
                )}

                {importStatus.status === 'failed' && (
                  <div className="alert alert-danger mt-3">
                    <AlertCircle size={18} className="me-2" />
                    Import failed. Please check your file and try again.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            {step === 1 && (
              <>
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
                  onClick={handleFileUpload}
                  disabled={!file || !campaignId}
                >
                  Next
                </button>
              </>
            )}

            {step === 2 && preview && preview.headers && preview.headers.length > 0 && (
              <>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                >
                  Back
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={!Object.values(fieldMapping).includes('phone_primary')}
                >
                  Start Import
                </button>
              </>
            )}

            {step === 3 && (
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={onClose}
                disabled={importing}
              >
                {importing ? 'Please wait...' : 'Close'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}