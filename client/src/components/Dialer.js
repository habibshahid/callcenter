// src/components/Dialer.js
import React, { useState } from 'react';
import { Phone, X, Delete, GitBranch } from 'lucide-react';
import { useCall } from '../context/CallContext';
import CallTransferDialog from './CallTransferDialog';

export default function Dialer({ onClose, onDial }) {
  const { activeCall } = useCall();
  const [number, setNumber] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const handleNumberClick = (digit) => {
    setNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const handleDial = () => {
    if (number.trim()) {
      onDial(number.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && number.trim()) {
      handleDial();
    }
  };

  const dialpadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  const isCallActive = activeCall && activeCall.status === 'active';

  return (
    <>
      <div className="dialer-container p-4 bg-white rounded-lg shadow-lg" style={{ width: '300px' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="mb-0">
            {isCallActive ? 'In Call' : 'Dial Number'}
          </h5>
          <button 
            className="btn btn-link text-muted p-0"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Show current call info if active */}
        {isCallActive && (
          <div className="alert alert-info mb-3">
            <small>Connected to: <strong>{activeCall.number}</strong></small>
          </div>
        )}

        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control form-control-lg text-center"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isCallActive ? "Enter digits..." : "Enter number..."}
          />
          <button 
            className="btn btn-outline-secondary"
            onClick={handleBackspace}
          >
            <Delete size={20} />
          </button>
        </div>

        <div className="dialpad mb-4">
          {dialpadButtons.map((row, rowIndex) => (
            <div key={rowIndex} className="d-flex justify-content-center gap-2 mb-2">
              {row.map((digit) => (
                <button
                  key={digit}
                  className="btn btn-light rounded-circle"
                  style={{ width: '60px', height: '60px' }}
                  onClick={() => handleNumberClick(digit)}
                >
                  <span className="fs-5">{digit}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="d-grid gap-2">
          {!isCallActive ? (
            <button
              className="btn btn-success d-flex align-items-center justify-content-center gap-2"
              onClick={handleDial}
              disabled={!number.trim()}
            >
              <Phone size={20} />
              Dial
            </button>
          ) : (
            <>
              {/* DTMF Send Button */}
              {number && (
                <button
                  className="btn btn-primary d-flex align-items-center justify-content-center gap-2"
                  onClick={() => {
                    console.log('Sending DTMF:', number);
                    // In real implementation, send DTMF tones
                    setNumber('');
                  }}
                >
                  Send Tones
                </button>
              )}
              
              {/* Transfer Button */}
              <button
                className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-2"
                onClick={() => setShowTransfer(true)}
              >
                <GitBranch size={20} />
                Transfer Call
              </button>
            </>
          )}
        </div>

        {/* Additional Info */}
        {isCallActive && (
          <div className="text-center mt-3">
            <small className="text-muted">
              Use the dialpad to send touch tones during the call
            </small>
          </div>
        )}
      </div>

      {/* Transfer Dialog */}
      {showTransfer && (
        <CallTransferDialog 
          onClose={() => setShowTransfer(false)}
        />
      )}
    </>
  );
}

// Add these styles to your CSS
const dialerStyles = `
.dialpad button:hover {
  background-color: #e9ecef !important;
  transform: scale(1.05);
  transition: all 0.1s ease;
}

.dialpad button:active {
  transform: scale(0.95);
}

.dialer-container {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;