// client/src/context/UserDataContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const UserDataContext = createContext(null);

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
};

export const UserDataProvider = ({ children }) => {
  const [userData, setUserData] = useState({
    profile: null,
    permissions: null,
    settings: null,
    breaks: [],
    status: null,
    loading: true,
    error: null
  });

  // Track if data has been loaded to prevent duplicate calls
  const [dataLoaded, setDataLoaded] = useState({
    profile: false,
    permissions: false,
    settings: false,
    breaks: false,
    status: false
  });

  // Load all user data once
  const loadAllUserData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setUserData(prev => ({ ...prev, loading: true, error: null }));

      // Use Promise.all to load data in parallel
      const [profile, permissions, settings, breaks, status] = await Promise.all([
        !dataLoaded.profile ? api.getUserProfile() : Promise.resolve(userData.profile),
        !dataLoaded.permissions ? api.getPermissions() : Promise.resolve(userData.permissions),
        !dataLoaded.settings ? api.getUserSettings().catch(() => null) : Promise.resolve(userData.settings),
        !dataLoaded.breaks ? api.getBreaks() : Promise.resolve(userData.breaks),
        !dataLoaded.status ? api.getUserStatus() : Promise.resolve(userData.status)
      ]);

      setUserData({
        profile,
        permissions,
        settings,
        breaks,
        status,
        loading: false,
        error: null
      });

      setDataLoaded({
        profile: true,
        permissions: true,
        settings: true,
        breaks: true,
        status: true
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  }, [dataLoaded, userData]);

  // Individual update functions
  const updateProfile = useCallback(async (profileData) => {
    try {
      const updatedProfile = await api.updateProfile(profileData);
      setUserData(prev => ({ ...prev, profile: updatedProfile }));
      return updatedProfile;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, []);

  const updateStatus = useCallback(async (status, breakId = null) => {
    try {
      await api.updateUserStatus({ status, breakId });
      setUserData(prev => ({
        ...prev,
        status: { ...prev.status, current_status: status, current_break_id: breakId }
      }));
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    try {
      const permissions = await api.getPermissions();
      setUserData(prev => ({ ...prev, permissions }));
      return permissions;
    } catch (error) {
      console.error('Error refreshing permissions:', error);
      throw error;
    }
  }, []);

  // Clear data on logout
  const clearUserData = useCallback(() => {
    setUserData({
      profile: null,
      permissions: null,
      settings: null,
      breaks: [],
      status: null,
      loading: false,
      error: null
    });
    setDataLoaded({
      profile: false,
      permissions: false,
      settings: false,
      breaks: false,
      status: false
    });
  }, []);

  // Load data on mount only if not already loaded
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !dataLoaded.profile) {
      loadAllUserData();
    }
  }, []);

  const value = {
    ...userData,
    loadAllUserData,
    updateProfile,
    updateStatus,
    refreshPermissions,
    clearUserData
  };

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
};