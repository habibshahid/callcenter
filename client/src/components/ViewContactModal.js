// client/src/components/ViewContactModal.js
import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, Building, User, Calendar, Clock, Activity, Tag, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import { useCall } from '../context/CallContext';

export default function ViewContactModal({ contactId, onClose, onEdit }) {
  const { handleDial } = useCall();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    loadContactDetails();
  }, [contactId]);

  const loadContactDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getContactDetails(contactId);
      setContact(data);
    } catch (error) {
      console.error('Error loading contact details:', error);
      setError('Error loading contact details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await api.addContactInteraction(contactId, {
        interaction_type: 'note',
        direction: 'internal',
        details: { note: newNote }
      });
      
      setNewNote('');
      setAddingNote(false);
      loadContactDetails(); // Reload to get the new note
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'new': 'bg-primary',
      'contacted': 'bg-info',
      'interested': 'bg-success',
      'not_interested': 'bg-warning',
      'do_not_call': 'bg-danger',
      'invalid': 'bg-secondary'
    };
    return statusClasses[status] || 'bg-secondary';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-body text-center py-5">
              <div className="spinner-border text-primary" />
              <p className="mt-2">Loading contact details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-body text-center py-5">
              <p className="text-danger">{error || 'Contact not found'}</p>
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <User size={20} className="me-2" />
              Contact Details
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            />
          </div>
          
          <div className="modal-body">
            {/* Contact Header */}
            <div className="bg-light p-4 rounded mb-4">
              <div className="row align-items-center">
                <div className="col-md-8">
                  <h4 className="mb-1">
                    {contact.first_name || contact.last_name ? 
                      `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
                      contact.phone_primary
                    }
                  </h4>
                  <div className="text-muted">
                    <Phone size={16} className="me-1" />
                    {contact.phone_primary}
                    {contact.phone_secondary && (
                      <span className="ms-3">
                        <Phone size={16} className="me-1" />
                        {contact.phone_secondary}
                      </span>
                    )}
                  </div>
                  {contact.email && (
                    <div className="text-muted">
                      <Mail size={16} className="me-1" />
                      {contact.email}
                    </div>
                  )}
                  {contact.company && (
                    <div className="text-muted">
                      <Building size={16} className="me-1" />
                      {contact.company}
                    </div>
                  )}
                </div>
                <div className="col-md-4 text-end">
                  <span className={`badge ${getStatusBadgeClass(contact.status)} mb-2`}>
                    {contact.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <div className="btn-group d-block">
                    <button 
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => handleDial(contact.phone_primary)}
                    >
                      <Phone size={16} className="me-1" />
                      Call
                    </button>
                    <button 
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        onEdit(contact);
                        onClose();
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'info' ? 'active' : ''}`}
                  onClick={() => setActiveTab('info')}
                >
                  Information
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  History ({contact.interactions?.length || 0})
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'custom' ? 'active' : ''}`}
                  onClick={() => setActiveTab('custom')}
                >
                  Custom Fields
                </button>
              </li>
            </ul>

            {/* Tab Content */}
            {activeTab === 'info' && (
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-muted mb-3">Contact Information</h6>
                  <table className="table table-sm">
                    <tbody>
                      <tr>
                        <td className="text-muted">Campaign</td>
                        <td>{contact.campaign_name}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Assigned To</td>
                        <td>{contact.assigned_to_name || 'Unassigned'}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Source</td>
                        <td>{contact.source || 'Manual'}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Contact Attempts</td>
                        <td>{contact.contact_attempts || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="col-md-6">
                  <h6 className="text-muted mb-3">Timestamps</h6>
                  <table className="table table-sm">
                    <tbody>
                      <tr>
                        <td className="text-muted">Created</td>
                        <td>{formatDateTime(contact.created_at)}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Last Updated</td>
                        <td>{formatDateTime(contact.updated_at)}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Last Contacted</td>
                        <td>{formatDateTime(contact.last_contacted_at)}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Created By</td>
                        <td>{contact.created_by_name || 'System'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tags */}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="col-12 mt-3">
                    <h6 className="text-muted mb-2">
                      <Tag size={16} className="me-1" />
                      Tags
                    </h6>
                    <div>
                      {contact.tags.map((tag, index) => (
                        <span key={index} className="badge bg-secondary me-2">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">Interaction History</h6>
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setAddingNote(true)}
                  >
                    <MessageSquare size={16} className="me-1" />
                    Add Note
                  </button>
                </div>

                {addingNote && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <textarea 
                        className="form-control mb-2"
                        rows="3"
                        placeholder="Enter note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="d-flex gap-2">
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={handleAddNote}
                        >
                          Save Note
                        </button>
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setAddingNote(false);
                            setNewNote('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="timeline">
                  {contact.interactions && contact.interactions.length > 0 ? (
                    contact.interactions.map((interaction, index) => (
                      <div key={interaction.id || index} className="card mb-3">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="d-flex align-items-center mb-1">
                                <Activity size={16} className="me-2 text-primary" />
                                <strong className="text-capitalize">
                                  {interaction.interaction_type}
                                </strong>
                                {interaction.direction && (
                                  <span className="badge bg-secondary ms-2">
                                    {interaction.direction}
                                  </span>
                                )}
                              </div>
                              {interaction.details && (
                                <div className="mt-2">
                                  {interaction.details.note ? (
                                    <p className="mb-0">{interaction.details.note}</p>
                                  ) : (
                                    <pre className="mb-0 small">
                                      {JSON.stringify(interaction.details, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              )}
                              {interaction.duration && (
                                <div className="text-muted small mt-1">
                                  Duration: {Math.floor(interaction.duration / 60)}m {interaction.duration % 60}s
                                </div>
                              )}
                            </div>
                            <div className="text-end">
                              <div className="text-muted small">
                                {formatDateTime(interaction.created_at)}
                              </div>
                              {interaction.agent_name && (
                                <div className="text-muted small">
                                  by {interaction.agent_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted text-center py-4">No interactions yet</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'custom' && (
              <div>
                <h6 className="text-muted mb-3">Custom Fields</h6>
                {contact.custom_data && Object.keys(contact.custom_data).length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(contact.custom_data).map(([key, value]) => (
                        <tr key={key}>
                          <td className="text-capitalize">{key.replace(/_/g, ' ')}</td>
                          <td>{value || <span className="text-muted">Empty</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted text-center py-4">No custom fields</p>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}