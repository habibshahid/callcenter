// src/components/Dialer.js
import React, { useState } from 'react';
import { Phone, X, Delete } from 'lucide-react';

export default function Dialer({ onClose, onDial }) {
  const [number, setNumber] = useState('');

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

  const dialpadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  return (
    <div className="dialer-container p-4 bg-white rounded-lg shadow-lg" style={{ width: '300px' }}>
      <div className="flex justify-between items-center mb-4">
        <h5 className="mb-0">Dial Number</h5>
        <button 
          className="btn btn-link text-muted p-0"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>

      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control form-control-lg text-center"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Enter number..."
        />
        <button 
          className="btn btn-outline-secondary"
          onClick={handleBackspace}
        >
          <Delete size={20} />
        </button>
      </div>

      <div className="dialpad grid gap-3 mb-4">
        {dialpadButtons.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-3 gap-3">
            {row.map((digit) => (
              <button
                key={digit}
                className="btn btn-light rounded-circle p-3 text-center w-12 h-12"
                onClick={() => handleNumberClick(digit)}
              >
                {digit}
              </button>
            ))}
          </div>
        ))}
      </div>

      <button
        className="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2"
        onClick={handleDial}
        disabled={!number.trim()}
      >
        <Phone size={20} />
        Dial
      </button>
    </div>
  );
}