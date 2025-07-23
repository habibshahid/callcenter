// components/AutoCallNotesWrapper.js
import React, { useState, useEffect } from 'react';
import { useCall } from '../context/CallContext';
import CallNotesPanel from './CallNotesPanel';

export default function AutoCallNotesWrapper({ children }) {
  const { activeCall } = useCall();
  const [showCallNotes, setShowCallNotes] = useState(false);
  const [callContactId, setCallContactId] = useState(null);
  
  // Modules where CallNotesPanel should NEVER show (because they have their own implementation)
  const excludedModules = ['inbox'];
  
  // Get current module from URL
  const getCurrentModule = () => {
    const path = window.location.pathname.toLowerCase();
    const segments = path.split('/').filter(Boolean);
    return segments[0] || 'dashboard';
  };
  
  useEffect(() => {
    const currentModule = getCurrentModule();
    const isExcludedModule = excludedModules.some(module => 
      currentModule.includes(module)
    );
    
    // Show notes panel when there's an active call and we're not in excluded modules (like inbox)
    if (activeCall && activeCall.status === 'active' && !isExcludedModule) {
      // Only show if we have a valid contact ID (not 'active-call')
      if (activeCall.contactId && activeCall.contactId !== 'active-call') {
        setShowCallNotes(true);
        setCallContactId(activeCall.contactId);
      } else {
        // Log warning but don't show panel for unknown contacts
        console.warn('Active call without valid contact ID:', activeCall);
        setShowCallNotes(false);
        setCallContactId(null);
      }
    } else if (!activeCall || ['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(activeCall?.status)) {
      // Hide panel when call ends
      setShowCallNotes(false);
      setCallContactId(null);
    }
  }, [activeCall]);

  return (
    <>
      {children}
      {showCallNotes && callContactId && callContactId !== 'active-call' && (
        <CallNotesPanel 
          contactId={callContactId}
          onClose={() => {
            setShowCallNotes(false);
            setCallContactId(null);
          }}
        />
      )}
    </>
  );
}