// src/components/CallStatusProvider.js
import React from 'react';
import { Phone, Loader } from 'lucide-react';
import { useCall } from '../context/CallContext';

export default function CallStatusProvider() {
  const { activeCall } = useCall();
  
  if (!activeCall || ['Terminated', 'terminated', 'failed', 'rejected', 'active'].includes(activeCall.status)) {
    return null;
  }

  const getStatusMessage = () => {
    switch (activeCall.status) {
      case 'trying':
        return 'Connecting...';
      case 'connecting':
        return 'Establishing connection...';
      case 'ringing':
        return activeCall.isInbound ? 'Incoming call...' : 'Ringing...';
      case 'active':
        return 'Call in progress';
      default:
        return activeCall.status;
    }
  };

  const getStatusColor = () => {
    switch (activeCall.status) {
      case 'active':
        return 'success';
      case 'ringing':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <div className="position-fixed bottom-0 end-0 m-4" style={{ zIndex: 1045 }}>
      <div className={`alert alert-${getStatusColor()} d-flex align-items-center shadow`}>
        {activeCall.status === 'active' ? (
          <Phone size={18} className="me-2" />
        ) : (
          <Loader size={18} className="me-2 spinner" />
        )}
        <div>
          <strong>{activeCall.number}</strong>
          <div className="small">{getStatusMessage()}</div>
        </div>
      </div>
    </div>
  );
}

// Add this CSS to your global styles
const styles = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
`;