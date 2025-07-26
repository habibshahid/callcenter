import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useUserData } from '../context/UserDataContext';
import CalendarView from '../components/CalendarView';
import TaskModal from '../components/TaskModal';

export default function CalendarPage() {
  const { permissions } = useUserData();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overdue: 0,
    today: 0,
    upcoming: 0,
    completed_today: 0
  });
  
  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [modalDefaultDate, setModalDefaultDate] = useState(new Date());

  useEffect(() => {
    loadTasks();
    loadTaskStats();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      // Get tasks for the current month view
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const response = await api.getTasks({
        start_date: startOfMonth.toISOString(),
        end_date: endOfMonth.toISOString()
      });
      
      // Ensure tasks is always an array
      const tasksData = Array.isArray(response) ? response : [];
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadTaskStats = async () => {
    try {
      const statsData = await api.getTaskStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading task stats:', error);
    }
  };

  const handleTaskClick = (task, action = 'edit') => {
    setSelectedTask(task);
    setModalMode(action);
    setShowTaskModal(true);
  };

  const handleAddTask = (date) => {
    setModalDefaultDate(date);
    setSelectedTask(null);
    setModalMode('create');
    setShowTaskModal(true);
  };

  const handleUpdateStatus = async (taskId, status) => {
    try {
      await api.updateTaskStatus(taskId, status);
      
      // Update task in local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status, completed_at: status === 'completed' ? new Date() : null }
            : task
        )
      );
      
      // Reload stats
      loadTaskStats();
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status');
    }
  };

  const handleModalClose = (success) => {
    setShowTaskModal(false);
    setSelectedTask(null);
    
    if (success) {
      loadTasks();
      loadTaskStats();
    }
  };

  if (!permissions?.calendar?.read) {
    return (
      <div className="alert alert-warning">
        You don't have permission to view the calendar.
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">
          <Calendar className="me-2" size={24} />
          Calendar & Tasks
        </h4>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card border-danger">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-danger mb-1">Overdue</h6>
                  <h3 className="mb-0">{stats.overdue}</h3>
                </div>
                <AlertCircle className="text-danger" size={32} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3 mb-3">
          <div className="card border-primary">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-primary mb-1">Today</h6>
                  <h3 className="mb-0">{stats.today}</h3>
                </div>
                <Clock className="text-primary" size={32} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3 mb-3">
          <div className="card border-info">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-info mb-1">Upcoming</h6>
                  <h3 className="mb-0">{stats.upcoming}</h3>
                </div>
                <RefreshCw className="text-info" size={32} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3 mb-3">
          <div className="card border-success">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-success mb-1">Completed Today</h6>
                  <h3 className="mb-0">{stats.completed_today}</h3>
                </div>
                <CheckCircle className="text-success" size={32} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <CalendarView
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              onUpdateStatus={handleUpdateStatus}
            />
          </div>
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={handleModalClose}
        task={selectedTask}
        defaultDate={modalDefaultDate}
        mode={modalMode}
      />
    </div>
  );
}