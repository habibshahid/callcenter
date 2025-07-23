// client/src/components/TopBar.js - Updated to use UserDataContext
import React, { useState, useEffect } from 'react';
import { Bell, User, ChevronDown, Settings, Info, LogOut, Key, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useUserData } from '../context/UserDataContext';
import CallControls from './CallControls';
import RealTimeSearch from './RealTimeSearch';
import { useCall } from '../context/CallContext';

export default function TopBar() {
  const navigate = useNavigate();
  const { handleLogout: logout } = useApp();
  const { 
    profile: user,
    breaks,
    status,
    updateStatus
  } = useUserData();
  
  const { 
    activeCall, 
    callDuration, 
    handleMuteCall, 
    handleHoldCall, 
    handleEndCall, 
    handleAnswerCall, 
    handleRejectCall,
    handleDial 
  } = useCall();

  // Local state - only for UI state, not data
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications] = useState([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get current status from context
  const currentStatus = status?.current_status || 'Off-Queue';

  const onLogoutClick = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      const success = await logout();
      if (success) {
        navigate('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleStatusChange = async (newStatus, breakId = null) => {
    try {
      setIsStatusChanging(true);
      
      console.log('Updating status:', { status: newStatus, breakId });
      
      // Use the context function to update status
      await updateStatus(newStatus, breakId);
      
      setShowStatusDropdown(false);
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Failed to change status. Please try again.');
    } finally {
      setIsStatusChanging(false);
    }
  };

  const handleBreakClick = (breakItem) => {
    handleStatusChange('On-Break', breakItem.id);
  };

  // Format call duration
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown')) {
        setShowStatusDropdown(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="bg-white shadow-sm px-4 py-2 d-flex align-items-center justify-content-between">
      {/* Left Section - Status and Call Controls */}
      <div className="d-flex align-items-center gap-3">
        {/* Status Dropdown */}
        <div className="dropdown">
          <button
            className={`btn btn-sm dropdown-toggle d-flex align-items-center gap-2 ${
              currentStatus === 'Available' ? 'btn-success' :
              currentStatus === 'On-Break' ? 'btn-warning' :
              'btn-secondary'
            }`}
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            disabled={isStatusChanging || !!activeCall}
          >
            <span className="status-indicator"></span>
            {isStatusChanging ? 'Updating...' : currentStatus}
            <ChevronDown size={16} />
          </button>

          {showStatusDropdown && (
            <div className="dropdown-menu show" style={{ minWidth: '200px' }}>
              <button
                className="dropdown-item"
                onClick={() => handleStatusChange('Available')}
                disabled={currentStatus === 'Available'}
              >
                <span className="status-dot bg-success me-2"></span>
                Available
              </button>
              <button
                className="dropdown-item"
                onClick={() => handleStatusChange('Off-Queue')}
                disabled={currentStatus === 'Off-Queue'}
              >
                <span className="status-dot bg-secondary me-2"></span>
                Off-Queue
              </button>
              <div className="dropdown-divider"></div>
              <h6 className="dropdown-header">Breaks</h6>
              {breaks.map(breakItem => (
                <button
                  key={breakItem.id}
                  className="dropdown-item"
                  onClick={() => handleBreakClick(breakItem)}
                >
                  <span className="status-dot bg-warning me-2"></span>
                  {breakItem.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Call Controls */}
        {activeCall && (
          <>
            <div className="vr mx-2"></div>
            <CallControls
              activeCall={activeCall}
              callDuration={callDuration}
              onMute={handleMuteCall}
              onHold={handleHoldCall}
              onEnd={handleEndCall}
              onAnswer={handleAnswerCall}
              onReject={handleRejectCall}
            />
          </>
        )}
      </div>

      {/* Right Section - Search, Notifications, User Menu */}
      <div className="d-flex align-items-center gap-3">
        {/* Global Search */}
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowSearch(true)}
        >
          <Search size={18} />
        </button>

        {/* Notifications */}
        <div className="dropdown">
          <button
            className="btn btn-sm btn-outline-secondary position-relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown-menu dropdown-menu-end show" style={{ width: '300px' }}>
              <h6 className="dropdown-header">Notifications</h6>
              {notifications.length === 0 ? (
                <div className="px-3 py-2 text-muted">No new notifications</div>
              ) : (
                notifications.map((notif, index) => (
                  <a key={index} className="dropdown-item" href="#">
                    <div className="d-flex">
                      <div className="flex-grow-1">
                        <div className="small text-muted">{notif.time}</div>
                        <div>{notif.message}</div>
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="dropdown">
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <User size={18} />
            <span>{user?.first_name || user?.username || 'User'}</span>
            <ChevronDown size={16} />
          </button>

          {showUserMenu && (
            <div className="dropdown-menu dropdown-menu-end show">
              <h6 className="dropdown-header">{user?.email}</h6>
              <div className="dropdown-divider"></div>
              <button 
                className="dropdown-item d-flex align-items-center gap-2"
                onClick={() => navigate('/change-password')}
              >
                <Key size={16} />
                Change Password
              </button>
              <button className="dropdown-item d-flex align-items-center gap-2">
                <Settings size={16} />
                Settings
              </button>
              <button className="dropdown-item d-flex align-items-center gap-2">
                <Info size={16} />
                About
              </button>
              <div className="dropdown-divider"></div>
              <button 
                className="dropdown-item d-flex align-items-center gap-2 text-danger"
                onClick={onLogoutClick}
                disabled={isLoggingOut}
              >
                <LogOut size={16} />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Search Modal */}
      {showSearch && (
        <RealTimeSearch onClose={() => setShowSearch(false)} onDial={handleDial} />
      )}
    </div>
  );
}