// src/components/CallNotesPanel.js
import React, { useState, useEffect } from 'react';
import { MessageSquare, Save, Tag, X } from 'lucide-react';
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

  useEffect(() => {
    loadDispositions();
  }, []);

  // Auto-save when call ends
  useEffect(() => {
    if (activeCall?.status === 'terminated' && (notes || selectedTags.length > 0 || selectedDisposition)) {
      handleSave(true);
    }
  }, [activeCall?.status]);

  const loadDispositions = async () => {
    try {
      // Mock dispositions - replace with actual API call
      const mockDispositions = [
        { id: 1, name: 'Interested', color: 'success' },
        { id: 2, name: 'Not Interested', color: 'danger' },
        { id: 3, name: 'Call Back Later', color: 'warning' },
        { id: 4, name: 'Wrong Number', color: 'secondary' },
        { id: 5, name: 'Voicemail', color: 'info' },
        { id: 6, name: 'Successful Sale', color: 'primary' }
      ];
      setDispositions(mockDispositions);

      // Mock tags
      const mockTags = [
        'Hot Lead', 'Cold Lead', 'Decision Maker', 'Gatekeeper',
        'Technical Questions', 'Pricing Questions', 'Demo Requested',
        'Follow Up Required', 'Send Email', 'Send Proposal'
      ];
      setTags(mockTags);
    } catch (error) {
      console.error('Error loading dispositions:', error);
    }
  };

  const handleSave = async (isAutoSave = false) => {
    if (!contactId || (!notes.trim() && selectedTags.length === 0 && !selectedDisposition)) {
      return;
    }

    setSaving(true);
    if (isAutoSave) setAutoSave(true);

    try {
      const interactionData = {
        interaction_type: 'note',
        direction: 'internal',
        details: {
          note: notes,
          tags: selectedTags,
          disposition: selectedDisposition,
          call_related: true,
          call_status: activeCall?.status,
          auto_saved: isAutoSave
        }
      };

      await api.addContactInteraction(contactId, interactionData);

      // Update contact tags if any selected
      if (selectedTags.length > 0) {
        await api.updateContactDetails(contactId, {
          tags: selectedTags
        });
      }

      if (!isAutoSave) {
        // Clear form after manual save
        setNotes('');
        setSelectedTags([]);
        setSelectedDisposition('');
        alert('Notes saved successfully!');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      if (!isAutoSave) {
        alert('Error saving notes');
      }
    } finally {
      setSaving(false);
      setAutoSave(false);
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

  return (
    <div className="call-notes-panel card shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <MessageSquare size={18} className="me-2" />
          Call Notes
        </h6>
        {onClose && (
          <button className="btn btn-sm btn-link" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>
      
      <div className="card-body">
        {/* Notes Text Area */}
        <div className="mb-3">
          <label className="form-label small">Notes</label>
          <textarea
            className="form-control"
            rows="4"
            placeholder="Add notes about this call..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* Disposition Selection */}
        <div className="mb-3">
          <label className="form-label small">
            <Tag size={14} className="me-1" />
            Call Disposition
          </label>
          <select 
            className="form-select"
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
          <label className="form-label small">Tags</label>
          <div className="d-flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag}
                className={`btn btn-sm ${
                  selectedTags.includes(tag) 
                    ? 'btn-primary' 
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
        <div className="d-flex justify-content-between align-items-center">
          <div>
            {autoSave && (
              <small className="text-success">
                <Save size={14} className="me-1" />
                Auto-saved
              </small>
            )}
          </div>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => handleSave(false)}
            disabled={saving || !isCallActive}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="me-2" />
                Save Notes
              </>
            )}
          </button>
        </div>

        {!isCallActive && (
          <div className="alert alert-info mt-3 mb-0">
            <small>Call notes will be auto-saved when the call ends.</small>
          </div>
        )}
      </div>
    </div>
  );
}

// CSS for the panel
const panelStyles = `
.call-notes-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 350px;
  max-height: 600px;
  overflow-y: auto;
  z-index: 1040;
}

@media (max-width: 768px) {
  .call-notes-panel {
    width: 90%;
    right: 5%;
  }
}
`;