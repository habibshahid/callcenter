// Enhanced CallNotesPanel.js with call and contact information display
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Save, Tag, X, Move, GripVertical, AlertTriangle,
  Phone, User, Building, Mail, Clock, Calendar
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import { api } from '../services/api';

export default function CallNotesPanel({ contactId, onClose }) {
  const { activeCall, callDuration } = useCall();
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [selectedDisposition, setSelectedDisposition] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState(null);
  
  // States for mandatory input and drag/resize
  const [callEnded, setCallEnded] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [forceClose, setForceClose] = useState(false);
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  
  // Drag and resize state
  const [position, setPosition] = useState({ x: window.innerWidth - 520, y: 20 });
  const [size, setSize] = useState({ width: 500, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const panelRef = useRef(null);

  useEffect(() => {
    loadData();
    
    // Load saved position/size from localStorage
    const savedState = localStorage.getItem('callNotesPanelState');
    if (savedState) {
      const { position: savedPos, size: savedSize } = JSON.parse(savedState);
      if (savedPos) setPosition(savedPos);
      if (savedSize) setSize(savedSize);
    }
  }, [contactId]);

  // Save position/size to localStorage
  useEffect(() => {
    const state = { position, size };
    localStorage.setItem('callNotesPanelState', JSON.stringify(state));
  }, [position, size]);

  // Track when call ends
  useEffect(() => {
    if (activeCall?.status === 'terminated' || activeCall?.status === 'failed' || activeCall?.status === 'rejected') {
      setCallEnded(true);
      const hasData = notes.trim() || selectedTags.length > 0 || selectedDisposition;
      setHasUnsavedData(hasData);
    }
  }, [activeCall?.status, notes, selectedTags, selectedDisposition]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load contact information if we have a valid contactId
      if (contactId && contactId !== 'active-call') {
        try {
          const contactDetails = await api.getContactDetails(contactId);
          setContactInfo(contactDetails);
        } catch (error) {
          console.error('Error loading contact details:', error);
        }
      }
      
      // Load dispositions and tags from API
      try {
        const [dispositionsData, tagsData] = await Promise.all([
          api.getDispositions(),
          api.getTags()
        ]);
        
        setDispositions(dispositionsData);
        setTags(tagsData.map(tag => tag.name || tag));
      } catch (error) {
        console.error('Error loading dispositions/tags:', error);
        // Fallback to mock data if API fails
        setDispositions([
          { id: 1, name: 'Successful Contact', color: 'success' },
          { id: 2, name: 'Not Interested', color: 'danger' },
          { id: 3, name: 'Call Back Later', color: 'warning' }
        ]);
        setTags(['Hot Lead', 'Decision Maker', 'Follow Up Required']);
      }
    } catch (error) {
      console.error('Error in loadData:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      } else if (isResizing) {
        const newWidth = resizeStart.width + (e.clientX - resizeStart.x);
        const newHeight = resizeStart.height + (e.clientY - resizeStart.y);
        
        setSize({
          width: Math.max(400, Math.min(newWidth, 800)),
          height: Math.max(400, Math.min(newHeight, window.innerHeight - position.y))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, position, size]);

  const handleDragStart = (e) => {
    if (e.target.closest('.resize-handle')) return;
    
    const rect = panelRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
    e.preventDefault();
  };

  const handleResizeStart = (e) => {
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCloseAttempt = () => {
    const hasData = notes.trim() || selectedTags.length > 0 || selectedDisposition;
    
    if (callEnded && !hasData && !forceClose) {
      setShowCloseWarning(true);
    } else if (hasData && !forceClose) {
      if (window.confirm('You have unsaved notes. Close anyway?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!contactId || (!notes.trim() && selectedTags.length === 0 && !selectedDisposition)) {
      return;
    }

    setSaving(true);
    try {
      const interactionData = {
        interaction_type: 'note',
        direction: 'internal',
        details: {
          note: notes,
          tags: selectedTags,
          disposition: selectedDisposition,
          call_related: true,
          call_status: activeCall?.status || 'terminated',
          call_duration: callDuration,
          call_ended: callEnded
        }
      };

      await api.addContactInteraction(contactId, interactionData);
      
      if (selectedTags.length > 0) {
        await api.updateContactDetails(contactId, {
          tags: selectedTags
        });
      }

      setNotes('');
      setSelectedTags([]);
      setSelectedDisposition('');
      setHasUnsavedData(false);
      
      alert('Notes saved successfully!');
      
      setForceClose(true);
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Error saving notes');
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const isCallActive = activeCall && !['terminated', 'failed', 'rejected'].includes(activeCall.status);
  const hasData = notes.trim() || selectedTags.length > 0 || selectedDisposition;

  if (loading) {
    return (
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        ref={panelRef}
        className="call-notes-panel-draggable"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 9999,
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div className="card h-100" style={{ 
          margin: 0, 
          border: callEnded && !hasData ? '3px solid #ffc107' : '2px solid #0d6efd', 
          borderRadius: '8px' 
        }}>
          <div 
            className="card-header d-flex justify-content-between align-items-center" 
            style={{ 
              backgroundColor: callEnded && !hasData ? '#ffc107' : '#0d6efd', 
              color: callEnded && !hasData ? '#000' : 'white',
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleDragStart}
          >
            <h6 className="mb-0 d-flex align-items-center" style={{ color: 'inherit' }}>
              <Move size={18} className="me-2" style={{ cursor: 'grab' }} />
              <MessageSquare size={18} className="me-2" />
              Call Notes {callEnded && !hasData && '(Required)'}
            </h6>
            {onClose && (
              <button 
                className="btn btn-sm btn-link p-0" 
                onClick={handleCloseAttempt}
                style={{ color: 'inherit' }}
              >
                <X size={18} />
              </button>
            )}
          </div>
          
          <div className="card-body overflow-auto" style={{ flex: 1 }}>
            {/* Call Information Section */}
            <div className="mb-3 p-3 bg-light rounded">
              <h6 className="mb-2 text-primary">
                <Phone size={16} className="me-2" />
                Call Information
              </h6>
              <div className="row small">
                <div className="col-6">
                  <div className="mb-1">
                    <strong>Number:</strong> {activeCall?.number || 'Unknown'}
                  </div>
                  <div className="mb-1">
                    <strong>Status:</strong> 
                    <span className={`ms-1 badge bg-${isCallActive ? 'success' : 'secondary'}`}>
                      {activeCall?.status || 'Ended'}
                    </span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="mb-1">
                    <strong>Duration:</strong> {formatTime(callDuration)}
                  </div>
                  <div className="mb-1">
                    <strong>Direction:</strong> 
                    <span className="ms-1">
                      {activeCall?.isInbound ? 'Inbound' : 'Outbound'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            {contactInfo && (
              <div className="mb-3 p-3 bg-light rounded">
                <h6 className="mb-2 text-primary">
                  <User size={16} className="me-2" />
                  Contact Information
                </h6>
                <div className="small">
                  <div className="mb-1">
                    <strong>Name:</strong> {contactInfo.first_name} {contactInfo.last_name}
                  </div>
                  {contactInfo.company && (
                    <div className="mb-1">
                      <Building size={14} className="me-1" />
                      <strong>Company:</strong> {contactInfo.company}
                    </div>
                  )}
                  {contactInfo.email && (
                    <div className="mb-1">
                      <Mail size={14} className="me-1" />
                      <strong>Email:</strong> {contactInfo.email}
                    </div>
                  )}
                  {contactInfo.last_interaction && (
                    <div className="mb-1">
                      <Clock size={14} className="me-1" />
                      <strong>Last Contact:</strong> {formatDateTime(contactInfo.last_interaction)}
                    </div>
                  )}
                  {contactInfo.campaign_name && (
                    <div className="mb-1">
                      <strong>Campaign:</strong> {contactInfo.campaign_name}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warning for call ended without data */}
            {callEnded && !hasData && (
              <div className="alert alert-warning d-flex align-items-start mb-3">
                <AlertTriangle size={20} className="me-2 flex-shrink-0 mt-1" />
                <div>
                  <strong>Call Summary Required</strong>
                  <p className="mb-0 small mt-1">
                    Please add at least one of the following before closing:
                    notes, disposition, or tags.
                  </p>
                </div>
              </div>
            )}

            {/* Notes Text Area */}
            <div className="mb-3">
              <label className="form-label small fw-bold">
                Notes {callEnded && !notes.trim() && <span className="text-danger">*</span>}
              </label>
              <textarea
                className={`form-control ${callEnded && !hasData ? 'border-warning' : ''}`}
                rows="4"
                placeholder="Add notes about this call..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Disposition Selection */}
            <div className="mb-3">
              <label className="form-label small fw-bold">
                <Tag size={14} className="me-1" />
                Call Disposition {callEnded && !selectedDisposition && <span className="text-danger">*</span>}
              </label>
              <select 
                className={`form-select ${callEnded && !hasData ? 'border-warning' : ''}`}
                value={selectedDisposition}
                onChange={(e) => setSelectedDisposition(e.target.value)}
                disabled={saving}
              >
                <option value="">Select disposition...</option>
                {dispositions.map(disp => (
                  <option key={disp.id} value={disp.name}>
                    {disp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags Selection */}
            <div className="mb-3">
              <label className="form-label small fw-bold">
                Tags {callEnded && selectedTags.length === 0 && <span className="text-danger">*</span>}
              </label>
              <div className="d-flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag}
                    className={`btn btn-sm ${
                      selectedTags.includes(tag) 
                        ? 'btn-primary' 
                        : callEnded && !hasData 
                          ? 'btn-outline-warning' 
                          : 'btn-outline-secondary'
                    }`}
                    onClick={() => toggleTag(tag)}
                    disabled={saving}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="d-grid">
              <button 
                className={`btn ${callEnded && !hasData ? 'btn-warning' : 'btn-primary'}`}
                onClick={handleSave}
                disabled={saving || !hasData}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="me-2" />
                    {callEnded ? 'Save & Close' : 'Save Notes'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Resize handle */}
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '20px',
            height: '20px',
            cursor: 'nwse-resize',
            backgroundColor: 'transparent'
          }}
        >
          <GripVertical 
            size={16} 
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              color: '#6c757d',
              transform: 'rotate(45deg)'
            }}
          />
        </div>
      </div>

      {/* Close Warning Modal (same as before) */}
      {showCloseWarning && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <AlertTriangle size={20} className="me-2" />
                  Call Summary Required
                </h5>
              </div>
              <div className="modal-body">
                <p>The call has ended but no summary was provided.</p>
                <p className="mb-0">Please add at least one of the following:</p>
                <ul>
                  <li>Call notes</li>
                  <li>Call disposition</li>
                  <li>Tags</li>
                </ul>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCloseWarning(false);
                    setForceClose(true);
                    onClose();
                  }}
                >
                  Close Anyway
                </button>
                <button 
                  className="btn btn-warning"
                  onClick={() => setShowCloseWarning(false)}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}