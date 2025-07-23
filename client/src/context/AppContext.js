// client/src/context/AppContext.js - Updated with UserData cleanup
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import SipService from '../services/SipService';
import { dedupApi } from '../utils/apiDeduplication';

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [sipStatus, setSipStatus] = useState('disconnected');
  const [isInitialized, setIsInitialized] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  const handleSipStatus = useCallback((status) => {
    setSipStatus(status);
    if (status === 'error') {
      setNeedsReload(true);
    }
  }, []);

  const initializeSip = useCallback(async () => {
    if (isInitialized) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setNeedsReload(false);
      console.log('Initializing SIP...');
      const sipConfig = await api.getSipConfig();
      await SipService.initialize(sipConfig);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing SIP:', error);
      setNeedsReload(true);
    }
  }, [isInitialized]);

  const handleLogout = useCallback(async () => {
    console.log('Starting logout process...');

    try {
      // First clean up SIP
      await SipService.cleanupConnection();
      
      // Clear deduplicated API cache
      dedupApi.clearAllCache();
      
      // Then call logout API
      try {
        await api.logout();
      } catch (error) {
        console.error('Error calling logout API:', error);
      }

      // Clear all local storage
      localStorage.clear();
      setIsInitialized(false);

      console.log('Logout completed successfully');
      return true;
    } catch (error) {
      console.error('Error during logout:', error);
      // Clean up anyway
      localStorage.clear();
      dedupApi.clearAllCache();
      setIsInitialized(false);
      return true;
    }
  }, []);

  useEffect(() => {
    SipService.addStatusListener(handleSipStatus);
    initializeSip();

    return () => {
      SipService.removeStatusListener(handleSipStatus);
    };
  }, [initializeSip, handleSipStatus]);

  const value = {
    sipStatus,
    initializeSip,
    handleLogout,
    needsReload
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {needsReload && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-4 p-3 bg-danger text-white rounded shadow-lg">
          <div className="d-flex align-items-center gap-2">
            <span>Connection lost. Unable to reconnect.</span>
            <button 
              className="btn btn-light btn-sm ms-3"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};