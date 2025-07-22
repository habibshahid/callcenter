// components/AutoCallNotesWrapper.js
import React, { useState, useEffect } from 'react';
import { useCall } from '../context/CallContext';
import CallNotesPanel from './CallNotesPanel';

export default function AutoCallNotesWrapper({ children, excludeModules = ['inbox'] }) {
  const { activeCall } = useCall();
  const [showCallNotes, setShowCallNotes] = useState(false);
  const [callContactId, setCallContactId] = useState(null);
  
  // Get current module from URL
  const currentModule = window.location.pathname.split('/')[1] || 'dashboard';
  const shouldShowNotes = !excludeModules.includes(currentModule);

  useEffect(() => {
    // Show notes panel when there's an active call and we're not in excluded modules
    if (activeCall && shouldShowNotes) {
      setShowCallNotes(true);
      setCallContactId(activeCall.contactId || 'active-call');
    } else if (!activeCall) {
      // Keep panel open for a bit after call ends to allow saving
      setTimeout(() => {
        setShowCallNotes(false);
        setCallContactId(null);
      }, 3000);
    }
  }, [activeCall, shouldShowNotes]);

  return (
    <>
      {children}
      {showCallNotes && callContactId && shouldShowNotes && (
        <CallNotesPanel 
          contactId={callContactId}
          onClose={() => setShowCallNotes(false)}
        />
      )}
    </>
  );
}