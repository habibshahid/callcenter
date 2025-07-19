// client/src/components/DuplicateManager.js
import React, { useState, useEffect } from 'react';
import { Users, Merge, X, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export default function DuplicateManager({ campaignId, onClose }) {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(new Map());

  useEffect(() => {
    loadDuplicates();
  }, [campaignId]);

  const loadDuplicates = async () => {
    try {
      setLoading(true);
      const data = await api.findDuplicates(campaignId);
      setDuplicates(data.duplicates);
      
      // Initialize selection map
      const initialSelections = new Map();
      data.duplicates.forEach((dup, index) => {
        // Default to keeping the first contact (usually oldest)
        initialSelections.set(index, dup.contacts[0].id);
      });
      setSelectedGroups(initialSelections);
    } catch (error) {
      console.error('Error loading duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeepSelection = (groupIndex, contactId) => {
    const newSelections = new Map(selectedGroups);
    newSelections.set(groupIndex, contactId);
    setSelectedGroups(newSelections);
  };

  const handleMergeGroup = async (groupIndex) => {
    const duplicate = duplicates[groupIndex];
    const keepId = selectedGroups.get(groupIndex);
    const mergeIds = duplicate.contacts
      .filter(c => c.id !== keepId)
      .map(c => c.id);

    if (mergeIds.length === 0) return;

    try {
      setMerging(true);
      await api.mergeDuplicates(keepId, mergeIds);
      
      // Remove merged group from list
      setDuplicates(prev => prev.filter((_, index) => index !== groupIndex));
      
      // Show success message
      alert(`Successfully merged ${mergeIds.length + 1} contacts`);
    } catch (error) {
      console.error('Error merging contacts:', error);
      alert('Error merging contacts');
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAll = async () => {
    if (!window.confirm(`Merge all ${duplicates.length} duplicate groups?`)) {
      return;
    }

    try {
      setMerging(true);
      let successCount = 0;

      for (let i = 0; i < duplicates.length; i++) {
        const duplicate = duplicates[i];
        const keepId = selectedGroups.get(i);
        const mergeIds = duplicate.contacts
          .filter(c => c.id !== keepId)
          .map(c => c.id);

        if (mergeIds.length > 0) {
          try {
            await api.mergeDuplicates(keepId, mergeIds);
            successCount++;
          } catch (error) {
            console.error(`Error merging group ${i}:`, error);
          }
        }
      }

      alert(`Successfully merged ${successCount} duplicate groups`);
      loadDuplicates();
    } catch (error) {
      console.error('Error in bulk merge:', error);
      alert('Error merging duplicates');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <Users size={20} className="me-2" />
              Duplicate Contact Management
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={merging}
            />
          </div>
          
          <div className="modal-body">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border" />
                <p className="mt-2">Finding duplicates...</p>
              </div>
            ) : duplicates.length === 0 ? (
              <div className="text-center py-5">
                <CheckCircle size={48} className="text-success mb-3" />
                <h5>No Duplicates Found</h5>
                <p className="text-muted">All contacts have unique phone numbers</p>
              </div>
            ) : (
              <>
                <div className="alert alert-info">
                  Found {duplicates.length} groups of duplicate contacts. 
                  Select which contact to keep in each group.
                </div>

                <div className="mb-3">
                  <button 
                    className="btn btn-primary"
                    onClick={handleMergeAll}
                    disabled={merging}
                  >
                    <Merge size={18} className="me-2" />
                    Merge All Selected
                  </button>
                </div>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {duplicates.map((duplicate, groupIndex) => (
                    <div key={groupIndex} className="card mb-3">
                      <div className="card-header">
                        <div className="d-flex justify-content-between align-items-center">
                          <span>
                            Phone: <strong>{duplicate.phone}</strong> 
                            <span className="badge bg-warning ms-2">
                              {duplicate.count} duplicates
                            </span>
                          </span>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleMergeGroup(groupIndex)}
                            disabled={merging}
                          >
                            Merge Group
                          </button>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm mb-0">
                            <thead>
                              <tr>
                                <th width="40">Keep</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Company</th>
                                <th>ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {duplicate.contacts.map(contact => (
                                <tr 
                                  key={contact.id}
                                  className={selectedGroups.get(groupIndex) === contact.id ? 'table-success' : ''}
                                >
                                  <td>
                                    <input
                                      type="radio"
                                      name={`group-${groupIndex}`}
                                      checked={selectedGroups.get(groupIndex) === contact.id}
                                      onChange={() => handleKeepSelection(groupIndex, contact.id)}
                                    />
                                  </td>
                                  <td>{contact.name || <span className="text-muted">No name</span>}</td>
                                  <td>{contact.email || <span className="text-muted">-</span>}</td>
                                  <td>{contact.company || <span className="text-muted">-</span>}</td>
                                  <td className="text-muted">#{contact.id}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
              disabled={merging}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}