// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

export default function Dashboard() {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const perms = await api.getPermissions();
        setPermissions(perms);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, []);

  const chartData = [
    { time: '9:00', calls: 12 },
    { time: '10:00', calls: 19 },
    { time: '11:00', calls: 15 },
    { time: '12:00', calls: 22 },
    { time: '13:00', calls: 17 },
    { time: '14:00', calls: 25 }
  ];

  const stats = [
    { title: 'Active Calls', value: '12', color: 'primary' },
    { title: 'Waiting Calls', value: '5', color: 'warning' },
    { title: 'Average Wait Time', value: '2:30', color: 'info' },
    { title: 'Resolved Today', value: '45', color: 'success' }
  ];

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!permissions?.dashboard?.read) {
    return <div className="p-4">You don't have permission to view this page.</div>;
  }

  return (
    <div className="p-4 bg-light h-100">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Dashboard Overview</h2>
        <div className="btn-group">
          <button className="btn btn-outline-primary">Daily</button>
          <button className="btn btn-outline-primary">Weekly</button>
          <button className="btn btn-outline-primary">Monthly</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        {stats.map((stat, index) => (
          <div key={index} className="col-md-3">
            <div className="card h-100">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">{stat.title}</h6>
                <h2 className={`card-title text-${stat.color}`}>{stat.value}</h2>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="row g-3">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Call Volume Today</h5>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="calls" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Active Agents</h5>
              <div className="list-group">
                {['John Doe', 'Jane Smith', 'Mike Johnson'].map((agent, index) => (
                  <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                    {agent}
                    <span className="badge bg-success">Online</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}