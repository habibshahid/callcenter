// client/src/App.js - Updated with UserDataProvider
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { UserDataProvider } from './context/UserDataContext';
import Menu from './components/Menu';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import ChangePassword from './pages/ChangePassword';
import { CallProvider } from './context/CallContext';
import ContactsManagement from './pages/ContactsManagement';
import IncomingCallNotification from './components/IncomingCallNotification';
import RealTimeSearch from './components/RealTimeSearch';
import CallStatusProvider from './components/CallStatusProvider';
import AutoCallNotesWrapper from './components/AutoCallNotesWrapper';
import CalendarPage from './pages/CalendarPage';
import 'bootstrap/dist/css/bootstrap.min.css';

const PrivateLayout = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <AutoCallNotesWrapper excludeModules={['inbox']}>
      <div className="vh-100 d-flex flex-column">
        {/* TopBar fixed at the top */}
        <div className="position-fixed top-0 start-0 end-0 bg-white" style={{ zIndex: 1030 }}>
          <TopBar />
        </div>
        
        {/* Incoming Call Notification */}
        <IncomingCallNotification />
        
        {/* Main content area with proper spacing */}
        <div className="flex-grow-1 d-flex mt-5">
          {/* Menu - fixed height below TopBar */}
          <div className="position-fixed start-0 bottom-0" style={{ top: '61px', width: '60px' }}>
            <Menu />
          </div>
          
          {/* Content area with proper margin and scroll */}
          <div className="flex-grow-1" style={{ marginLeft: '60px', marginTop: '1rem', overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
    </AutoCallNotesWrapper>
  );
};

export default function App() {
  return (
    <AppProvider>
      <UserDataProvider>
        <CallProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <PrivateLayout>
                    <Dashboard />
                  </PrivateLayout>
                }
              />
              <Route
                path="/inbox"
                element={
                  <PrivateLayout>
                    <Inbox />
                  </PrivateLayout>
                }
              />
              <Route
                path="/contacts-management"
                element={
                  <PrivateLayout>
                    <ContactsManagement />
                  </PrivateLayout>
                }
              />
              <Route
                path="/change-password"
                element={
                  <PrivateLayout>
                    <ChangePassword />
                  </PrivateLayout>
                }
              />
              <Route
                path="/calendar"
                element={
                  <PrivateLayout>
                    <CalendarPage />
                  </PrivateLayout>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <CallStatusProvider />
          </BrowserRouter>
        </CallProvider>
      </UserDataProvider>
    </AppProvider>
  );
}