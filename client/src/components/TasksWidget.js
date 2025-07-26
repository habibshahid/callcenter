import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, Plus, RefreshCw, X, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import TaskModal from './TaskModal';

export default function TasksWidget({ contactId, compact = false }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [showAll, setShowAll] = useState(!compact);

  useEffect(() => {
    if (contactId && contactId !== 'active-call') {
      loadTasks();
    }
  }, [contactId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await api.getTasks({ contact_id: contactId });
      
      // Ensure tasks is always an array
      const tasksData = Array.isArray(response) ? response : [];
      
      // Additional client-side filter to ensure we only show tasks for this contact
      const filteredTasks = tasksData.filter(task => 
        String(task.contact_id) === String(contactId)
      );
      
      setTasks(filteredTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = () => {
    setSelectedTask(null);
    setModalMode('create');
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setModalMode('edit');
    setShowTaskModal(true);
  };

  const handleRescheduleTask = (task) => {
    setSelectedTask(task);
    setModalMode('reschedule');
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
    }
  };

  const getTaskPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'text-danger';
      case 'medium': return 'text-warning';
      case 'low': return 'text-info';
      default: return 'text-secondary';
    }
  };

  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'call': return '📞';
      case 'meeting': return '👥';
      case 'follow_up': return '🔄';
      default: return '📋';
    }
  };

  const isOverdue = (task) => {
    return task.status === 'pending' && new Date(task.due_date) < new Date();
  };

  const formatDueDate = (date) => {
    const dueDate = new Date(date);
    const now = new Date();
    const diffTime = dueDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const pendingTasks = Array.isArray(tasks) ? tasks.filter(t => t.status === 'pending') : [];
  const completedTasks = Array.isArray(tasks) ? tasks.filter(t => t.status === 'completed') : [];
  const displayedTasks = showAll ? tasks : pendingTasks.slice(0, 3);

  if (loading) {
    return (
      <div className="text-center py-3">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-widget w-100" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">
          <Calendar size={18} className="me-2" />
          Tasks & Reminders
          {pendingTasks.length > 0 && (
            <span className="badge bg-secondary ms-2">{pendingTasks.length}</span>
          )}
        </h6>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleAddTask}
          title="Add Task"
        >
          <Plus size={16} />
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center text-muted py-3">
          <Calendar size={32} className="mb-2" />
          <p className="mb-1">No tasks yet</p>
          <button
            className="btn btn-sm btn-link"
            onClick={handleAddTask}
          >
            Add your first task
          </button>
        </div>
      ) : (
        <>
          <div className="task-list">
            {displayedTasks.map(task => (
              <div
                key={task.id}
                className={`task-item mb-2 p-2 border rounded ${
                  task.status === 'completed' ? 'bg-light text-muted' : ''
                } ${isOverdue(task) ? 'border-danger' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleEditTask(task)}
              >
                <div className="d-flex align-items-start">
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center mb-1">
                      <span className="me-2">{getTaskTypeIcon(task.type)}</span>
                      <span className={`fw-bold text-truncate ${task.status === 'completed' ? 'text-decoration-line-through' : ''}`}>
                        {task.title}
                      </span>
                      <span className={`ms-2 ${getTaskPriorityClass(task.priority)}`}>
                        {task.priority === 'high' && '●'}
                      </span>
                    </div>
                    <div className="small text-muted">
                      <Clock size={12} className="me-1" />
                      {formatDueDate(task.due_date)} at {new Date(task.due_date).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                      {isOverdue(task) && (
                        <span className="text-danger ms-2">
                          <AlertCircle size={12} /> Overdue
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <div className="small mt-1 text-muted text-truncate" style={{ maxWidth: '100%' }}>
                        {task.description}
                      </div>
                    )}
                  </div>
                  <div className="task-actions ms-2 flex-shrink-0">
                    {task.status === 'pending' && (
                      <div className="btn-group-vertical">
                        <button
                          className="btn btn-sm btn-success px-2 py-1 mb-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(task.id, 'completed');
                          }}
                          title="Mark as completed"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-info px-2 py-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRescheduleTask(task);
                          }}
                          title="Reschedule"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    )}
                    {task.status === 'completed' && (
                      <button
                        className="btn btn-sm btn-warning px-2 py-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(task.id, 'pending');
                        }}
                        title="Mark as pending"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {compact && pendingTasks.length > 3 && !showAll && (
            <button
              className="btn btn-sm btn-link w-100"
              onClick={() => setShowAll(true)}
            >
              Show {pendingTasks.length - 3} more tasks
            </button>
          )}

          {completedTasks.length > 0 && (
            <div className="mt-3">
              <small className="text-muted">
                Completed ({completedTasks.length})
              </small>
            </div>
          )}
        </>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={handleModalClose}
        task={selectedTask}
        contactId={contactId}
        mode={modalMode}
      />
    </div>
  );
}