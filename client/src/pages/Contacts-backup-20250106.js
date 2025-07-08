// src/pages/Contacts.js
import React, { useState, useEffect } from 'react';
import { Phone, Pause, MessageSquare, GitBranch, Disc, X, Plus } from 'lucide-react';
import { api } from '../services/api';
import SipService from '../services/SipService';
import Dialer from '../components/Dialer';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactHistory, setContactHistory] = useState([]);
  const [showDialer, setShowDialer] = useState(false);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    loadContacts();

    // Set up call status listener
    const handleCallStatus = (callStatus) => {
      setActiveCall(callStatus);
      // If call has ended, load contact history for the selected contact
      if (callStatus.status === 'terminated' && selectedContact) {
        loadContactHistory(selectedContact.id);
      }
    };

    SipService.addCallListener(handleCallStatus);

    return () => {
      SipService.removeCallListener(handleCallStatus);
    };
  }, [selectedContact]);

  const loadContacts = async () => {
    try {
      const data = await api.getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadContactHistory = async (contactId) => {
    try {
      const history = await api.getContactHistory(contactId);
      setContactHistory(history);
    } catch (error) {
      console.error('Error loading contact history:', error);
    }
  };

  const handleDial = async (number) => {
    try {
      await SipService.makeCall(number);
      setShowDialer(false);
    } catch (error) {
      console.error('Error making call:', error);
    }
  };

  const handleEndCall = async () => {
    try {
      await SipService.endCall();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const handleHoldCall = async () => {
    try {
      await SipService.holdCall(!activeCall.isHeld);
    } catch (error) {
      console.error('Error toggling hold:', error);
    }
  };

  const handleMuteCall = async () => {
    try {
      await SipService.muteCall(!activeCall.isMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  return (
    <div className="d-flex w-100">
      {/* Sidebar */}
      <div className="border-end bg-light" style={{ width: '300px' }}>
        <div className="p-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search contacts..." 
            />
            <button 
              className="btn btn-primary"
              onClick={() => setShowDialer(true)}
              title="Make a call"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        
        {/* Dialer Dropdown */}
        {showDialer && (
          <div className="position-absolute mt-1 start-50 translate-middle-x z-index-1000">
            <Dialer 
              onClose={() => setShowDialer(false)} 
              onDial={handleDial}
            />
          </div>
        )}

        {/* Active Call Display */}
        {activeCall && (
          <div className="chat-item p-3 border-bottom bg-light">
            <div className="d-flex flex-column">
              <div className="d-flex align-items-center mb-2">
                <div className="bg-primary rounded-circle p-2 text-white me-2">
                  <Phone size={18} />
                </div>
                <div>
                  <h6 className="mb-0">{activeCall.number}</h6>
                  <small className="text-muted">{activeCall.status}</small>
                </div>
              </div>
              
              <div className="d-flex gap-2">
                {activeCall.status === 'active' ? (
                  <>
                    <button 
                      className={`btn btn-sm ${activeCall.isHeld ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={handleHoldCall}
                    >
                      <Pause size={16} />
                    </button>
                    <button 
                      className={`btn btn-sm ${activeCall.isMuted ? 'btn-secondary' : 'btn-outline-secondary'}`}
                      onClick={handleMuteCall}
                    >
                      <Disc size={16} />
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {/* Handle transfer */}}
                    >
                      <GitBranch size={16} />
                    </button>
                  </>
                ) : (
                  activeCall.status === 'failed' && (
                    <button 
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => handleDial(activeCall.number)}
                    >
                      Redial
                    </button>
                  )
                )}
                {['active', 'ringing', 'connecting'].includes(activeCall.status) && (
                  <button 
                    className="btn btn-sm btn-danger ms-auto"
                    onClick={handleEndCall}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contact List */}
        {contacts.map(contact => (
          <div 
            key={contact.id}
            className="chat-item p-3 border-bottom cursor-pointer"
            onClick={() => setSelectedContact(contact)}
          >
            <div className="d-flex align-items-center">
              <div className="bg-primary rounded-circle p-2 text-white me-2">
                {contact.name.charAt(0)}
              </div>
              <div>
                <h6 className="mb-0">{contact.name}</h6>
                <small className="text-muted">{contact.queue}</small>
              </div>
              <span className="ms-auto badge bg-success">Accept</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      {selectedContact && (
        <div className="flex-grow-1">
          {/* Header */}
          <div className="p-3 border-bottom bg-white">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0">{selectedContact.phone}</h5>
                <small className="text-muted">00:01</small>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-light"><Pause size={18} /> Hold</button>
                <button className="btn btn-light"><MessageSquare size={18} /> Consult</button>
                <button className="btn btn-light"><GitBranch size={18} /> Transfer</button>
                <button className="btn btn-light"><Disc size={18} /> Pause Recording</button>
                <button className="btn btn-danger"><X size={18} /> End</button>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="p-3 border-bottom">
            <div className="row">
              <div className="col-md-4">
                <div className="mb-3">
                  <label className="text-muted small">Phone Number</label>
                  <div>{selectedContact.phone}</div>
                </div>
                <div className="mb-3">
                  <label className="text-muted small">Queue</label>
                  <div>{selectedContact.queue}</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="mb-3">
                  <label className="text-muted small">DNIS</label>
                  <div>{selectedContact.dnis || 'N/A'}</div>
                </div>
                <div className="mb-3">
                  <label className="text-muted small">Queue Name</label>
                  <div>{selectedContact.queueName}</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="mb-3">
                  <label className="text-muted small">Address</label>
                  <div>{selectedContact.address || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact History */}
          <div className="p-3">
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button className="nav-link active">Contact History</button>
              </li>
              <li className="nav-item">
                <button className="nav-link">Customer Experience Journey</button>
              </li>
            </ul>
            
            <div>
              {contactHistory.map((entry, index) => (
                <div key={index} className="mb-4">
                  <div className="text-muted mb-2">{entry.date}</div>
                  <div className="d-flex align-items-center mb-2">
                    <div className="bg-success rounded-circle p-2 text-white me-3">
                      <Phone size={16} />
                    </div>
                    <div className="flex-grow-1">
                      <div>{entry.action}</div>
                      <small className="text-muted">{entry.agent} • {entry.queue}</small>
                    </div>
                    <div className="text-end">
                      <div>{entry.time}</div>
                      <small className="text-muted">{entry.duration}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}