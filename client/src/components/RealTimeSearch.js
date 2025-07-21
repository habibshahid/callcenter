// src/components/RealTimeSearch.js
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Phone, Mail, Building, User, X } from 'lucide-react';
import { debounce } from 'lodash';
import { api } from '../services/api';
import { useCall } from '../context/CallContext';

export default function RealTimeSearch({ 
  onSelectContact, 
  placeholder = "Search contacts by name, phone, email...",
  showInDropdown = false,
  autoFocus = false,
  onClose
}) {
  const { handleDial } = useCall();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  // Debounced search function
  const performSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchResults = await api.searchContacts(searchQuery, null, 10);
        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  const handleSelectContact = (contact) => {
    if (onSelectContact) {
      onSelectContact(contact);
    }
    setQuery('');
    setResults([]);
    setFocused(false);
  };

  const handleCall = (e, phoneNumber) => {
    e.stopPropagation();
    handleDial(phoneNumber);
    if (onClose) onClose();
  };

  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={index} className="bg-warning">{part}</mark> 
        : part
    );
  };

  const containerClass = showInDropdown 
    ? "real-time-search-dropdown" 
    : "real-time-search-container";

  return (
    <div className={containerClass}>
      <div className="position-relative">
        <div className="input-group">
          <span className="input-group-text bg-white">
            <Search size={18} />
          </span>
          <input
            type="text"
            className="form-control border-start-0"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            autoFocus={autoFocus}
          />
          {query && (
            <button 
              className="btn btn-link"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {focused && (query || loading) && (
          <div className="search-results-dropdown position-absolute w-100 mt-1 bg-white border rounded shadow-lg" 
               style={{ maxHeight: '400px', overflowY: 'auto', zIndex: 1050 }}>
            
            {loading && (
              <div className="p-3 text-center">
                <div className="spinner-border spinner-border-sm" />
                <span className="ms-2">Searching...</span>
              </div>
            )}

            {!loading && results.length === 0 && query.length >= 2 && (
              <div className="p-3 text-center text-muted">
                No contacts found for "{query}"
              </div>
            )}

            {!loading && results.map(contact => (
              <div
                key={contact.id}
                className="search-result-item p-3 border-bottom cursor-pointer hover-bg-light"
                onClick={() => handleSelectContact(contact)}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center mb-1">
                      <User size={16} className="text-muted me-2" />
                      <strong>
                        {highlightMatch(contact.display_name || `${contact.first_name} ${contact.last_name}`.trim(), query)}
                      </strong>
                    </div>
                    
                    <div className="small">
                      {contact.phone_display && (
                        <div className="d-flex align-items-center text-muted mb-1">
                          <Phone size={14} className="me-2" />
                          {highlightMatch(contact.phone_display, query)}
                        </div>
                      )}
                      
                      {contact.email && (
                        <div className="d-flex align-items-center text-muted mb-1">
                          <Mail size={14} className="me-2" />
                          {highlightMatch(contact.email, query)}
                        </div>
                      )}
                      
                      {contact.company && (
                        <div className="d-flex align-items-center text-muted">
                          <Building size={14} className="me-2" />
                          {highlightMatch(contact.company, query)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    className="btn btn-sm btn-outline-primary ms-2"
                    onClick={(e) => handleCall(e, contact.phone_primary)}
                    title="Call this contact"
                  >
                    <Phone size={16} />
                  </button>
                </div>
              </div>
            ))}

            {/* Quick dial option for phone numbers */}
            {!loading && /^[\d\s\-\(\)\+]+$/.test(query) && query.length >= 3 && (
              <div 
                className="p-3 border-top bg-light cursor-pointer"
                onClick={() => {
                  handleDial(query);
                  setQuery('');
                  if (onClose) onClose();
                }}
              >
                <div className="d-flex align-items-center text-primary">
                  <Phone size={18} className="me-2" />
                  <span>Call {query}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// CSS to be added to a global stylesheet or as styled-components
const searchStyles = `
.real-time-search-container {
  width: 100%;
  max-width: 500px;
}

.real-time-search-dropdown {
  width: 100%;
}

.search-results-dropdown {
  max-height: 400px;
  overflow-y: auto;
}

.search-result-item {
  transition: background-color 0.2s;
}

.search-result-item:hover {
  background-color: #f8f9fa;
}

.hover-bg-light:hover {
  background-color: #f8f9fa;
}

mark {
  padding: 0;
  background-color: #fff3cd;
  font-weight: 500;
}
`;