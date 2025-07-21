// client/src/pages/Inbox.js - Enhanced Version
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Phone, Pause, MessageSquare, GitBranch, Disc, X, Plus, 
  UserPlus, Mail, Building, Calendar, Tag, Save, Info
} from 'lucide-react';
import { api } from '../services/api';
import Dialer from '../components/Dialer';
import { useCall } from '../context/CallContext';
import CallNotesPanel from '../components/CallNotesPanel';

export default function Inbox() {
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
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [contactDetails, setContactDetails] = useState(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayedContacts = useMemo(() => {
    if (!contacts) return [];
    
    const allContacts = [...contacts];
    
    // Add active call as a contact if not already in list
    if (activeCall?.number && !allContacts.some(c => c.phone === activeCall.number)) {
      allContacts.unshift({
        id: 'active-call',
        phone: activeCall.number,
        phone_primary: activeCall.number,
        name: activeCall.callerName || activeCall.number,
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

  // Auto-show notes panel for active calls
  useEffect(() => {
    if (activeCall?.status === 'active' && selectedContact) {
      setShowNotesPanel(true);
    }
  }, [activeCall, selectedContact]);

  const loadContacts = async () => {
    try {
      // Get recent contacts from new table that have interactions
      const response = await api.getContactsList({
        limit: 20,
        sort_by: 'last_contacted_at',
        sort_order: 'DESC'
      });
      
      // Transform contacts to match the expected format for inbox
      const transformedContacts = response.contacts
        .filter(c => c.last_interaction) // Only show contacts with interactions
        .map(contact => ({
          id: contact.id,
          name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.phone_primary,
          phone: contact.phone_primary,
          phone_primary: contact.phone_primary,
          email: contact.email,
          company: contact.company,
          queue: contact.campaign_name,
          queue_name: contact.campaign_name,
          status: contact.status,
          call_time: contact.last_interaction ? new Date(contact.last_interaction).toLocaleTimeString() : null,
          interaction_count: contact.interaction_count,
          tags: contact.tags || []
        }));
      
      setContacts(transformedContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      setContacts([]);
    }
  };

  const loadContactDetails = async (contactId) => {
    if (contactId === 'active-call') return;
    
    try {
      setLoadingDetails(true);
      const details = await api.getContactDetails(contactId);
      setContactDetails(details);
      
      // Transform interactions to match expected format
      const history = details.interactions?.map(interaction => ({
        id: interaction.id,
        time: new Date(interaction.created_at).toLocaleTimeString(),
        action: interaction.interaction_type,
        agent: interaction.agent_name,
        queue: details.campaign_name,
        duration: interaction.duration ? `${Math.floor(interaction.duration / 60)}:${(interaction.duration % 60).toString().padStart(2, '0')}` : 'N/A',
        date: new Date(interaction.created_at).toLocaleDateString(),
        details: interaction.details
      })) || [];
      
      setContactHistory(history);
    } catch (error) {
      console.error('Error loading contact details:', error);
      setContactHistory([]);
      setContactDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    if (contact.id !== 'active-call') {
      loadContactDetails(contact.id);
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

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedContact || selectedContact.id === 'active-call') return;

    try {
      setAddingNote(true);
      await api.addContactInteraction(selectedContact.id, {
        interaction_type: 'note',
        direction: 'internal',
        details: { note: newNote }
      });
      
      setNewNote('');
      // Reload contact details to show new note
      loadContactDetails(selectedContact.id);
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note');
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div className="d-flex w-100 h-100">
      {/* Sidebar */}
      <div className="border-end bg-light" style={{ width: '350px', overflowY: 'auto' }}>
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

        {/* Contact List */}
        {displayedContacts.length === 0 ? (
          <div className="p-3 text-center text-muted">
            <p>No recent contacts</p>
            <small>Contacts will appear here after calls</small>
          </div>
        ) : (
          displayedContacts.map(contact => (
            <div 
              key={contact.id}
              className={`chat-item p-3 border-bottom cursor-pointer ${
                selectedContact?.id === contact.id ? 'bg-primary bg-opacity-10' : ''
              } ${contact.isActive ? 'bg-light' : ''}`}
              onClick={() => handleSelectContact(contact)}
            >
              <div className="d-flex flex-column">
                <div className="d-flex align-items-center">
                  <div className="bg-primary rounded-circle p-2 text-white me-2">
                    {contact.name ? contact.name.charAt(0).toUpperCase() : '#'}
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-0">{contact.name || contact.phone}</h6>
                    <div className="d-flex align-items-center gap-3 small text-muted">
                      <span>
                        {contact.isActive && activeCall ? (
                          activeCall.status === 'active' 
                            ? `In Call (${formatTime(callDuration)})` 
                            : activeCall.isInbound 
                              ? 'Incoming Call' 
                              : activeCall.status
                        ) : (
                          contact.queue_name || 'No campaign'
                        )}
                      </span>
                      {contact.company && (
                        <span>
                          <Building size={12} className="me-1" />
                          {contact.company}
                        </span>
                      )}
                    </div>
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="mt-1">
                        {contact.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="badge bg-secondary me-1" style={{ fontSize: '10px' }}>
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="text-muted" style={{ fontSize: '10px' }}>
                            +{contact.tags.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {contact.interaction_count > 0 && !contact.isActive && (
                    <span className="badge bg-primary">{contact.interaction_count}</span>
                  )}
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
          ))
        )}
      </div>

      {/* Main Content */}
      {selectedContact ? (
        <div className="flex-grow-1 d-flex flex-column" style={{ height: '100%' }}>
          {/* Header */}
          <div className="p-3 border-bottom bg-white">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0">{selectedContact.name || selectedContact.phone}</h5>
                <div className="d-flex align-items-center gap-3 text-muted small">
                  {selectedContact.phone && (
                    <span>
                      <Phone size={14} className="me-1" />
                      {selectedContact.phone}
                    </span>
                  )}
                  {selectedContact.email && (
                    <span>
                      <Mail size={14} className="me-1" />
                      {selectedContact.email}
                    </span>
                  )}
                  {activeCall?.status === 'active' && selectedContact.isActive && (
                    <span className="text-success fw-bold">
                      In Call ({formatTime(callDuration)})
                    </span>
                  )}
                </div>
              </div>
              <div className="d-flex gap-2">
                {selectedContact.isActive && activeCall?.status === 'active' && (
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
                {!selectedContact.isActive && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleDial(selectedContact.phone)}
                  >
                    <Phone size={18} /> Call
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info and History Container */}
          <div className="flex-grow-1 d-flex" style={{ overflow: 'hidden' }}>
            {/* Left Panel - Contact Details */}
            <div className="border-end" style={{ width: '350px', overflowY: 'auto' }}>
              {loadingDetails ? (
                <div className="p-4 text-center">
                  <div className="spinner-border text-primary" />
                  <p className="mt-2">Loading details...</p>
                </div>
              ) : contactDetails ? (
                <>
                  {/* Contact Information */}
                  <div className="p-3 border-bottom">
                    <h6 className="text-muted mb-3">Contact Information</h6>
                    <div className="small">
                      <div className="mb-2">
                        <strong>Status:</strong>{' '}
                        <span className={`badge bg-${
                          contactDetails.status === 'new' ? 'primary' :
                          contactDetails.status === 'interested' ? 'success' :
                          contactDetails.status === 'not_interested' ? 'danger' :
                          'secondary'
                        }`}>
                          {contactDetails.status}
                        </span>
                      </div>
                      {contactDetails.company && (
                        <div className="mb-2">
                          <strong>Company:</strong> {contactDetails.company}
                        </div>
                      )}
                      <div className="mb-2">
                        <strong>Campaign:</strong> {contactDetails.campaign_name || 'None'}
                      </div>
                      <div className="mb-2">
                        <strong>Created:</strong> {new Date(contactDetails.created_at).toLocaleDateString()}
                      </div>
                      <div className="mb-2">
                        <strong>Last Contact:</strong>{' '}
                        {contactDetails.last_contacted_at 
                          ? new Date(contactDetails.last_contacted_at).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                      <div className="mb-2">
                        <strong>Contact Attempts:</strong> {contactDetails.contact_attempts || 0}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {contactDetails.tags && contactDetails.tags.length > 0 && (
                    <div className="p-3 border-bottom">
                      <h6 className="text-muted mb-2">
                        <Tag size={16} className="me-1" />
                        Tags
                      </h6>
                      <div className="d-flex flex-wrap gap-2">
                        {contactDetails.tags.map((tag, index) => (
                          <span key={index} className="badge bg-secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Fields */}
                  {contactDetails.custom_data && Object.keys(contactDetails.custom_data).length > 0 && (
                    <div className="p-3 border-bottom">
                      <h6 className="text-muted mb-2">Custom Fields</h6>
                      <div className="small">
                        {Object.entries(contactDetails.custom_data).map(([key, value]) => (
                          <div key={key} className="mb-1">
                            <strong>{key}:</strong> {value || '-'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Note Add */}
                  <div className="p-3">
                    <h6 className="text-muted mb-2">
                      <MessageSquare size={16} className="me-1" />
                      Quick Note
                    </h6>
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Add a quick note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleAddNote();
                        }}
                        disabled={addingNote}
                      />
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={handleAddNote}
                        disabled={addingNote || !newNote.trim()}
                      >
                        {addingNote ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          <Save size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-muted">
                  <Info size={48} className="mb-3 opacity-25" />
                  <p>Select a contact to view details</p>
                </div>
              )}
            </div>

            {/* Right Panel - History */}
            <div className="flex-grow-1 p-3" style={{ overflowY: 'auto' }}>
              <h6 className="mb-3">Interaction History</h6>
              {contactHistory.length === 0 ? (
                <p className="text-muted text-center py-4">No history available</p>
              ) : (
                <div className="timeline">
                  {contactHistory.map((entry, index) => (
                    <div key={entry.id || index} className="mb-4 pb-3 border-bottom">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="d-flex align-items-start">
                          <div className={`rounded-circle p-2 me-3 ${
                            entry.action === 'call' ? 'bg-success' : 
                            entry.action === 'note' ? 'bg-info' : 
                            'bg-secondary'
                          } text-white`}>
                            {entry.action === 'call' ? <Phone size={16} /> : <MessageSquare size={16} />}
                          </div>
                          <div>
                            <div className="fw-bold text-capitalize">{entry.action}</div>
                            <div className="text-muted small">
                              {entry.agent} • {entry.date} {entry.time}
                              {entry.duration && entry.duration !== 'N/A' && ` • Duration: ${entry.duration}`}
                            </div>
                            {entry.details?.note && (
                              <div className="mt-2 p-2 bg-light rounded">
                                <small>{entry.details.note}</small>
                              </div>
                            )}
                            {entry.details?.tags && entry.details.tags.length > 0 && (
                              <div className="mt-2">
                                {entry.details.tags.map((tag, idx) => (
                                  <span key={idx} className="badge bg-secondary me-1">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {entry.details?.disposition && (
                              <div className="mt-1">
                                <span className="badge bg-primary">
                                  {entry.details.disposition}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
          <div className="text-center">
            <Phone size={48} className="mb-3 opacity-25" />
            <p>Select a contact to view details</p>
          </div>
        </div>
      )}

      {/* Call Notes Panel - Shows during active calls */}
      {showNotesPanel && selectedContact && activeCall?.status === 'active' && (
        <CallNotesPanel 
          contactId={selectedContact.id === 'active-call' ? null : selectedContact.id}
          onClose={() => setShowNotesPanel(false)}
        />
      )}
    </div>
  );
}