// client/src/pages/ContactsManagement.js - Complete Optimized Version
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Search, Upload, Download, Phone, Mail, Filter, Plus, Edit, 
  Eye, ChevronLeft, ChevronRight, Users, CheckCircle, AlertCircle,
  Trash2, UserCheck, Tag, RefreshCw, FileSpreadsheet, Save, Database, X
} from 'lucide-react';
import { api } from '../services/api';
import { useCall } from '../context/CallContext';
import { debounce } from 'lodash';
import EnhancedImportModal from '../components/EnhancedImportModal';
import DuplicateManager from '../components/DuplicateManager';
import AddContactModal from '../components/AddContactModal';
import EditContactModal from '../components/EditContactModal';
import ViewContactModal from '../components/ViewContactModal';
import CustomFieldsSearchModal from '../components/CustomFieldsSearchModal';
import CustomFieldsDisplay from '../components/CustomFieldsDisplay';
import '../styles/ContactsManagement.css';

// Cache for API responses
const apiCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

export default function ContactsManagement() {
  // Get handleDial and activeCall from CallContext
  const { handleDial, activeCall } = useCall();
  
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

  // Track calling numbers
  const [callingNumbers, setCallingNumbers] = useState(new Set());

  // Refs to prevent duplicate operations
  const isInitialMount = useRef(true);
  const loadContactsTimeoutRef = useRef(null);
  const hasLoadedInitialData = useRef(false);

  // Track active call status
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

  // Cached API call helper
  const cachedApiCall = useCallback(async (key, apiFunction, forceRefresh = false) => {
    const cached = apiCache.get(key);
    const now = Date.now();
    
    if (!forceRefresh && cached && (now - cached.timestamp < CACHE_DURATION)) {
      return cached.data;
    }
    
    const data = await apiFunction();
    apiCache.set(key, { data, timestamp: now });
    return data;
  }, []);

  // Load initial data - only once
  useEffect(() => {
    if (!hasLoadedInitialData.current) {
      hasLoadedInitialData.current = true;
      
      const loadInitialData = async () => {
        try {
          // Load campaigns and agents in parallel using cache
          const [campaignsData, agentsData] = await Promise.all([
            cachedApiCall('campaigns', api.getCampaigns),
            cachedApiCall('agents', api.getActiveAgents)
          ]);
          
          setCampaigns(campaignsData);
          setAgents(agentsData);
          
          if (campaignsData.length > 0 && !selectedCampaign) {
            setSelectedCampaign(campaignsData[0].id);
          }
          
          // Load saved filters from localStorage
          const saved = localStorage.getItem('contactFilters');
          if (saved) {
            setSavedFilters(JSON.parse(saved));
          }
        } catch (error) {
          console.error('Error loading initial data:', error);
        }
      };
      
      loadInitialData();
    }
  }, []); // Empty dependency array - runs only once

  // Create stable debounced load function
  const debouncedLoadContacts = useMemo(
    () => debounce(() => {
      if (!customFieldsSearchActive && selectedCampaign) {
        loadContacts();
      }
    }, 300),
    [] // No dependencies - stable reference
  );

  // Main load contacts function
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

  // Single useEffect for all filter changes
  useEffect(() => {
    // Skip initial mount to prevent duplicate loads
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (!customFieldsSearchActive && selectedCampaign) {
      // Cancel any pending load
      if (loadContactsTimeoutRef.current) {
        clearTimeout(loadContactsTimeoutRef.current);
      }
      
      // Debounce the load
      loadContactsTimeoutRef.current = setTimeout(() => {
        loadContacts();
      }, 300);
    }
    
    return () => {
      if (loadContactsTimeoutRef.current) {
        clearTimeout(loadContactsTimeoutRef.current);
      }
    };
  }, [selectedCampaign, filters.status, filters.assigned_to, searchQuery, columnFilters, pagination.page, customFieldsSearchActive]);

  // Load contacts with custom fields search when pagination changes
  useEffect(() => {
    if (customFieldsSearchActive && customFieldsFilters) {
      loadContactsWithCustomFields();
    }
  }, [pagination.page]);

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

  const getPhoneDisplay = (contact) => {
    const phoneNumber = contact.phone_primary || contact.phone;
    const isDialing = callingNumbers.has(phoneNumber);
    const isInCall = activeCall && 
      (activeCall.number === phoneNumber || activeCall.number === contact.phone_primary) &&
      !['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(activeCall.status);
    
    return { phoneNumber, isDialing, isInCall };
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Contacts Management</h2>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary"
            onClick={() => setShowCustomFieldsSearch(true)}
          >
            <Database size={18} className="me-2" />
            Advanced Search
          </button>
          <button 
            className="btn btn-outline-primary"
            onClick={() => setShowDuplicateManager(true)}
          >
            <Users size={18} className="me-2" />
            Find Duplicates
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} className="me-2" />
            Add Contact
          </button>
          <button 
            className="btn btn-success"
            onClick={() => setShowImportModal(true)}
          >
            <Upload size={18} className="me-2" />
            Import
          </button>
          <button 
            className="btn btn-info"
            onClick={() => handleExport()}
          >
            <Download size={18} className="me-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Campaign</label>
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
            <div className="col-md-3">
              <label className="form-label">Status</label>
              <select 
                className="form-select"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="not_interested">Not Interested</option>
                <option value="do_not_call">Do Not Call</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Assigned To</label>
              <select 
                className="form-select"
                value={filters.assigned_to}
                onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })}
              >
                <option value="">All Agents</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Search</label>
              <div className="input-group">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  className="btn btn-outline-secondary"
                  onClick={() => loadContacts()}
                >
                  <Search size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="d-flex gap-2">
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={clearAllFilters}
              >
                <X size={16} className="me-1" />
                Clear Filters
              </button>
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={saveCurrentFilter}
              >
                <Save size={16} className="me-1" />
                Save Filter
              </button>
              <div className="dropdown">
                <button 
                  className="btn btn-sm btn-outline-secondary dropdown-toggle"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                >
                  <Filter size={16} className="me-1" />
                  Saved Filters
                </button>
                {showFilterMenu && (
                  <div className="dropdown-menu show">
                    {savedFilters.length === 0 ? (
                      <span className="dropdown-item text-muted">No saved filters</span>
                    ) : (
                      savedFilters.map(filter => (
                        <button 
                          key={filter.id}
                          className="dropdown-item"
                          onClick={() => loadSavedFilter(filter)}
                        >
                          {filter.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Fields Search Active Indicator */}
            {customFieldsSearchActive && (
              <div className="alert alert-info mb-0 py-1 px-2 d-flex align-items-center">
                <Database size={16} className="me-2" />
                <span className="small">Custom fields search active</span>
                <button 
                  className="btn btn-sm btn-link p-0 ms-2"
                  onClick={clearCustomFieldsSearch}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedContacts.size > 0 && (
        <div className="card mb-3">
          <div className="card-body py-2">
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-primary">
                {selectedContacts.size} selected
              </span>
              <select 
                className="form-select form-select-sm w-auto"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="">Choose action...</option>
                <option value="assign">Assign to Agent</option>
                <option value="status">Change Status</option>
                <option value="export">Export Selected</option>
                <option value="delete">Delete</option>
              </select>
              <button 
                className="btn btn-sm btn-primary"
                onClick={handleBulkAction}
                disabled={!bulkAction}
              >
                Apply
              </button>
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSelectedContacts(new Set())}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input 
                      type="checkbox"
                      className="form-check-input"
                      checked={selectedContacts.size === contacts.length && contacts.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>
                    <div className="d-flex flex-column">
                      <span>Name</span>
                      <input 
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filter..."
                        value={columnFilters.name}
                        onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                      />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex flex-column">
                      <span>Phone</span>
                      <input 
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filter..."
                        value={columnFilters.phone}
                        onChange={(e) => setColumnFilters({ ...columnFilters, phone: e.target.value })}
                      />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex flex-column">
                      <span>Email</span>
                      <input 
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filter..."
                        value={columnFilters.email}
                        onChange={(e) => setColumnFilters({ ...columnFilters, email: e.target.value })}
                      />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex flex-column">
                      <span>Company</span>
                      <input 
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filter..."
                        value={columnFilters.company}
                        onChange={(e) => setColumnFilters({ ...columnFilters, company: e.target.value })}
                      />
                    </div>
                  </th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Tags</th>
                  <th>
                    <div className="d-flex flex-column">
                      <span>Last Contact</span>
                      <input 
                        type="date"
                        className="form-control form-control-sm mt-1"
                        value={columnFilters.last_contact}
                        onChange={(e) => setColumnFilters({ ...columnFilters, last_contact: e.target.value })}
                      />
                    </div>
                  </th>
                  <th>Custom Fields</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" className="text-center py-4">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-4 text-muted">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  contacts.map(contact => {
                    const { phoneNumber, isDialing, isInCall } = getPhoneDisplay(contact);
                    
                    return (
                      <tr key={contact.id}>
                        <td>
                          <input 
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedContacts.has(contact.id)}
                            onChange={() => handleSelectContact(contact.id)}
                          />
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="bg-primary rounded-circle p-2 text-white me-2" style={{ width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {contact.first_name ? contact.first_name.charAt(0).toUpperCase() : '#'}
                            </div>
                            <div>
                              <div className="fw-medium">
                                {contact.first_name} {contact.last_name}
                              </div>
                              {contact.interaction_count > 0 && (
                                <small className="text-muted">
                                  {contact.interaction_count} interactions
                                </small>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span>{phoneNumber}</span>
                          </div>
                        </td>
                        <td>
                          <a href={`mailto:${contact.email}`} className="text-decoration-none">
                            {contact.email}
                          </a>
                        </td>
                        <td>{contact.company}</td>
                        <td>
                          <span className={`badge bg-${
                            contact.status === 'new' ? 'primary' :
                            contact.status === 'contacted' ? 'info' :
                            contact.status === 'interested' ? 'success' :
                            contact.status === 'not_interested' ? 'warning' :
                            'danger'
                          }`}>
                            {contact.status}
                          </span>
                        </td>
                        <td>
                          {contact.assigned_to_name || '-'}
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap">
                            {contact.tags && contact.tags.slice(0, 2).map((tag, index) => (
                              <span key={index} className="badge bg-secondary" style={{ fontSize: '0.75rem' }}>
                                {tag}
                              </span>
                            ))}
                            {contact.tags && contact.tags.length > 2 && (
                              <span className="badge bg-secondary" style={{ fontSize: '0.75rem' }}>
                                +{contact.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {contact.last_contacted_at ? 
                            new Date(contact.last_contacted_at).toLocaleDateString() : 
                            '-'
                          }
                        </td>
                        <td>
                          {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 ? (
                            <CustomFieldsDisplay 
                              customFields={contact.custom_fields} 
                              maxDisplay={2} 
                            />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleViewContact(contact.id)}
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleEditContact(contact)}
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteContact(contact.id)}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button 
                              className={`btn btn-sm ${isInCall ? 'btn-danger' : isDialing ? 'btn-warning' : 'btn-success'}`}
                              onClick={() => handleCall(phoneNumber, contact.id)}
                              disabled={isDialing || (activeCall && !isInCall)}
                              title={isInCall ? 'In Call' : isDialing ? 'Dialing...' : 'Call'}
                            >
                              {isInCall ? (
                                <>
                                  <Phone size={14} className="me-1" />
                                  In Call
                                </>
                              ) : isDialing ? (
                                <>
                                  <div className="spinner-border spinner-border-sm me-1" role="status">
                                    <span className="visually-hidden">Dialing...</span>
                                  </div>
                                  Dialing
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
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="card-footer">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} contacts
              </div>
              <nav>
                <ul className="pagination mb-0">
                  <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                    <button 
                      className="page-link"
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </li>
                  {[...Array(Math.min(5, pagination.pages))].map((_, index) => {
                    const pageNum = index + 1;
                    return (
                      <li key={pageNum} className={`page-item ${pagination.page === pageNum ? 'active' : ''}`}>
                        <button 
                          className="page-link"
                          onClick={() => setPagination({ ...pagination, page: pageNum })}
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
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                      disabled={pagination.page === pagination.pages}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showImportModal && (
        <EnhancedImportModal
          show={showImportModal}
          onHide={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            loadContacts();
          }}
          campaignId={selectedCampaign}
        />
      )}

      {showDuplicateManager && selectedCampaign && (
        <DuplicateManager
          campaignId={selectedCampaign}
          onClose={() => {
            setShowDuplicateManager(false);
            loadContacts();
          }}
        />
      )}

      {showAddModal && (
        <AddContactModal
          show={showAddModal}
          onHide={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          campaignId={selectedCampaign}
          campaigns={campaigns}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showEditModal && selectedContactForEdit && (
        <EditContactModal
          show={showEditModal}
          onHide={() => {
            setShowEditModal(false);
            setSelectedContactForEdit(null);
          }}
          onSuccess={handleEditSuccess}
          contact={selectedContactForEdit}
          campaigns={campaigns}
          onClose={() => {
            setShowEditModal(false);
            setSelectedContactForEdit(null);
          }}
        />
      )}

      {showViewModal && selectedContactIdForView && (
        <ViewContactModal
          show={showViewModal}
          onHide={() => {
            setShowViewModal(false);
            setSelectedContactIdForView(null);
          }}
          contactId={selectedContactIdForView}
          onEdit={(contact) => {
            setShowViewModal(false);
            setSelectedContactIdForView(null);
            handleEditContact(contact);
          }}
          onClose={() => {
            setShowViewModal(false);
            setSelectedContactIdForView(null);
          }}
        />
      )}

      {showCustomFieldsSearch && selectedCampaign && (
        <CustomFieldsSearchModal
          show={showCustomFieldsSearch}
          onHide={() => setShowCustomFieldsSearch(false)}
          campaignId={selectedCampaign}
          onSearch={handleCustomFieldsSearch}
        />
      )}

      {/* Alert for no campaign selected */}
      {!selectedCampaign && !loading && (
        <div className="alert alert-warning mt-3">
          <AlertCircle size={20} className="me-2" />
          Please select a campaign to view contacts
        </div>
      )}
    </div>
  );
}