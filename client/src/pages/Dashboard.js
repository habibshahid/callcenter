// client/src/pages/Dashboard.js - Updated to use UserDataContext
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { useUserData } from '../context/UserDataContext';

export default function Dashboard() {
  const { permissions, loading: userDataLoading } = useUserData();
  const [dashboardData, setDashboardData] = useState({
    stats: null,
    chartData: null,
    loading: true
  });

  useEffect(() => {
    // Only load dashboard-specific data
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const stats = await api.getDashboardStats();
      const callVolume = await api.getCallVolume();
      
      // Transform call volume data for chart
      const chartData = callVolume.map(item => ({
        time: `${item.hour}:00`,
        calls: item.total_calls
      }));

      setDashboardData({
        stats,
        chartData,
        loading: false
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setDashboardData(prev => ({ ...prev, loading: false }));
    }
  };

  // Default data if API calls fail
  const defaultChartData = [
    { time: '9:00', calls: 12 },
    { time: '10:00', calls: 19 },
    { time: '11:00', calls: 15 },
    { time: '12:00', calls: 22 },
    { time: '13:00', calls: 17 },
    { time: '14:00', calls: 25 }
  ];

  const defaultStats = [
    { title: 'Active Calls', value: '12', color: 'primary' },
    { title: 'Waiting Calls', value: '5', color: 'warning' },
    { title: 'Average Wait Time', value: '2:30', color: 'info' },
    { title: 'Resolved Today', value: '45', color: 'success' }
  ];

  if (userDataLoading || dashboardData.loading) {
    return (
      <div className="p-4 d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!permissions?.dashboard?.read) {
    return (
      <div className="p-4">
        <div className="alert alert-warning" role="alert">
          <h4 className="alert-heading">Access Denied</h4>
          <p>You don't have permission to view this page.</p>
          <hr />
          <p className="mb-0">Please contact your administrator if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  const stats = dashboardData.stats || defaultStats;
  const chartData = dashboardData.chartData || defaultChartData;

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
              <h5 className="card-title mb-3">Call Volume</h5>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="#0d6efd" 
                    strokeWidth={2}
                    dot={{ fill: '#0d6efd', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">Active Agents</h5>
              <div className="list-group list-group-flush">
                <div className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold">John Doe</div>
                    <small className="text-muted">Available</small>
                  </div>
                  <span className="badge bg-success rounded-pill">Available</span>
                </div>
                <div className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold">Jane Smith</div>
                    <small className="text-muted">On Call</small>
                  </div>
                  <span className="badge bg-primary rounded-pill">On Call</span>
                </div>
                <div className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold">Mike Johnson</div>
                    <small className="text-muted">Break</small>
                  </div>
                  <span className="badge bg-warning rounded-pill">Break</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}