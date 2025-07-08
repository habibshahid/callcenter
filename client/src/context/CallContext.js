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
  const [selectedContact, setSelectedContact] = useState(null);
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
      }

      // Stop ring tone and handle call state
      if (callStatus.status === 'active' || ['terminated', 'failed', 'rejected'].includes(callStatus.status)) {
        AudioService.stopRing();
      }

      if (callStatus.status === 'active' && !timerIntervalRef.current) {
        setCallDuration(0);
        timerIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }

      if (['terminated', 'failed', 'rejected'].includes(callStatus.status)) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          setCallDuration(0);
        }
        // Clear active call after a short delay
        setTimeout(() => {
          setActiveCall(null);
        }, 1000);
      } else {
        setActiveCall(prev => ({ ...prev, ...callStatus }));
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
  }, []);

  const handleDial = async (number) => {
    try {
      // Look up contact first
      const contact = await api.lookupContact(number);
      if (contact) {
        setSelectedContact(contact);
      } else {
        setSelectedContact({
          phone: number,
          isTemporary: true
        });
      }
      await SipService.makeCall(number);
    } catch (error) {
      console.error('Error making call:', error);
    }
  };

  const value = {
    activeCall,
    callDuration,
    selectedContact,
    setSelectedContact,
    handleDial,
    // Add other call control methods
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
      } catch (error) {
        console.error('Error answering call:', error);
      }
    },
    handleRejectCall: async () => {
      try {
        await SipService.rejectCall();
        AudioService.stopRing(); 
      } catch (error) {
        console.error('Error rejecting call:', error);
      }
    }
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};