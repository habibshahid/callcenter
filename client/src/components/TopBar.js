// src/components/TopBar.js
import React, { useState, useEffect } from 'react';
import { Bell, User, ChevronDown, Settings, Info, LogOut, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import CallControls from './CallControls';
import { useCall } from '../context/CallContext';

export default function TopBar() {
  const navigate = useNavigate();
  const { handleLogout: logout } = useApp();
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

  // Local state
  const [breaks, setBreaks] = useState([]);
  //const [currentStatus, setCurrentStatus] = useState('Available');
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Off-Queue');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    loadUserData();
    loadBreaks();
    loadCurrentStatus(); 
    // Set initial status to Off-Queue
    //handleStatusChange('Off-Queue');
  }, []);

  const loadCurrentStatus = async () => {
    try {
      const statusData = await api.getUserStatus();
      setCurrentStatus(statusData.current_status || 'Off-Queue');
    } catch (error) {
      console.error('Error loading current status:', error);
      setCurrentStatus('Off-Queue'); // Default to Off-Queue
    }
  };

  const loadUserData = async () => {
    try {
      const userData = await api.getUserProfile();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadBreaks = async () => {
    try {
      const breaksData = await api.getBreaks();
      setBreaks(breaksData);
    } catch (error) {
      console.error('Error loading breaks:', error);
    }
  };

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

  /*const handleStatusChange = async (status) => {
    setCurrentStatus(status);
    setShowStatusDropdown(false);
  };*/
  
  // Update handleStatusChange to use both APIs
  const handleStatusChange = async (status, breakId = null) => {
    try {
      setIsStatusChanging(true); // Start loading
      
      console.log('Updating status:', { status, breakId });
      
      const payload = {
        status,
        ...(breakId && { breakId })  // Only add breakId if it exists
      };

      console.log('Sending payload:', payload);
      
      const response = await api.updateAgentStatus(payload);

      if (response.success) {
        setCurrentStatus(status);
        setShowStatusDropdown(false);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsStatusChanging(false); // End loading regardless of success/failure
    }
  }; 

  return (
    <div className="bg-white border-bottom">
      <div className="d-flex justify-content-between align-items-center px-4 py-2">
        <div className="d-flex align-items-center">
          <h5 className="mb-0 me-4">Contact Center</h5>
          
          {/* Agent Presence Dropdown */}
          <div className="position-relative me-4">
            <button 
              className="btn btn-light d-flex align-items-center gap-2"
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              disabled={isStatusChanging}
            >
              <div 
                className={`rounded-circle ${
                  currentStatus === 'Ready' 
                    ? 'bg-success' 
                    : currentStatus === 'Off-Queue' 
                      ? 'bg-danger' 
                      : 'bg-warning'
                }`}
                style={{ width: '10px', height: '10px' }}
              ></div>
              {isStatusChanging ? (
                <span className="d-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Updating...
                </span>
              ) : (
                <>
                  {currentStatus}
                  <ChevronDown size={16} />
                </>
              )}
            </button>
            
            {showStatusDropdown && !isStatusChanging && (
              <div className="position-absolute top-100 start-0 mt-1 bg-white border rounded shadow-sm" 
                   style={{ width: '200px', zIndex: 1000 }}>
                <div className="py-1">
                  <button 
                    className="dropdown-item d-flex align-items-center gap-2"
                    onClick={() => handleStatusChange('Ready')}
                    disabled={isStatusChanging}
                  >
                    <div className="rounded-circle bg-success" style={{ width: '10px', height: '10px' }}></div>
                    Ready
                  </button>
                  {breaks.map(breakItem => (
                    <button 
                      key={breakItem.id}
                      className="dropdown-item d-flex align-items-center gap-2"
                      onClick={() => handleStatusChange(breakItem.name, breakItem.id)}
                      disabled={isStatusChanging}
                    >
                      <div className="rounded-circle bg-warning" style={{ width: '10px', height: '10px' }}></div>
                      {breakItem.name}
                      {breakItem.duration_minutes && ` (${breakItem.duration_minutes} min)`}
                    </button>
                  ))}
                  <button 
                    className="dropdown-item d-flex align-items-center gap-2"
                    onClick={() => handleStatusChange('Off-Queue')}
                    disabled={isStatusChanging}
                  >
                    <div className="rounded-circle bg-danger" style={{ width: '10px', height: '10px' }}></div>
                    Off-Queue
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Call Controls */}
          <CallControls 
            activeCall={activeCall}
            callDuration={callDuration}
            onMute={handleMuteCall}
            onHold={handleHoldCall}
            onEnd={handleEndCall}
            onAnswer={handleAnswerCall}
            onReject={handleRejectCall}
            onDial={handleDial}
          />
        </div>

        {/* Notifications and User Menu */}
        <div className="d-flex align-items-center gap-3">
          {/* Notifications */}
          <div className="position-relative">
            <button 
              className="btn btn-light position-relative"
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
              <div className="position-absolute end-0 mt-2 bg-white border rounded shadow-sm" 
                   style={{ width: '300px', zIndex: 1000 }}>
                <div className="p-2 border-bottom">
                  <h6 className="mb-0">Notifications</h6>
                </div>
                <div className="py-2 text-muted text-center">
                  No notifications
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="position-relative">
            <button 
              className="btn btn-light d-flex align-items-center gap-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <User size={18} />
              <span>{user?.username || 'Profile'}</span>
              <ChevronDown size={16} />
            </button>

            {showUserMenu && (
              <div className="position-absolute end-0 mt-2 bg-white border rounded shadow-sm" 
                   style={{ width: '220px', zIndex: 1000 }}>
                <div className="py-1">
                  <button 
                    className="dropdown-item d-flex align-items-center gap-2"
                    onClick={() => navigate('/change-password')}
                  >
                    <Key size={16} />
                    Change Password
                  </button>
                  
                  <button 
                    onClick={onLogoutClick}
                    disabled={isLoggingOut}
                    className="dropdown-item d-flex align-items-center gap-2 text-danger"
                  >
                    <LogOut size={16} />
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}