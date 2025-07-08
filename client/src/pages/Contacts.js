// src/pages/Contacts.js
import React, { useState, useEffect, useMemo } from 'react';
import { Phone, Pause, MessageSquare, GitBranch, Disc, X, Plus, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import Dialer from '../components/Dialer';
import { useCall } from '../context/CallContext';

export default function Contacts() {
  const { 
    activeCall, 
    callDuration,
    handleMuteCall,
    handleHoldCall,
    handleEndCall,
    handleAnswerCall,
    handleRejectCall,
    handleDial: onDial,
    selectedContact,
    setSelectedContact
  } = useCall();

  const [contacts, setContacts] = useState([]);
  const [contactHistory, setContactHistory] = useState([]);
  const [showDialer, setShowDialer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayedContacts = useMemo(() => {
    if (!contacts) return [];
    
    const allContacts = [...contacts];
    
    if (activeCall?.number && !allContacts.some(c => c.phone === activeCall.number)) {
      allContacts.unshift({
        id: 'active-call',
        phone: activeCall.number,
        isActive: true,
        queue_name: activeCall.isInbound ? 'Incoming Call' : 'Outbound Call'
      });
    }

    return allContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.phone === contact.phone)
    );
  }, [contacts, activeCall]);

  useEffect(() => {
    loadContacts();
  }, []);

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
      await onDial(number);
      setShowDialer(false);
    } catch (error) {
      console.error('Error making call:', error);
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* Contact List (including active call) */}
        {displayedContacts.map(contact => (
          <div 
            key={contact.id}
            className={`chat-item p-3 border-bottom cursor-pointer ${contact.isActive ? 'bg-light' : ''}`}
            onClick={() => setSelectedContact(contact)}
          >
            <div className="d-flex flex-column">
              <div className="d-flex align-items-center">
                <div className="bg-primary rounded-circle p-2 text-white me-2">
                  {contact.name ? contact.name.charAt(0) : '#'}
                </div>
                <div>
                  <h6 className="mb-0">{contact.name || contact.phone}</h6>
                  <small className="text-muted">
                    {contact.isActive && activeCall ? (
                      activeCall.status === 'active' 
                        ? `In Call (${formatTime(callDuration)})` 
                        : activeCall.isInbound 
                          ? 'Incoming Call' 
                          : activeCall.status
                    ) : contact.queue_name}
                  </small>
                </div>
              </div>

              {/* Show call controls only for active call */}
              {contact.isActive && activeCall && (
                <div className="d-flex gap-2 mt-2">
                  {/* Answer/Reject buttons for incoming calls */}
                  {activeCall.isInbound && activeCall.status === 'ringing' && (
                    <>
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnswerCall();
                        }}
                      >
                        <Phone size={16} /> Answer
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRejectCall();
                        }}
                      >
                        <X size={16} /> Reject
                      </button>
                    </>
                  )}

                  {/* Controls for active calls */}
                  {activeCall.status === 'active' && (
                    <>
                      <button 
                        className={`btn btn-sm ${activeCall.isHeld ? 'btn-warning' : 'btn-outline-warning'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHoldCall();
                        }}
                      >
                        <Pause size={16} />
                      </button>
                      <button 
                        className={`btn btn-sm ${activeCall.isMuted ? 'btn-secondary' : 'btn-outline-secondary'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMuteCall();
                        }}
                      >
                        <Disc size={16} />
                      </button>
                    </>
                  )}
                  
                  {/* End call button */}
                  {(activeCall.status === 'active' || (!activeCall.isInbound && ['trying', 'connecting', 'ringing'].includes(activeCall.status))) && (
                    <button 
                      className="btn btn-sm btn-danger ms-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEndCall();
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
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
                <small className="text-muted">
                  {activeCall?.status === 'active' 
                    ? `In Call (${formatTime(callDuration)})` 
                    : activeCall?.status === 'ringing' 
                      ? (activeCall.isInbound ? 'Incoming Call' : 'Ringing...') 
                      : null}
                </small>
              </div>
              <div className="d-flex gap-2">
                {activeCall?.status === 'active' && (
                  <>
                    <button 
                      className={`btn btn-light ${activeCall.isHeld ? 'active' : ''}`}
                      onClick={handleHoldCall}
                    >
                      <Pause size={18} /> Hold
                    </button>
                    <button 
                      className={`btn btn-light ${activeCall.isMuted ? 'active' : ''}`}
                      onClick={handleMuteCall}
                    >
                      <Disc size={18} /> Mute
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={handleEndCall}
                    >
                      <X size={18} /> End
                    </button>
                  </>
                )}
                {selectedContact.isTemporary && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => console.log('Add contact clicked')}
                  >
                    <UserPlus size={18} /> Add Contact
                  </button>
                )}
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
                {selectedContact.email && (
                  <div className="mb-3">
                    <label className="text-muted small">Email</label>
                    <div>{selectedContact.email}</div>
                  </div>
                )}
              </div>
              <div className="col-md-4">
                {selectedContact.dnis && (
                  <div className="mb-3">
                    <label className="text-muted small">DNIS</label>
                    <div>{selectedContact.dnis}</div>
                  </div>
                )}
                {selectedContact.queue_name && (
                  <div className="mb-3">
                    <label className="text-muted small">Queue</label>
                    <div>{selectedContact.queue_name}</div>
                  </div>
                )}
              </div>
              <div className="col-md-4">
                {selectedContact.address && (
                  <div className="mb-3">
                    <label className="text-muted small">Address</label>
                    <div>{selectedContact.address}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact History */}
          <div className="p-3">
            <h6 className="mb-3">Contact History</h6>
            {contactHistory.map((entry, index) => (
              <div key={index} className="mb-4">
                <div className="text-muted mb-2">{entry.created_at}</div>
                <div className="d-flex align-items-center mb-2">
                  <div className={`bg-${entry.status === 'active' ? 'success' : 'secondary'} rounded-circle p-2 text-white me-3`}>
                    <Phone size={16} />
                  </div>
                  <div className="flex-grow-1">
                    <div>{entry.status}</div>
                    <small className="text-muted">
                      {entry.agent_name} • {entry.queue_name}
                    </small>
                  </div>
                  <div className="text-end">
                    <div>{entry.duration}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}