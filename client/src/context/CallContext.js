// src/context/CallContext.js - Fixed to preserve selectedContact in Inbox
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import SipService from '../services/SipService';
import { api } from '../services/api';
import AudioService from '../services/AudioService';

const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [incomingCallAlert, setIncomingCallAlert] = useState(null);
  const timerIntervalRef = useRef(null);

  // Initialize AudioService
  useEffect(() => {
    AudioService.init().catch(console.error);
  }, []);

  useEffect(() => {
    const handleCallStatus = async (callStatus) => {
      console.log('Call status changed:', callStatus);

      // Handle ring tone for incoming calls
      if (callStatus.status === 'ringing' && callStatus.isInbound) {
        await AudioService.playRing();
        
        // Set incoming call alert with contact info
        setIncomingCallAlert({
          number: callStatus.number,
          name: callStatus.name || callStatus.number,
          company: callStatus.company,
          campaign: callStatus.campaign,
          contactId: callStatus.contactId
        });
      }

      // Stop ring tone and handle call state
      if (callStatus.status === 'active' || ['terminated', 'failed', 'rejected'].includes(callStatus.status)) {
        AudioService.stopRing();
        setIncomingCallAlert(null);
      }

      if (callStatus.status === 'active' && !timerIntervalRef.current) {
        const startTime = new Date();
        setCallStartTime(startTime);
        setCallDuration(0);
        timerIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

        // Log call duration start
        if (callStatus.contactId) {
          try {
            await api.addContactInteraction(callStatus.contactId, {
              interaction_type: 'call',
              direction: callStatus.isInbound ? 'inbound' : 'outbound',
              details: {
                started_at: startTime.toISOString(),
                phone: callStatus.number
              }
            });
          } catch (error) {
            console.error('Error logging call start:', error);
          }
        }
      }

      if (['Terminated', 'Failed', 'Rejected', 'terminated', 'failed', 'rejected'].includes(callStatus.status)) {
        const endTime = new Date();
        const duration = callDuration;
        
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          setCallDuration(0);
          setCallStartTime(null);
        }

        // Log call end with duration
        if (activeCall?.contactId && callStartTime) {
          try {
            await api.addContactInteraction(activeCall.contactId, {
              interaction_type: 'call',
              direction: activeCall.isInbound ? 'inbound' : 'outbound',
              duration: duration,
              details: {
                started_at: callStartTime.toISOString(),
                ended_at: endTime.toISOString(),
                phone: activeCall.number,
                status: callStatus.status
              }
            });
          } catch (error) {
            console.error('Error logging call end:', error);
          }
        }

        // Clear active call after a short delay
        setTimeout(() => {
          setActiveCall(null);
          // Only clear selectedContact if NOT in Inbox
          const currentPath = window.location.pathname;
          if (!currentPath.includes('/inbox')) {
            setSelectedContact(null);
          }
        }, 1000);
      } else {
        // Update active call with enriched contact information
        setActiveCall(prev => ({ 
          ...prev, 
          ...callStatus,
          // Preserve contact information
          contactId: callStatus.contactId || prev?.contactId,
          name: callStatus.name || prev?.name,
          company: callStatus.company || prev?.company,
          email: callStatus.email || prev?.email,
          campaign: callStatus.campaign || prev?.campaign
        }));

        // If we have contact info, update selected contact
        if (callStatus.contactId && callStatus.status === 'active') {
          setSelectedContact({
            id: callStatus.contactId,
            name: callStatus.name,
            phone: callStatus.number,
            company: callStatus.company,
            email: callStatus.email,
            campaign_name: callStatus.campaign,
            status: callStatus.status
          });
        }
      }
    };

    SipService.addCallListener(handleCallStatus);
    return () => {
      SipService.removeCallListener(handleCallStatus);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      AudioService.stopRing();
    };
  }, [activeCall, callDuration, callStartTime]);

  const handleDial = async (number, contactId = null) => {
    try {
      // Store the contact ID before making the call
      if (contactId) {
        // This will be used when the call status updates
        SipService.pendingContactId = contactId;
      }
      
      await SipService.makeCall(number);
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  };

  const value = {
    activeCall,
    callDuration,
    selectedContact,
    setSelectedContact,
    incomingCallAlert,
    handleDial,
    
    // Call control methods
    handleMuteCall: async () => {
      try {
        const newMuteState = !activeCall?.isMuted;
        await SipService.muteCall(newMuteState);
        setActiveCall(prev => ({
          ...prev,
          isMuted: newMuteState
        }));
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    },
    
    handleHoldCall: async () => {
      try {
        const newHoldState = !activeCall?.isHeld;
        await SipService.holdCall(newHoldState);
        setActiveCall(prev => ({
          ...prev,
          isHeld: newHoldState
        }));
      } catch (error) {
        console.error('Error toggling hold:', error);
      }
    },
    
    handleEndCall: async () => {
      try {
        await SipService.endCall();
      } catch (error) {
        console.error('Error ending call:', error);
      }
    },
    
    handleAnswerCall: async () => {
      try {
        await SipService.answerCall();
        AudioService.stopRing();
        setIncomingCallAlert(null);
      } catch (error) {
        console.error('Error answering call:', error);
      }
    },
    
    handleRejectCall: async () => {
      try {
        await SipService.rejectCall();
        AudioService.stopRing();
        setIncomingCallAlert(null);
      } catch (error) {
        console.error('Error rejecting call:', error);
      }
    },

    // Method to create a new contact from a call
    createContactFromCall: async (contactData) => {
      try {
        const newContact = await api.createContact({
          ...contactData,
          phone_primary: activeCall.number,
          source: 'call'
        });
        
        // Update the active call with the new contact info
        setActiveCall(prev => ({
          ...prev,
          contactId: newContact.id,
          name: `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim()
        }));
        
        setSelectedContact(newContact);
        return newContact;
      } catch (error) {
        console.error('Error creating contact:', error);
        throw error;
      }
    }
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};