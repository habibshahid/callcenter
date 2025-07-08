// src/components/SipStatus.js
import React from 'react';
import { Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';

const statusColors = {
  disconnected: 'text-danger',
  connecting: 'text-warning',
  connected: 'text-warning',
  registered: 'text-success',
  error: 'text-danger'
};

const statusLabels = {
  disconnected: 'Phone Offline',
  connecting: 'Connecting...',
  connected: 'Connecting...',
  registered: 'Phone Ready',
  error: 'Phone Error'
};

export default function SipStatus() {
  const { sipStatus } = useApp();

  return (
    <div className="d-flex align-items-center ms-3">
      <div className={`d-flex align-items-center px-3 py-2 rounded-pill bg-light ${statusColors[sipStatus]}`}>
        <Phone size={18} className="me-2" />
        <span className="small">{statusLabels[sipStatus]}</span>
      </div>
    </div>
  );
}