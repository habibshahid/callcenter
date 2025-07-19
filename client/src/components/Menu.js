// src/components/Menu.js
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BarChart2, Inbox, Share, Users } from 'lucide-react';

const menuItems = [
  { icon: Home, path: '/dashboard', label: 'Home' },
  { icon: BarChart2, path: '/analytics', label: 'Analytics' },
  { icon: Inbox, path: '/inbox', label: 'Inbox' },
  { icon: Users, path: '/contacts-management', label: 'Leads' },
  { icon: Share, path: '/share', label: 'Share' }
];

export default function Menu() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="bg-light border-end h-100">
      <ul className="nav nav-pills flex-column mb-auto text-center p-0">
        {menuItems.map((item) => (
          <li key={item.path} className="nav-item">
            <button 
              onClick={() => navigate(item.path)}
              className={`nav-link border-0 rounded-0 py-3 d-flex align-items-center justify-content-center ${
                location.pathname === item.path ? 'active' : ''
              }`}
              title={item.label}
            >
              <item.icon size={20} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}