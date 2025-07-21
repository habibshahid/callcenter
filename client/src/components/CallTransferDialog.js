// src/components/CallTransferDialog.js
import React, { useState, useEffect } from 'react';
import { Phone, User, GitBranch, Search, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { useCall } from '../context/CallContext';

export default function CallTransferDialog({ onClose }) {
  const { activeCall } = useCall();
  const [transferType, setTransferType] = useState('blind'); // 'blind' or 'attended'
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadAvailableAgents();
  }, []);

  const loadAvailableAgents = async () => {
    try {
      setLoading(true);
      const agentList = await api.getActiveAgents();
      // Filter out current user
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const availableAgents = agentList.filter(agent => 
        agent.id !== currentUser.id && agent.current_status === 'Ready'
      );
      setAgents(availableAgents);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (transferType === 'agent' && !selectedAgent) {
      alert('Please select an agent');
      return;
    }

    if (transferType === 'number' && !phoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    setTransferring(true);

    try {
      // In a real implementation, this would use SIP.js transfer functionality
      // For now, we'll simulate the transfer
      
      if (transferType === 'blind') {
        // Blind transfer - immediately transfer without consultation
        console.log('Performing blind transfer to:', selectedAgent || phoneNumber);
        
        // Log the transfer
        if (activeCall.contactId) {
          await api.addContactInteraction(activeCall.contactId, {
            interaction_type: 'note',
            direction: 'internal',
            details: {
              note: `Call transferred to ${selectedAgent ? `agent ${selectedAgent}` : phoneNumber}`,
              transfer_type: 'blind'
            }
          });
        }
        
        alert('Call transferred successfully');
        onClose();
      } else {
        // Attended transfer - place current call on hold and dial the transfer target
        console.log('Initiating attended transfer');
        alert('Attended transfer initiated. Current call placed on hold.');
        // In real implementation, would place current call on hold and dial new number
      }
    } catch (error) {
      console.error('Error transferring call:', error);
      alert('Error transferring call');
    } finally {
      setTransferring(false);
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!activeCall || activeCall.status !== 'active') {
    return null;
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <GitBranch size={20} className="me-2" />
              Transfer Call
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={transferring}
            />
          </div>
          
          <div className="modal-body">
            {/* Current Call Info */}
            <div className="alert alert-info mb-4">
              <div className="d-flex align-items-center">
                <Phone size={18} className="me-2" />
                <div>
                  <strong>Current Call:</strong> {activeCall.number}
                  {activeCall.name && ` (${activeCall.name})`}
                </div>
              </div>
            </div>

            {/* Transfer Type Selection */}
            <div className="mb-4">
              <label className="form-label">Transfer Type</label>
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn ${transferType === 'blind' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setTransferType('blind')}
                >
                  Blind Transfer
                  <small className="d-block">Transfer immediately</small>
                </button>
                <button
                  type="button"
                  className={`btn ${transferType === 'attended' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setTransferType('attended')}
                >
                  Attended Transfer
                  <small className="d-block">Consult before transfer</small>
                </button>
              </div>
            </div>

            {/* Transfer Target */}
            <div className="mb-4">
              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button 
                    className={`nav-link ${selectedAgent ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedAgent('agent');
                      setPhoneNumber('');
                    }}
                  >
                    Transfer to Agent
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${phoneNumber ? 'active' : ''}`}
                    onClick={() => {
                      setPhoneNumber('number');
                      setSelectedAgent('');
                    }}
                  >
                    Transfer to Number
                  </button>
                </li>
              </ul>

              {/* Agent Selection */}
              {(selectedAgent || (!selectedAgent && !phoneNumber)) && (
                <div>
                  <div className="input-group mb-3">
                    <span className="input-group-text">
                      <Search size={18} />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search agents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {loading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border" />
                      <p className="mt-2">Loading agents...</p>
                    </div>
                  ) : filteredAgents.length === 0 ? (
                    <div className="alert alert-warning">
                      No available agents found
                    </div>
                  ) : (
                    <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {filteredAgents.map(agent => (
                        <button
                          key={agent.id}
                          className={`list-group-item list-group-item-action ${
                            selectedAgent === agent.id ? 'active' : ''
                          }`}
                          onClick={() => setSelectedAgent(agent.id)}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                              <div className="bg-light rounded-circle p-2 me-3">
                                <User size={20} />
                              </div>
                              <div>
                                <h6 className="mb-0">{agent.username}</h6>
                                <small className="text-muted">
                                  {agent.first_name} {agent.last_name}
                                  {agent.extension && ` - Ext: ${agent.extension}`}
                                </small>
                              </div>
                            </div>
                            <div className="text-end">
                              <span className="badge bg-success">
                                <CheckCircle size={14} className="me-1" />
                                Available
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Phone Number Input */}
              {phoneNumber && (
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="Enter phone number..."
                    value={phoneNumber === 'number' ? '' : phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    autoFocus
                  />
                  <small className="form-text text-muted">
                    Enter the complete phone number including area code
                  </small>
                </div>
              )}
            </div>

            {/* Transfer Notes */}
            <div className="mb-3">
              <label className="form-label">Transfer Notes (Optional)</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Add any notes about this transfer..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
              disabled={transferring}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleTransfer}
              disabled={
                transferring || 
                (!selectedAgent && !phoneNumber) ||
                (phoneNumber === 'number')
              }
            >
              {transferring ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Transferring...
                </>
              ) : (
                <>
                  <GitBranch size={18} className="me-2" />
                  {transferType === 'attended' ? 'Initiate Transfer' : 'Transfer Now'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}