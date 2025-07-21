// src/components/IncomingCallNotification.js
import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, User, Building, Tag, AlertCircle } from 'lucide-react';
import { useCall } from '../context/CallContext';
import '../styles/IncomingCallNotification.css';

export default function IncomingCallNotification() {
  const { 
    incomingCallAlert, 
    activeCall,
    handleAnswerCall, 
    handleRejectCall,
    createContactFromCall 
  } = useCall();
  
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [newContactData, setNewContactData] = useState({
    first_name: '',
    last_name: '',
    company: '',
    email: '',
    campaign_id: ''
  });

  // Reset when call ends
  useEffect(() => {
    if (!activeCall || !['ringing', 'active'].includes(activeCall.status)) {
      setShowCreateContact(false);
      setNewContactData({
        first_name: '',
        last_name: '',
        company: '',
        email: '',
        campaign_id: ''
      });
    }
  }, [activeCall]);

  if (!incomingCallAlert) return null;

  const isUnknownCaller = !incomingCallAlert.contactId;

  const handleCreateContact = async () => {
    try {
      await createContactFromCall(newContactData);
      setShowCreateContact(false);
      alert('Contact created successfully!');
    } catch (error) {
      alert('Error creating contact: ' + error.message);
    }
  };

  return (
    <div className="incoming-call-notification">
      <div className="incoming-call-content">
        {/* Call Info Section */}
        <div className="call-info-section">
          <div className="caller-avatar">
            {isUnknownCaller ? (
              <AlertCircle size={32} className="text-warning" />
            ) : (
              <User size={32} />
            )}
          </div>
          
          <div className="caller-details">
            <h4 className="caller-name">
              {incomingCallAlert.name || 'Unknown Caller'}
            </h4>
            <div className="caller-number">
              <Phone size={16} />
              {incomingCallAlert.number}
            </div>
            
            {incomingCallAlert.company && (
              <div className="caller-company">
                <Building size={16} />
                {incomingCallAlert.company}
              </div>
            )}
            
            {incomingCallAlert.campaign && (
              <div className="caller-campaign">
                <Tag size={16} />
                {incomingCallAlert.campaign}
              </div>
            )}

            {isUnknownCaller && (
              <div className="unknown-caller-alert">
                <small className="text-muted">Caller not in contacts</small>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="call-actions">
          <button 
            className="btn btn-success btn-lg"
            onClick={handleAnswerCall}
            title="Answer Call"
          >
            <Phone size={24} />
            <span>Answer</span>
          </button>
          
          <button 
            className="btn btn-danger btn-lg"
            onClick={handleRejectCall}
            title="Reject Call"
          >
            <PhoneOff size={24} />
            <span>Reject</span>
          </button>
        </div>

        {/* Create Contact Option for Unknown Callers */}
        {isUnknownCaller && activeCall?.status === 'active' && (
          <div className="unknown-caller-actions">
            {!showCreateContact ? (
              <button 
                className="btn btn-link btn-sm"
                onClick={() => setShowCreateContact(true)}
              >
                Create Contact
              </button>
            ) : (
              <div className="create-contact-form">
                <h6>Quick Add Contact</h6>
                <div className="row g-2">
                  <div className="col-6">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="First Name"
                      value={newContactData.first_name}
                      onChange={(e) => setNewContactData({
                        ...newContactData,
                        first_name: e.target.value
                      })}
                    />
                  </div>
                  <div className="col-6">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Last Name"
                      value={newContactData.last_name}
                      onChange={(e) => setNewContactData({
                        ...newContactData,
                        last_name: e.target.value
                      })}
                    />
                  </div>
                  <div className="col-12">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Company"
                      value={newContactData.company}
                      onChange={(e) => setNewContactData({
                        ...newContactData,
                        company: e.target.value
                      })}
                    />
                  </div>
                  <div className="col-12">
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={handleCreateContact}
                      >
                        Save
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowCreateContact(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}