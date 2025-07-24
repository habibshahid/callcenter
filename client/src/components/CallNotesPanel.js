// Enhanced CallNotesPanel.js with mandatory input after call ends
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Save, Tag, X, Move, GripVertical, AlertTriangle } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { api } from '../services/api';

export default function CallNotesPanel({ contactId, onClose }) {
  const { activeCall } = useCall();
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [selectedDisposition, setSelectedDisposition] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // New states for mandatory input
  const [callEnded, setCallEnded] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [forceClose, setForceClose] = useState(false);
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  const [dispositionMandatory, setDispositionMandatory] = useState(false);
  
  // Drag and resize state (same as before)
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 20 });
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const panelRef = useRef(null);

  useEffect(() => {
    loadData();
    loadGlobalSettings();

    // Load saved position/size from localStorage
    const savedState = localStorage.getItem('callNotesPanelState');
    if (savedState) {
      const { position: savedPos, size: savedSize } = JSON.parse(savedState);
      if (savedPos) setPosition(savedPos);
      if (savedSize) setSize(savedSize);
    }
  }, []);

  const loadGlobalSettings = async () => {
    try {
      const setting = await api.getGlobalSetting('disposition_mandatory');
      setDispositionMandatory(setting.value === true);
    } catch (error) {
      console.error('Error loading disposition_mandatory setting:', error);
      // Default to false if setting not found
      setDispositionMandatory(false);
    }
  };

  // Save position/size to localStorage
  useEffect(() => {
    const state = { position, size };
    localStorage.setItem('callNotesPanelState', JSON.stringify(state));
  }, [position, size]);

  // Track when call ends
  useEffect(() => {
    if (activeCall?.status === 'Rejected' || activeCall?.status === 'Failed' || activeCall?.status === 'Terminated' || activeCall?.status === 'terminated' || activeCall?.status === 'failed' || activeCall?.status === 'rejected') {
      setCallEnded(true);
      // Check if there's any data entered
      const hasData = notes.trim() || selectedTags.length > 0 || selectedDisposition;
      setHasUnsavedData(hasData);
    }
  }, [activeCall?.status, notes, selectedTags, selectedDisposition]);

  // Prevent closing without data after call ends
  const handleCloseAttempt = () => {
    const hasData = notes.trim() || selectedTags.length > 0 || selectedDisposition;
    
    // Check if disposition is mandatory and missing
    const dispositionRequired = dispositionMandatory && !selectedDisposition;
    
    if (callEnded && !forceClose) {
      // If disposition is mandatory and not selected, show warning
      if (dispositionRequired) {
        setShowCloseWarning(true);
        return;
      }
      // If no data at all, show warning
      if (!hasData) {
        setShowCloseWarning(true);
        return;
      }
    }
    
    // If there's unsaved data, show different warning
    if (hasData && !forceClose) {
      if (window.confirm('You have unsaved notes. Are you sure you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Mouse event handlers (same as before)
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
          width: Math.max(300, Math.min(newWidth, window.innerWidth - position.x)),
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [dispositionsData, tagsData] = await Promise.all([
        api.getDispositions(),
        api.getTags()
      ]);
      
      setDispositions(dispositionsData);
      setTags(tagsData.map(tag => tag.name));
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to hardcoded values if API fails
      setDispositions([
        { id: 1, name: 'Interested', color: 'success' },
        { id: 2, name: 'Not Interested', color: 'danger' },
        { id: 3, name: 'Call Back Later', color: 'warning' }
      ]);
      setTags(['Hot Lead', 'Decision Maker', 'Follow Up Required']);
    } finally {
      setLoading(false);
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
          call_ended: callEnded
        }
      };

      await api.addContactInteraction(contactId, interactionData);
      
      if (selectedTags.length > 0) {
        await api.updateContactDetails(contactId, {
          tags: selectedTags
        });
      }

      // Clear form after save
      setNotes('');
      setSelectedTags([]);
      setSelectedDisposition('');
      setHasUnsavedData(false);
      
      alert('Notes saved successfully!');
      
      // Allow closing after successful save
      setForceClose(true);
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Error saving notes: ' + error.message);
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

  const isCallActive = activeCall && !['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(activeCall.status);
  const hasData = notes.trim() || selectedTags.length > 0 || selectedDisposition;
  const showWarning = callEnded && !hasData && dispositionMandatory;

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999
      }}>
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
            {/* Warning for call ended without data */}
            {showWarning && (
              <div className="alert alert-warning d-flex align-items-start">
                <AlertTriangle size={20} className="me-2 flex-shrink-0 mt-1" />
                <div>
                  <strong>Call Summary Required</strong>
                  <p className="mb-0 small mt-1">
                    Please add at least one of the following before closing:
                    <ul className="mb-0 mt-1">
                      <li>Call notes</li>
                      <li>Disposition</li>
                      <li>Tags</li>
                    </ul>
                  </p>
                </div>
              </div>
            )}
            {callEnded && !hasData && (
              <div className="alert alert-warning d-flex align-items-start">
                <AlertTriangle size={20} className="me-2 flex-shrink-0 mt-1" />
                <div>
                  <strong>Call Summary Required</strong>
                  <p className="mb-0 small mt-1">
                    Please add at least one of the following before closing:
                    <ul className="mb-0 mt-1">
                      <li>Call notes</li>
                      <li>Disposition</li>
                      <li>Tags</li>
                    </ul>
                  </p>
                </div>
              </div>
            )}

            {/* Status indicator */}
            {isCallActive && (
              <div className="alert alert-info py-2 mb-3">
                <small>📞 Call in progress</small>
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
                style={{ resize: 'none' }}
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

      {/* Close Warning Modal */}
      {showCloseWarning && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Call Summary Required</h5>
              </div>
              <div className="modal-body">
                {dispositionMandatory && !selectedDisposition ? (
                  <>
                    <p>A disposition is required before closing the call notes.</p>
                    <p>Please select a disposition for this call.</p>
                  </>
                ) : (
                  <>
                    <p>You must add at least one of the following before closing:</p>
                    <ul>
                      <li>Call notes</li>
                      <li>Disposition</li>
                      <li>Tags</li>
                    </ul>
                  </>
                )}
                <p>Would you like to force close anyway?</p>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowCloseWarning(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => {
                    setForceClose(true);
                    setShowCloseWarning(false);
                    onClose();
                  }}
                >
                  Force Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}