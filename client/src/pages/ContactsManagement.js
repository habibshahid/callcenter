// client/src/pages/ContactsManagement.js - Updated section with proper imports
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Upload, Download, Phone, Mail, Filter, Plus, Edit, 
  Eye, ChevronLeft, ChevronRight, Users, CheckCircle, AlertCircle,
  Trash2, UserCheck, Tag, RefreshCw, FileSpreadsheet, Save, Database, X
} from 'lucide-react';
import { api } from '../services/api';
import { useCall } from '../context/CallContext'; // ADD THIS IMPORT
import { debounce } from 'lodash';
import EnhancedImportModal from '../components/EnhancedImportModal';
import DuplicateManager from '../components/DuplicateManager';
import AddContactModal from '../components/AddContactModal';
import EditContactModal from '../components/EditContactModal';
import ViewContactModal from '../components/ViewContactModal';
import CustomFieldsSearchModal from '../components/CustomFieldsSearchModal';
import CustomFieldsDisplay from '../components/CustomFieldsDisplay';
import '../styles/ContactsManagement.css';

export default function ContactsManagement() {
  // Get activeCall and handleDial from CallContext
  const { handleDial, activeCall } = useCall(); // ADD THIS LINE
  
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
  
  // Column filters state
  const [columnFilters, setColumnFilters] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    last_contact: ''
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedContactForEdit, setSelectedContactForEdit] = useState(null);
  const [selectedContactIdForView, setSelectedContactIdForView] = useState(null);
  
  // Custom fields search state
  const [showCustomFieldsSearch, setShowCustomFieldsSearch] = useState(false);
  const [customFieldsSearchActive, setCustomFieldsSearchActive] = useState(false);
  const [customFieldsFilters, setCustomFieldsFilters] = useState(null);

  // ADD THESE NEW STATE VARIABLES FOR CALL TRACKING
  const [callingNumbers, setCallingNumbers] = useState(new Set());

  // ADD THIS EFFECT TO TRACK ACTIVE CALLS
  useEffect(() => {
    if (activeCall) {
      // Clear callingNumbers when call connects
      if (activeCall.status !== 'trying' && activeCall.status !== 'connecting') {
        setCallingNumbers(new Set());
      }
      
      if (['Terminated', 'terminated', 'failed', 'rejected', 'Failed', 'Rejected'].includes(activeCall.status)) {
        // Call ended - ensure callingNumbers is cleared
        setCallingNumbers(new Set());
      }
    } else {
      // No active call - clear everything
      setCallingNumbers(new Set());
    }
  }, [activeCall]);

  // Load initial data
  useEffect(() => {
    loadCampaigns();
    loadAgents();
    loadSavedFilters();
  }, []);

  // Load contacts when filters change
  useEffect(() => {
    if (!customFieldsSearchActive) {
      loadContacts();
    }
  }, [selectedCampaign, filters.status, filters.assigned_to, pagination.page]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (!customFieldsSearchActive) {
        loadContacts(query);
      }
    }, 300),
    [selectedCampaign, filters, customFieldsSearchActive]
  );

  useEffect(() => {
    if (searchQuery && !customFieldsSearchActive) {
      debouncedSearch(searchQuery);
    } else if (!searchQuery && !customFieldsSearchActive) {
      loadContacts();
    }
  }, [searchQuery]);

  // Debounced column filters
  const debouncedColumnFilter = useCallback(
    debounce((filterValues) => {
      if (customFieldsSearchActive) {
        loadContactsWithCustomFields();
      } else {
        loadContacts(searchQuery, filterValues);
      }
    }, 300),
    [searchQuery, customFieldsSearchActive, customFieldsFilters]
  );

  useEffect(() => {
    debouncedColumnFilter(columnFilters);
  }, [columnFilters]);

  // Load contacts with custom fields search when pagination changes
  useEffect(() => {
    if (customFieldsSearchActive && customFieldsFilters) {
      loadContactsWithCustomFields();
    }
  }, [pagination.page]);

  const handleCustomFieldsSearch = async (searchParams) => {
    try {
      setLoading(true);
      setCustomFieldsSearchActive(true);
      setCustomFieldsFilters(searchParams);
      setPagination({ ...pagination, page: 1 });

      const response = await api.searchContactsByCustomFields({
        ...searchParams,
        page: 1,
        limit: pagination.limit,
        include_standard_filters: {
          status: filters.status,
          assigned_to: filters.assigned_to
        },
        column_filters: columnFilters
      });

      setContacts(response.contacts);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Custom fields search error:', error);
      alert('Error searching custom fields');
    } finally {
      setLoading(false);
    }
  };

  const clearCustomFieldsSearch = () => {
    setCustomFieldsSearchActive(false);
    setCustomFieldsFilters(null);
    loadContacts();
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setColumnFilters({
      name: '',
      phone: '',
      email: '',
      company: '',
      last_contact: ''
    });
    setFilters({
      status: '',
      assigned_to: ''
    });
    if (customFieldsSearchActive) {
      clearCustomFieldsSearch();
    }
  };

  const loadContactsWithCustomFields = async () => {
    if (!customFieldsFilters) return;

    try {
      setLoading(true);
      const response = await api.searchContactsByCustomFields({
        ...customFieldsFilters,
        page: pagination.page,
        limit: pagination.limit,
        include_standard_filters: {
          status: filters.status,
          assigned_to: filters.assigned_to
        },
        column_filters: columnFilters
      });

      setContacts(response.contacts);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading custom fields search results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContact = (contactId) => {
    setSelectedContactIdForView(contactId);
    setShowViewModal(true);
  };

  const handleEditContact = (contact) => {
    setSelectedContactForEdit(contact);
    setShowEditModal(true);
  };

  const handleAddSuccess = () => {
    if (customFieldsSearchActive) {
      loadContactsWithCustomFields();
    } else {
      loadContacts();
    }
    alert('Contact added successfully!');
  };

  const handleEditSuccess = () => {
    if (customFieldsSearchActive) {
      loadContactsWithCustomFields();
    } else {
      loadContacts();
    }
    alert('Contact updated successfully!');
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      await api.deleteContact(contactId);
      if (customFieldsSearchActive) {
        loadContactsWithCustomFields();
      } else {
        loadContacts();
      }
      alert('Contact deleted successfully');
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Error deleting contact');
    }
  };

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

  const loadContacts = async (search = searchQuery, colFilters = columnFilters) => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        campaign_id: selectedCampaign,
        ...(filters.status && { status: filters.status }),
        ...(filters.assigned_to && { assigned_to: filters.assigned_to }),
        ...(search && { search }),
        // Add column filters
        ...(colFilters.name && { filter_name: colFilters.name }),
        ...(colFilters.phone && { filter_phone: colFilters.phone }),
        ...(colFilters.email && { filter_email: colFilters.email }),
        ...(colFilters.company && { filter_company: colFilters.company }),
        ...(colFilters.last_contact && { filter_last_contact: colFilters.last_contact })
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
        search: searchQuery,
        columnFilters: columnFilters,
        isCustomFields: customFieldsSearchActive,
        customFieldsFilters: customFieldsFilters
      };
      const updated = [...savedFilters, newFilter];
      setSavedFilters(updated);
      localStorage.setItem('contactFilters', JSON.stringify(updated));
    }
  };

  const loadSavedFilter = (filter) => {
    if (filter.isCustomFields && filter.customFieldsFilters) {
      setSelectedCampaign(filter.campaign_id);
      setColumnFilters(filter.columnFilters || {
        name: '',
        phone: '',
        email: '',
        company: '',
        last_contact: ''
      });
      handleCustomFieldsSearch(filter.customFieldsFilters);
    } else {
      setSelectedCampaign(filter.campaign_id);
      setFilters({
        status: filter.status || '',
        assigned_to: filter.assigned_to || ''
      });
      setSearchQuery(filter.search || '');
      setColumnFilters(filter.columnFilters || {
        name: '',
        phone: '',
        email: '',
        company: '',
        last_contact: ''
      });
      setCustomFieldsSearchActive(false);
    }
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
            if (customFieldsSearchActive) {
              loadContactsWithCustomFields();
            } else {
              loadContacts();
            }
          }
          break;

        case 'assign':
          const assignTo = prompt('Enter agent ID to assign to:');
          if (assignTo) {
            await api.bulkAssignContacts(contactIds, assignTo);
            setSelectedContacts(new Set());
            if (customFieldsSearchActive) {
              loadContactsWithCustomFields();
            } else {
              loadContacts();
            }
          }
          break;

        case 'status':
          const newStatus = prompt('Enter new status (new/contacted/interested/not_interested/do_not_call):');
          if (newStatus) {
            await api.bulkUpdateContacts(contactIds, { status: newStatus });
            setSelectedContacts(new Set());
            if (customFieldsSearchActive) {
              loadContactsWithCustomFields();
            } else {
              loadContacts();
            }
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

  // UPDATED handleCall function
  const handleCall = async (phoneNumber, contactId) => {
    // Check if any call is in progress
    if (activeCall && !['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(activeCall.status)) {
      alert('A call is already in progress. Please end the current call first.');
      return;
    }

    // Check if this number is already being dialed
    if (callingNumbers.has(phoneNumber)) {
      return;
    }

    try {
      // Add to calling numbers set
      setCallingNumbers(prev => new Set([...prev, phoneNumber]));
      
      // Pass contactId to handleDial
      await handleDial(phoneNumber, contactId);
    } catch (error) {
      console.error('Error making call:', error);
      alert(`Failed to call ${phoneNumber}`);
      // Remove from calling numbers on error
      setCallingNumbers(prev => {
        const newSet = new Set(prev);
        newSet.delete(phoneNumber);
        return newSet;
      });
    }
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

  const updateColumnFilter = (column, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
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

  // Check if any filters are active
  const hasActiveFilters = () => {
    return searchQuery || 
           filters.status || 
           filters.assigned_to || 
           Object.values(columnFilters).some(v => v) || 
           customFieldsSearchActive;
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
            <button 
              className="btn btn-outline-primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={18} className="me-2" />
              Add Contact
            </button>
          </div>
        </div>
      </div>

      {/* ADD THIS: Call status indicator */}
      {(activeCall && !['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected', 'active'].includes(activeCall.status)) && (
        <div className="position-fixed top-0 start-50 translate-middle-x mt-5 pt-3" style={{ zIndex: 1050 }}>
          <div className="alert alert-warning d-flex align-items-center shadow">
            <div className="spinner-border spinner-border-sm me-2" />
            <span>
              Call in progress with {activeCall.number}
              {activeCall.status === 'trying' && ' - Connecting...'}
              {activeCall.status === 'connecting' && ' - Establishing connection...'}
              {activeCall.status === 'ringing' && ' - Ringing...'}
            </span>
          </div>
        </div>
      )}

      {/* Custom Fields Search Indicator */}
      {customFieldsSearchActive && (
        <div className="alert alert-warning custom-fields-active d-flex justify-content-between align-items-center mb-3">
          <div>
            <Database size={18} className="me-2" />
            <strong>Custom Fields Search Active</strong> - Showing filtered results based on custom data
          </div>
          <button 
            className="btn btn-sm btn-outline-dark"
            onClick={clearCustomFieldsSearch}
          >
            Clear Custom Search
          </button>
        </div>
      )}

      {/* Filters Row */}
      <div className="row mb-3">
        <div className="col-md-2">
          <select 
            className="form-select"
            value={selectedCampaign}
            onChange={(e) => {
              setSelectedCampaign(e.target.value);
              if (customFieldsSearchActive) clearCustomFieldsSearch();
            }}
            disabled={customFieldsSearchActive}
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
            onChange={(e) => {
              setFilters({...filters, status: e.target.value});
              if (customFieldsSearchActive) {
                loadContactsWithCustomFields();
              }
            }}
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
            onChange={(e) => {
              setFilters({...filters, assigned_to: e.target.value});
              if (customFieldsSearchActive) {
                loadContactsWithCustomFields();
              }
            }}
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (customFieldsSearchActive) clearCustomFieldsSearch();
              }}
              disabled={customFieldsSearchActive}
            />
            <button 
              className="btn btn-primary btn-custom-fields"
              onClick={() => setShowCustomFieldsSearch(true)}
              title="Search Custom Fields"
              disabled={!selectedCampaign}
            >
              <Database size={18} className="me-1" />
              Custom Fields
            </button>
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

      {/* Clear All Filters Button */}
      {hasActiveFilters() && (
        <div className="row mb-3">
          <div className="col text-end">
            <button 
              className="btn btn-sm btn-outline-danger"
              onClick={clearAllFilters}
            >
              <X size={16} className="me-1" />
              Clear All Filters
            </button>
          </div>
        </div>
      )}

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
                      {filter.isCustomFields && <Database size={14} className="ms-1" />}
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
                if (customFieldsSearchActive) {
                  loadContactsWithCustomFields();
                } else {
                  loadContacts();
                }
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
                <th>
                  Name
                  <input
                    type="text"
                    className="form-control form-control-sm mt-1"
                    placeholder="Filter name..."
                    value={columnFilters.name}
                    onChange={(e) => updateColumnFilter('name', e.target.value)}
                  />
                </th>
                <th>
                  Phone
                  <input
                    type="text"
                    className="form-control form-control-sm mt-1"
                    placeholder="Filter phone..."
                    value={columnFilters.phone}
                    onChange={(e) => updateColumnFilter('phone', e.target.value)}
                  />
                </th>
                <th>
                  Email
                  <input
                    type="text"
                    className="form-control form-control-sm mt-1"
                    placeholder="Filter email..."
                    value={columnFilters.email}
                    onChange={(e) => updateColumnFilter('email', e.target.value)}
                  />
                </th>
                <th>
                  Company
                  <input
                    type="text"
                    className="form-control form-control-sm mt-1"
                    placeholder="Filter company..."
                    value={columnFilters.company}
                    onChange={(e) => updateColumnFilter('company', e.target.value)}
                  />
                </th>
                <th>Status</th>
                <th>
                  Last Contact
                  <input
                    type="date"
                    className="form-control form-control-sm mt-1"
                    value={columnFilters.last_contact}
                    onChange={(e) => updateColumnFilter('last_contact', e.target.value)}
                  />
                </th>
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
                contacts.map(contact => {
                  const hasCustomData = contact.custom_data && Object.keys(contact.custom_data).length > 0;
                  const hasMatchedFields = contact.matched_custom_fields && contact.matched_custom_fields.length > 0;
                  
                  return (
                    <tr 
                      key={contact.id} 
                      className={`
                        ${selectedContacts.has(contact.id) ? 'table-active' : ''}
                        ${hasMatchedFields ? 'has-custom-match' : ''}
                      `}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                        />
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <div className="fw-medium">
                            {contact.first_name || contact.last_name ? 
                              `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
                              <span className="text-muted">No name</span>
                            }
                          </div>
                          
                          {/* Show custom fields when custom search is active */}
                          {customFieldsSearchActive && hasCustomData && (
                            <div className="mt-1">
                              <CustomFieldsDisplay
                                customData={contact.custom_data}
                                matchedFields={contact.matched_custom_fields || []}
                                displayMode="inline"
                                maxFields={3}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <a 
                          href="#" 
                          className="text-decoration-none"
                          onClick={(e) => {
                            e.preventDefault();
                            handleCall(contact.phone_primary, contact.id);
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
                      <td>
                        {contact.company || <span className="text-muted">-</span>}
                        
                        {/* Show custom data count if not in custom search mode */}
                        {!customFieldsSearchActive && hasCustomData && (
                          <div>
                            <small className="text-muted">
                              <Database size={12} className="me-1" />
                              {Object.keys(contact.custom_data).length} fields
                            </small>
                          </div>
                        )}
                      </td>
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
                        {/* UPDATED ACTIONS TD */}
                        <div className="btn-group btn-group-sm">
                          <button 
                            className="btn btn-outline-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewContact(contact.id);
                            }}
                            title="View full contact details"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            className="btn btn-outline-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditContact(contact);
                            }}
                            title="Edit contact information"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            className="btn btn-outline-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteContact(contact.id);
                            }}
                            title="Delete this contact"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button 
                            className={`btn ${
                              callingNumbers.has(contact.phone_primary) 
                                ? 'btn-warning' 
                                : activeCall && !['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(activeCall.status)
                                  ? 'btn-secondary'
                                  : 'btn-outline-primary'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCall(contact.phone_primary, contact.id);
                            }}
                            disabled={
                              callingNumbers.has(contact.phone_primary) ||
                              (activeCall && !['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(activeCall.status))
                            }
                            title={
                              callingNumbers.has(contact.phone_primary) 
                                ? 'Calling...' 
                                : activeCall && !['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(activeCall.status)
                                  ? 'Call in progress'
                                  : 'Call this contact'
                            }
                          >
                            {callingNumbers.has(contact.phone_primary) ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1" />
                                <Phone size={14} />
                              </>
                            ) : (
                              <Phone size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Modals */}
      {showImportModal && (
        <EnhancedImportModal
          campaigns={campaigns}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            setShowImportModal(false);
            if (customFieldsSearchActive) {
              loadContactsWithCustomFields();
            } else {
              loadContacts();
            }
          }}
        />
      )}
      
      {showDuplicateManager && (
        <DuplicateManager
          campaignId={selectedCampaign}
          onClose={() => setShowDuplicateManager(false)}
        />
      )}
      
      {showAddModal && (
        <AddContactModal
          campaigns={campaigns}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {showEditModal && selectedContactForEdit && (
        <EditContactModal
          contact={selectedContactForEdit}
          campaigns={campaigns}
          onClose={() => {
            setShowEditModal(false);
            setSelectedContactForEdit(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {showViewModal && selectedContactIdForView && (
        <ViewContactModal
          contactId={selectedContactIdForView}
          onClose={() => {
            setShowViewModal(false);
            setSelectedContactIdForView(null);
          }}
          onEdit={(contact) => {
            setShowViewModal(false);
            setSelectedContactIdForView(null);
            handleEditContact(contact);
          }}
        />
      )}

      {/* Custom Fields Search Modal */}
      {showCustomFieldsSearch && (
        <CustomFieldsSearchModal
          campaignId={selectedCampaign}
          onClose={() => setShowCustomFieldsSearch(false)}
          onSearch={handleCustomFieldsSearch}
        />
      )}
    </div>
  );
}