// client/src/pages/Inbox.js - Complete Implementation with All Features
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Phone, Pause, MessageSquare, GitBranch, Disc, X, Plus, 
  UserPlus, Mail, Building, Calendar, Tag, Save, Info, FileText, CheckCircle
} from 'lucide-react';
import { api } from '../services/api';
import Dialer from '../components/Dialer';
import { useCall } from '../context/CallContext';
import CallNotesPanel from '../components/CallNotesPanel';
import TasksWidget from '../components/TasksWidget';
import { debounce } from 'lodash';

export default function Inbox() {
  // Create debounced search handler
  const debouncedSearchChange = useMemo(
    () => debounce((value) => {
      setSearchQuery(value);
    }, 300),
    []
  );

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

  const tagsAndDispositionsLoaded = useRef(false);
  const globalSettingsLoaded = useRef(false);
  const [contacts, setContacts] = useState([]);
  const [contactHistory, setContactHistory] = useState([]);
  const [showDialer, setShowDialer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [contactDetails, setContactDetails] = useState(null);
  
  // Interaction panel state
  const [interactionNote, setInteractionNote] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedDisposition, setSelectedDisposition] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [dispositionMandatory, setDispositionMandatory] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  // Cache for loaded contact details
  const [contactDetailsCache, setContactDetailsCache] = useState({});

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayedContacts = useMemo(() => {
    if (!contacts) return [];
    
    let allContacts = [...contacts];
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allContacts = allContacts.filter(contact => 
        contact.name?.toLowerCase().includes(query) ||
        contact.phone?.includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query)
      );
    }
    
    // Mark the active call contact
    if (activeCall?.number) {
      allContacts = allContacts.map(contact => ({
        ...contact,
        isActive: contact.phone === activeCall.number || 
                  contact.phone_primary === activeCall.number
      }));
      
      // If active call contact not in list, add it
      const hasActiveContact = allContacts.some(c => c.isActive);
      if (!hasActiveContact) {
        allContacts.unshift({
          id: activeCall.contactId || 'active-call',
          phone: activeCall.number,
          phone_primary: activeCall.number,
          name: activeCall.name || activeCall.callerName || activeCall.number,
          email: activeCall.email,
          company: activeCall.company,
          isActive: true,
          queue_name: activeCall.isInbound ? 'Incoming Call' : 'Outbound Call'
        });
      }
    }

    return allContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.phone === contact.phone)
    );
  }, [contacts, activeCall, searchQuery]);

  useEffect(() => {
    if (!hasLoadedInitialData && !isLoadingInitialData) {
      setIsLoadingInitialData(true);
      
      Promise.all([
        loadContacts(),
        loadTagsAndDispositions(),
        loadGlobalSettings()
      ]).finally(() => {
        setIsLoadingInitialData(false);
        setHasLoadedInitialData(true);
      });
    }
  }, []);

  useEffect(() => {
    // Auto-select contact when call becomes active
    if (activeCall && activeCall.status === 'active') {
      // First, try to find the contact by phone number
      const contactByPhone = contacts.find(c => 
        c.phone === activeCall.number || 
        c.phone_primary === activeCall.number
      );
      
      if (contactByPhone) {
        // Only select if not already selected
        if (selectedContact?.id !== contactByPhone.id) {
          handleSelectContact(contactByPhone);
        }
      } else if (activeCall.contactId) {
        // If we have a contactId but contact not in list, try to find by ID
        const contactById = contacts.find(c => c.id === activeCall.contactId);
        if (contactById && selectedContact?.id !== contactById.id) {
          handleSelectContact(contactById);
        } else if (!contactById && selectedContact?.id !== activeCall.contactId) {
          // Create a temporary contact for the active call
          const tempContact = {
            id: activeCall.contactId || 'active-call',
            name: activeCall.name || activeCall.callerName || activeCall.number,
            phone: activeCall.number,
            phone_primary: activeCall.number,
            email: activeCall.email,
            company: activeCall.company,
            isActive: true
          };
          handleSelectContact(tempContact);
        }
      }
    }
  }, [activeCall]);

  const loadContacts = async () => {
    try {
      // Get recent contacts from new table that have interactions
      const response = await api.getContactsList({
        limit: 50,
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

  const loadTagsAndDispositions = async () => {
    if (tagsAndDispositionsLoaded.current) return;
  
    try {
      const [tagsData, dispositionsData] = await Promise.all([
        api.getTags(),
        api.getDispositions()
      ]);
      
      setAvailableTags(tagsData.map(tag => tag.name || tag));
      setDispositions(dispositionsData);
      tagsAndDispositionsLoaded.current = true;
    } catch (error) {
      console.error('Error loading tags and dispositions:', error);
      // Fallback values
      setAvailableTags(['Hot Lead', 'Decision Maker', 'Follow Up Required', 'Not Interested']);
      setDispositions([
        { id: 1, name: 'Interested', color: 'success' },
        { id: 2, name: 'Not Interested', color: 'danger' },
        { id: 3, name: 'Call Back Later', color: 'warning' },
        { id: 4, name: 'No Answer', color: 'secondary' }
      ]);
    }
  };

  const loadGlobalSettings = async () => {
    if (globalSettingsLoaded.current) return;
  
    try {
      const setting = await api.getGlobalSetting('disposition_mandatory');
      setDispositionMandatory(setting.value === true);
      globalSettingsLoaded.current = true;
    } catch (error) {
      console.error('Error loading disposition_mandatory setting:', error);
      setDispositionMandatory(false);
    }
  };

  const loadContactDetails = async (contactId) => {
    if (contactId === 'active-call') return;
    
    // Check cache first
    if (contactDetailsCache[contactId]) {
      setContactDetails(contactDetailsCache[contactId].details);
      setContactHistory(contactDetailsCache[contactId].history);
      return;
    }
    
    try {
      setLoadingDetails(true);
      const details = await api.getContactDetails(contactId);
      
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
      
      // Cache the details
      setContactDetailsCache(prev => ({
        ...prev,
        [contactId]: { details, history }
      }));
      
      setContactDetails(details);
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
    // Only update if different contact
    if (selectedContact?.id !== contact.id) {
      setSelectedContact(contact);
      if (contact.id !== 'active-call') {
        loadContactDetails(contact.id);
      }
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
      
      // Clear cache for this contact and reload
      setContactDetailsCache(prev => {
        const newCache = { ...prev };
        delete newCache[selectedContact.id];
        return newCache;
      });
      
      // Reload contact details to show new note
      loadContactDetails(selectedContact.id);
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleSaveInteraction = async () => {
    if (!selectedContact || selectedContact.id === 'active-call') return;
    
    // Check if disposition is mandatory
    if (dispositionMandatory && !selectedDisposition) {
      alert('Please select a disposition (required)');
      return;
    }
    
    if (!interactionNote.trim() && selectedTags.length === 0 && !selectedDisposition) {
      alert('Please add notes, tags, or disposition');
      return;
    }

    try {
      setSavingInteraction(true);
      
      // Save the interaction
      await api.addContactInteraction(selectedContact.id, {
        interaction_type: 'note',
        direction: 'internal',
        details: {
          note: interactionNote,
          tags: selectedTags,
          disposition: selectedDisposition
        }
      });

      // Update contact tags if any selected
      if (selectedTags.length > 0) {
        await api.updateContactDetails(selectedContact.id, {
          tags: selectedTags
        });
      }

      // Clear form
      setInteractionNote('');
      setSelectedTags([]);
      setSelectedDisposition('');
      
      // Clear cache for this contact and reload
      setContactDetailsCache(prev => {
        const newCache = { ...prev };
        delete newCache[selectedContact.id];
        return newCache;
      });
      
      // Reload contact details
      loadContactDetails(selectedContact.id);
      
      alert('Interaction saved successfully!');
    } catch (error) {
      console.error('Error saving interaction:', error);
      alert('Error saving interaction');
    } finally {
      setSavingInteraction(false);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="d-flex w-100" style={{ minWidth: '1100px', height: 'calc(100vh - 77px)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div className="border-end bg-light d-flex flex-column" style={{ width: '350px', flexShrink: 0, height: '100%' }}>
        <div className="p-3 border-bottom" style={{ flexShrink: 0 }}>
          <div className="d-flex align-items-center gap-2">
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search contacts..." 
              value={searchQuery}
              onChange={(e) => debouncedSearchChange(e.target.value)}
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
        {/* Contact List - Make this scrollable */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
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
            <div className="p-4 text-center text-muted">
              {searchQuery ? 'No contacts found' : 'No recent contacts'}
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
                    </div>
                    {/* Show interaction count badge only if not active call */}
                    {contact.interaction_count > 0 && !contact.isActive && (
                      <span className="badge bg-primary">{contact.interaction_count}</span>
                    )}
                  </div>

                  {/* Show call controls for active call */}
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
                            title={activeCall.isHeld ? 'Resume' : 'Hold'}
                          >
                            <Pause size={16} />
                          </button>
                          <button 
                            className={`btn btn-sm ${activeCall.isMuted ? 'btn-secondary' : 'btn-outline-secondary'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMuteCall();
                            }}
                            title={activeCall.isMuted ? 'Unmute' : 'Mute'}
                          >
                            <Disc size={16} />
                          </button>
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEndCall();
                            }}
                            title="End Call"
                          >
                            <X size={16} /> End
                          </button>
                        </>
                      )}
                      
                      {/* End button for outgoing calls being dialed */}
                      {!activeCall.isInbound && ['trying', 'connecting', 'ringing'].includes(activeCall.status) && (
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEndCall();
                          }}
                          title="Cancel Call"
                        >
                          <X size={16} /> Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      {selectedContact ? (
        <div className="flex-grow-1 d-flex flex-column" style={{ height: '100%', overflow: 'hidden' }}>
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
                {!selectedContact.isActive && selectedContact.id !== 'active-call' && (
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
            <div className="border-end d-flex flex-column" style={{ width: '350px', flexShrink: 0, height: '100%', overflowY: 'auto' }}>
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
                  {contactDetails.custom_fields && Object.keys(contactDetails.custom_fields).length > 0 && (
                    <div className="p-3 border-bottom">
                      <h6 className="text-muted mb-2">Custom Fields</h6>
                      <div className="small">
                        {Object.entries(contactDetails.custom_fields).map(([key, value]) => (
                          <div key={key} className="mb-1">
                            <strong>{key}:</strong> {value || '-'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Custom Data */}
                  {contactDetails.custom_data && Object.keys(contactDetails.custom_data).length > 0 && (
                    <div className="p-3 border-bottom">
                      <h6 className="text-muted mb-2">Additional Data</h6>
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
              ) : selectedContact.id === 'active-call' ? (
                <div className="p-4">
                  <h6 className="mb-3">Contact Information</h6>
                  <p className="text-muted">This is a temporary contact for the active call.</p>
                </div>
              ) : (
                <div className="p-4 text-center text-muted">
                  <Info size={48} className="mb-3 opacity-25" />
                  <p>Select a contact to view details</p>
                </div>
              )}
              {selectedContact && selectedContact.id !== 'active-call' && (
                <div className="p-4">
                  <TasksWidget 
                    contactId={selectedContact.id} 
                    compact={true} 
                  />
                </div>
              )}
              
            </div>

            {/* Right Panel - Interactions */}
            <div className="d-flex flex-column border-start bg-white" style={{ width: '100%', height: '100%' }}>
              {/* Interaction Input Section */}
              <div className="bg-light p-3 border-bottom" style={{ flexShrink: 0 }}>
                <h6 className="mb-2 d-flex align-items-center">
                  <FileText size={18} className="me-2" />
                  Add Interaction
                </h6>
                
                {/* Notes Input */}
                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">Notes</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows="2"
                    placeholder="Add interaction notes..."
                    value={interactionNote}
                    onChange={(e) => setInteractionNote(e.target.value)}
                    disabled={savingInteraction || selectedContact?.id === 'active-call'}
                  />
                </div>

                {/* Tags Selection */}
                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">
                    <Tag size={14} className="me-1" />
                    Tags
                  </label>
                  <div className="d-flex flex-wrap gap-1">
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        className={`btn btn-sm py-0 px-2 ${
                          selectedTags.includes(tag) 
                            ? 'btn-primary' 
                            : 'btn-outline-secondary'
                        }`}
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => toggleTag(tag)}
                        disabled={savingInteraction || selectedContact?.id === 'active-call'}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Disposition Selection */}
                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">
                    Disposition {dispositionMandatory && <span className="text-danger">*</span>}
                  </label>
                  <select 
                    className="form-select form-select-sm"
                    value={selectedDisposition}
                    onChange={(e) => setSelectedDisposition(e.target.value)}
                    disabled={savingInteraction || selectedContact?.id === 'active-call'}
                  >
                    <option value="">Select disposition...</option>
                    {dispositions.map(disp => (
                      <option key={disp.id} value={disp.name}>
                        {disp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Save Button */}
                <button 
                  className="btn btn-primary btn-sm w-100"
                  onClick={handleSaveInteraction}
                  disabled={savingInteraction || selectedContact?.id === 'active-call' || (!interactionNote.trim() && selectedTags.length === 0 && !selectedDisposition)}
                >
                  {savingInteraction ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="me-2" />
                      Save Interaction
                    </>
                  )}
                </button>
              </div>

              {/* History Section */}
              <div className="p-3" style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <h6 className="mb-3" style={{ flexShrink: 0 }}>Interaction History</h6>
                {contactHistory.length === 0 ? (
                  <div className="d-flex align-items-center justify-content-center flex-grow-1">
                    <p className="text-muted">No history available</p>
                  </div>
                ) : (
                  <div className="timeline" style={{ flex: '1 1 auto' }}>
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

          {/* Call Notes Panel - Show only for active calls */}
          {selectedContact && selectedContact.isActive && activeCall?.status === 'active' && (
            <CallNotesPanel 
              contactId={selectedContact.id !== 'active-call' ? selectedContact.id : null}
              onClose={() => {}}
            />
          )}
        </div>
      ) : (
        <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
          <div className="text-center">
            <Phone size={48} className="mb-3 opacity-25" />
            <p>Select a contact to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}