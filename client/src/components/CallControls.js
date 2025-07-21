// src/components/CallControls.js
import React, { useState, useEffect } from 'react';
import { Phone, PauseCircle, Mic, MicOff, Info, X, Hash } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Dialer from './Dialer';

const CallControls = ({ 
  activeCall, 
  callDuration, 
  onMute, 
  onHold, 
  onEnd,
  onAnswer,
  onReject,
  onDial 
}) => {
  const { sipStatus } = useApp();
  const [showStatus, setShowStatus] = useState(false);
  const [showDialer, setShowDialer] = useState(false);
  const [inputNumber, setInputNumber] = useState('');

  // Reset input when call ends completely
  useEffect(() => {
    if (!activeCall || ['Terminated', 'terminated', 'Rejected', 'rejected', 'Failed', 'failed'].includes(activeCall.status)){ //activeCall.status === 'terminated') {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setInputNumber('');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeCall]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputNumber.trim() && !activeCall) {
      onDial(inputNumber.trim());
    }
  };

  const handleDialClick = () => {
    if (inputNumber.trim() && !activeCall) {
      onDial(inputNumber.trim());
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'registered':
        return 'text-success';
      case 'connecting':
      case 'connected':
        return 'text-warning';
      default:
        return 'text-danger';
    }
  };

  // Check if we're in a call state that should block new calls
  const isCallActive = activeCall && !['terminated', 'failed', 'rejected'].includes(activeCall.status);

  return (
    <div className="d-flex align-items-center gap-2">
      {/* Phone Status Info */}
      <div className="position-relative">
        <button
          className="btn btn-link p-0"
          onMouseEnter={() => setShowStatus(true)}
          onMouseLeave={() => setShowStatus(false)}
        >
          <Info size={18} className={getStatusColor(sipStatus)} />
        </button>
        {showStatus && (
          <div className="position-absolute bg-white shadow-sm rounded p-2" 
               style={{ top: '100%', right: 0, zIndex: 1000, minWidth: '150px' }}>
            <div className="text-nowrap">
              Phone Status: <span className={getStatusColor(sipStatus)}>
                {sipStatus === 'registered' ? 'Online' : 
                 sipStatus === 'connecting' ? 'Connecting...' : 
                 'Offline'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="bg-light rounded-pill px-2 py-1 d-flex align-items-center gap-2">
        {isCallActive ? (
          <>
            <span className="text-muted small">
              {activeCall.number} - {activeCall.status === 'active' ? formatTime(callDuration) : activeCall.status}
            </span>

            {activeCall.status === 'active' ? (
              <>
                <button 
                  className={`btn btn-link btn-sm p-0 ${activeCall.isMuted ? 'text-danger' : ''}`}
                  onClick={onMute}
                  title={activeCall.isMuted ? 'Unmute' : 'Mute'}
                >
                  {activeCall.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button 
                  className={`btn btn-link btn-sm p-0 ${activeCall.isHeld ? 'text-warning' : ''}`}
                  onClick={onHold}
                  title={activeCall.isHeld ? 'Unhold' : 'Hold'}
                >
                  <PauseCircle size={18} />
                </button>
              </>
            ) : activeCall.status === 'ringing' && activeCall.isInbound ? (
              <>
                <button 
                  className="btn btn-link btn-sm p-0 text-success"
                  onClick={onAnswer}
                  title="Answer"
                >
                  <Phone size={18} />
                </button>
              </>
            ) : null}

            {(activeCall.status === 'active' || (!activeCall.isInbound && ['trying', 'connecting', 'ringing'].includes(activeCall.status))) && (
              <button 
                className="btn btn-link btn-sm p-0 text-danger"
                onClick={onEnd}
                title="End Call"
              >
                <X size={18} />
              </button>
            )}
          </>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <input 
              type="text" 
              className="form-control form-control-sm" 
              placeholder="Enter number" 
              value={inputNumber}
              onChange={(e) => setInputNumber(e.target.value)}
              onKeyPress={handleKeyPress}
              style={{ width: '150px' }}
              disabled={sipStatus !== 'registered'}
            />
            <button
              className="btn btn-link btn-sm p-0"
              onClick={() => setShowDialer(true)}
              title="Open Dialpad"
              disabled={sipStatus !== 'registered'}
            >
              <Hash size={18} />
            </button>
            {inputNumber.trim() && (
              <button
                className="btn btn-link btn-sm p-0 text-success"
                onClick={handleDialClick}
                title="Call"
                disabled={sipStatus !== 'registered'}
              >
                <Phone size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialer Dropdown */}
      {showDialer && !isCallActive && (
        <div className="position-absolute" style={{ top: '100%', zIndex: 1000 }}>
          <Dialer 
            onClose={() => setShowDialer(false)} 
            onDial={(number) => {
              onDial(number);
              setShowDialer(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CallControls;