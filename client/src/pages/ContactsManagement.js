// client/src/pages/ContactsManagement.js - Enhanced version
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Upload, Download, Phone, Mail, Filter, Plus, Edit, 
  Eye, ChevronLeft, ChevronRight, Users, CheckCircle, AlertCircle,
  Trash2, UserCheck, Tag, RefreshCw, FileSpreadsheet, Save
} from 'lucide-react';
import { api } from '../services/api';
import { useCall } from '../context/CallContext';
import { debounce } from 'lodash';
import EnhancedImportModal from '../components/EnhancedImportModal';
import DuplicateManager from '../components/DuplicateManager';

export default function ContactsManagement() {
  const { handleDial } = useCall();
  
  // State
  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    assigned_to: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);
  const [showDuplicateManager, setShowDuplicateManager] = useState(false);
  // Load initial data
  useEffect(() => {
    loadCampaigns();
    loadAgents();
    loadSavedFilters();
  }, []);

  // Load contacts when filters change
  useEffect(() => {
    loadContacts();
  }, [selectedCampaign, filters.status, filters.assigned_to, pagination.page]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query) => {
      loadContacts(query);
    }, 300),
    [selectedCampaign, filters]
  );

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      loadContacts();
    }
  }, [searchQuery]);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0].id);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const data = await api.getActiveAgents();
      setAgents(data);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const loadContacts = async (search = searchQuery) => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        campaign_id: selectedCampaign,
        ...(filters.status && { status: filters.status }),
        ...(filters.assigned_to && { assigned_to: filters.assigned_to }),
        ...(search && { search })
      };

      const data = await api.getContactsList(params);
      setContacts(data.contacts);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedFilters = () => {
    const saved = localStorage.getItem('contactFilters');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  };

  const saveCurrentFilter = () => {
    const filterName = prompt('Enter a name for this filter:');
    if (filterName) {
      const newFilter = {
        id: Date.now(),
        name: filterName,
        campaign_id: selectedCampaign,
        ...filters,
        search: searchQuery
      };
      const updated = [...savedFilters, newFilter];
      setSavedFilters(updated);
      localStorage.setItem('contactFilters', JSON.stringify(updated));
    }
  };

  const loadSavedFilter = (filter) => {
    setSelectedCampaign(filter.campaign_id);
    setFilters({
      status: filter.status || '',
      assigned_to: filter.assigned_to || ''
    });
    setSearchQuery(filter.search || '');
    setShowFilterMenu(false);
  };

  const handleBulkAction = async () => {
    if (selectedContacts.size === 0) {
      alert('Please select contacts first');
      return;
    }

    const contactIds = Array.from(selectedContacts);

    try {
      switch (bulkAction) {
        case 'delete':
          if (window.confirm(`Delete ${contactIds.length} contacts?`)) {
            await api.bulkDeleteContacts(contactIds);
            setSelectedContacts(new Set());
            loadContacts();
          }
          break;

        case 'assign':
          const assignTo = prompt('Enter agent ID to assign to:');
          if (assignTo) {
            await api.bulkAssignContacts(contactIds, assignTo);
            setSelectedContacts(new Set());
            loadContacts();
          }
          break;

        case 'status':
          const newStatus = prompt('Enter new status (new/contacted/interested/not_interested/do_not_call):');
          if (newStatus) {
            await api.bulkUpdateContacts(contactIds, { status: newStatus });
            setSelectedContacts(new Set());
            loadContacts();
          }
          break;

        case 'export':
          handleExport(contactIds);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      alert('Error performing bulk action');
    }
  };

  const handleExport = async (contactIds = null) => {
    try {
      const params = {
        format: 'excel',
        campaign_id: selectedCampaign,
        ...(filters.status && { status: filters.status }),
        ...(filters.assigned_to && { assigned_to: filters.assigned_to })
      };

      if (contactIds) {
        params.contact_ids = contactIds.join(',');
      }

      const blob = await api.exportContacts(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting contacts');
    }
  };

  const handleCall = (phoneNumber) => {
    handleDial(phoneNumber);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleSelectContact = (contactId) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'new': 'bg-primary',
      'contacted': 'bg-info',
      'interested': 'bg-success',
      'not_interested': 'bg-warning',
      'do_not_call': 'bg-danger',
      'invalid': 'bg-secondary'
    };
    return statusClasses[status] || 'bg-secondary';
  };

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <h2 className="mb-0">Leads Management</h2>
        </div>
        <div className="col-auto">
          <div className="btn-group">
            <button 
              className="btn btn-primary"
              onClick={() => setShowImportModal(true)}
            >
              <Upload size={18} className="me-2" />
              Import
            </button>
            <button 
              className="btn btn-outline-primary"
              onClick={() => handleExport()}
            >
              <Download size={18} className="me-2" />
              Export All
            </button>
            <button 
              className="btn btn-outline-warning"
              onClick={() => setShowDuplicateManager(true)}
            >
              <Users size={18} className="me-2" />
              Find Duplicates
            </button>
            <button className="btn btn-outline-primary">
              <Plus size={18} className="me-2" />
              Add Contact
            </button>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="row mb-3">
        <div className="col-md-2">
          <select 
            className="form-select"
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
          >
            <option value="">Select Campaign</option>
            {campaigns.map(campaign => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <select 
            className="form-select"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="do_not_call">Do Not Call</option>
            <option value="invalid">Invalid</option>
          </select>
        </div>
        <div className="col-md-2">
          <select 
            className="form-select"
            value={filters.assigned_to}
            onChange={(e) => setFilters({...filters, assigned_to: e.target.value})}
          >
            <option value="">All Agents</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.username}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <div className="input-group">
            <span className="input-group-text">
              <Search size={18} />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-2">
          <div className="btn-group w-100">
            <button 
              className="btn btn-outline-secondary"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Filter size={18} className="me-2" />
              Filters
            </button>
            <button 
              className="btn btn-outline-secondary"
              onClick={saveCurrentFilter}
              title="Save current filter"
            >
              <Save size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Saved Filters Dropdown */}
      {showFilterMenu && savedFilters.length > 0 && (
        <div className="row mb-3">
          <div className="col">
            <div className="card shadow-sm">
              <div className="card-body">
                <h6 className="card-title mb-3">Saved Filters</h6>
                <div className="d-flex flex-wrap gap-2">
                  {savedFilters.map(filter => (
                    <button
                      key={filter.id}
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => loadSavedFilter(filter)}
                    >
                      {filter.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats and Bulk Actions Bar */}
      <div className="row mb-3">
        <div className="col-md-6">
          <div className="d-flex align-items-center gap-3 text-muted small">
            <span>
              <Users size={16} className="me-1" />
              Total: {pagination.total}
            </span>
            <span>
              <CheckCircle size={16} className="me-1" />
              Selected: {selectedContacts.size}
            </span>
            <button 
              className="btn btn-link btn-sm p-0"
              onClick={() => {
                setPagination({...pagination, page: 1});
                loadContacts();
              }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div className="col-md-6">
          {selectedContacts.size > 0 && (
            <div className="d-flex justify-content-end align-items-center gap-2">
              <select 
                className="form-select form-select-sm" 
                style={{width: '200px'}}
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="">Bulk Actions</option>
                <option value="assign">Assign to Agent</option>
                <option value="status">Change Status</option>
                <option value="export">Export Selected</option>
                <option value="delete">Delete Selected</option>
              </select>
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleBulkAction}
                disabled={!bulkAction}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th width="40">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    onChange={handleSelectAll}
                    checked={selectedContacts.size === contacts.length && contacts.length > 0}
                  />
                </th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Company</th>
                <th>Status</th>
                <th>Last Contact</th>
                <th>Assigned To</th>
                <th width="120">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    <div className="spinner-border spinner-border-sm me-2" />
                    Loading contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-4 text-muted">
                    No contacts found
                  </td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact.id} className={selectedContacts.has(contact.id) ? 'table-active' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => handleSelectContact(contact.id)}
                      />
                    </td>
                    <td>
                      <div className="fw-medium">
                        {contact.first_name || contact.last_name ? 
                          `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
                          <span className="text-muted">No name</span>
                        }
                      </div>
                    </td>
                    <td>
                      <a 
                        href="#" 
                        className="text-decoration-none"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCall(contact.phone_primary);
                        }}
                      >
                        <Phone size={14} className="me-1" />
                        {contact.phone_display}
                      </a>
                    </td>
                    <td>
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="text-decoration-none">
                          <Mail size={14} className="me-1" />
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>{contact.company || <span className="text-muted">-</span>}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(contact.status)}`}>
                        {contact.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {contact.last_interaction ? 
                        new Date(contact.last_interaction).toLocaleDateString() : 
                        <span className="text-muted">Never</span>
                      }
                    </td>
                    <td>{contact.assigned_to_name || <span className="text-muted">Unassigned</span>}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button 
                          className="btn btn-outline-secondary"
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          className="btn btn-outline-secondary"
                          title="Edit contact"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="btn btn-outline-primary"
                          onClick={() => handleCall(contact.phone_primary)}
                          title="Call contact"
                        >
                          <Phone size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center">
            <div className="text-muted">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} contacts
            </div>
            <nav>
              <ul className="pagination mb-0">
                <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                  <button 
                    className="page-link"
                    onClick={() => setPagination({...pagination, page: pagination.page - 1})}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                </li>
                {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <li key={pageNum} className={`page-item ${pagination.page === pageNum ? 'active' : ''}`}>
                      <button 
                        className="page-link"
                        onClick={() => setPagination({...pagination, page: pageNum})}
                      >
                        {pageNum}
                      </button>
                    </li>
                  );
                })}
                {pagination.pages > 5 && (
                  <li className="page-item disabled">
                    <span className="page-link">...</span>
                  </li>
                )}
                <li className={`page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`}>
                  <button 
                    className="page-link"
                    onClick={() => setPagination({...pagination, page: pagination.page + 1})}
                    disabled={pagination.page === pagination.pages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* Enhanced Import Modal */}
      {showImportModal && (
        <EnhancedImportModal
          campaigns={campaigns}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            setShowImportModal(false);
            loadContacts();
          }}
        />
      )}
      {showDuplicateManager && (
        <DuplicateManager
          campaignId={selectedCampaign}
          onClose={() => setShowDuplicateManager(false)}
        />
      )}
    </div>
  );
}