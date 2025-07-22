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
    } else if (!activeCall) {
      // Keep panel open for a bit after call ends to allow saving
      if (showCallNotes && callContactId && callContactId !== 'active-call') {
        setTimeout(() => {
          setShowCallNotes(false);
          setCallContactId(null);
        }, 3000);
      } else {
        setShowCallNotes(false);
        setCallContactId(null);
      }
    }
  }, [activeCall, shouldShowNotes, showCallNotes, callContactId]);

  return (
    <>
      {children}
      {showCallNotes && callContactId && callContactId !== 'active-call' && shouldShowNotes && (
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