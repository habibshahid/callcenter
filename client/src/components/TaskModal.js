import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Calendar, Clock, AlertCircle, User } from 'lucide-react';
import { api } from '../services/api';

export default function TaskModal({ 
  isOpen, 
  onClose, 
  task = null, 
  contactId = null,
  defaultDate = new Date(),
  mode = 'create' // create, edit, reschedule
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    reminder_minutes: 30,
    priority: 'medium',
    type: 'task',
    contact_id: null
  });

  const [rescheduleData, setRescheduleData] = useState({
    new_date: '',
    new_time: '',
    reason: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  
  // Use refs to track if we've already initialized
  const initializedRef = useRef(false);
  const lastTaskIdRef = useRef(null);
  const lastModeRef = useRef(null);

  const loadContactInfo = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await api.getContactDetails(id);
      setContactInfo(response);
    } catch (error) {
      console.error('Error loading contact info:', error);
    }
  }, []);

  // Initialize form data when modal opens or props change
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      return;
    }

    // Check if we need to reinitialize
    const shouldReinitialize = !initializedRef.current || 
      (task?.id !== lastTaskIdRef.current) || 
      (mode !== lastModeRef.current);

    if (!shouldReinitialize) return;

    initializedRef.current = true;
    lastTaskIdRef.current = task?.id;
    lastModeRef.current = mode;

    if (mode === 'edit' && task) {
      const dueDate = new Date(task.due_date);
      setFormData({
        title: task.title || '',
        description: task.description || '',
        due_date: dueDate.toISOString().split('T')[0],
        due_time: dueDate.toTimeString().slice(0, 5),
        reminder_minutes: task.reminder_minutes || 30,
        priority: task.priority || 'medium',
        type: task.type || 'task',
        contact_id: task.contact_id || null
      });
      
      if (task.contact_id) {
        loadContactInfo(task.contact_id);
      }
    } else if (mode === 'create') {
      const date = new Date(defaultDate);
      const finalContactId = contactId || null;
      
      setFormData({
        title: '',
        description: '',
        due_date: date.toISOString().split('T')[0],
        due_time: date.toTimeString().slice(0, 5),
        reminder_minutes: 30,
        priority: 'medium',
        type: 'task',
        contact_id: finalContactId
      });
      
      if (finalContactId) {
        loadContactInfo(finalContactId);
      }
    } else if (mode === 'reschedule' && task) {
      const currentDate = new Date(task.due_date);
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 1);
      
      setRescheduleData({
        new_date: newDate.toISOString().split('T')[0],
        new_time: currentDate.toTimeString().slice(0, 5),
        reason: ''
      });
      
      if (task.contact_id) {
        loadContactInfo(task.contact_id);
      }
    }
  }, [isOpen, task?.id, mode, contactId, defaultDate, loadContactInfo]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: '',
      due_time: '',
      reminder_minutes: 30,
      priority: 'medium',
      type: 'task',
      contact_id: null
    });
    setRescheduleData({
      new_date: '',
      new_time: '',
      reason: ''
    });
    setError(null);
    setContactInfo(null);
    initializedRef.current = false;
    lastTaskIdRef.current = null;
    lastModeRef.current = null;
  };

  const handleClose = (success = false) => {
    resetForm();
    onClose(success);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        const dateTime = new Date(`${formData.due_date}T${formData.due_time}`);
        
        await api.createTask({
          ...formData,
          contact_id: formData.contact_id || contactId || null,
          due_date: dateTime.toISOString()
        });
      } else if (mode === 'edit' && task) {
        const dateTime = new Date(`${formData.due_date}T${formData.due_time}`);
        
        // Build update data object with only the fields we want to update
        const updateData = {
          contact_id: formData.contact_id,
          title: formData.title,
          description: formData.description,
          due_date: dateTime.toISOString(),
          reminder_minutes: formData.reminder_minutes,
          priority: formData.priority,
          type: formData.type
        };
        
        await api.updateTask(task.id, updateData);
      } else if (mode === 'reschedule' && task) {
        const newDateTime = new Date(`${rescheduleData.new_date}T${rescheduleData.new_time}`);
        
        await api.rescheduleTask(
          task.id, 
          newDateTime.toISOString(), 
          rescheduleData.reason
        );
      }

      handleClose(true);
    } catch (error) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {mode === 'create' && 'Add New Task'}
              {mode === 'edit' && 'Edit Task'}
              {mode === 'reschedule' && 'Reschedule Task'}
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => handleClose(false)}
            />
          </div>

          <div>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger alert-dismissible" role="alert">
                  {error}
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setError(null)}
                  />
                </div>
              )}

              {contactInfo && (
                <div className="alert alert-info py-2 d-flex align-items-center">
                  <User size={16} className="me-2" />
                  <small>
                    Contact: <strong>{contactInfo.first_name} {contactInfo.last_name}</strong>
                    {contactInfo.company && ` - ${contactInfo.company}`}
                  </small>
                </div>
              )}

              {mode === 'reschedule' ? (
                <>
                  <div className="mb-3">
                    <label className="form-label small text-muted">Current Task</label>
                    <div className="p-2 bg-light rounded">
                      <strong>{task?.title}</strong>
                      <br />
                      <small className="text-muted">
                        Due: {task && new Date(task.due_date).toLocaleString()}
                      </small>
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">New Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={rescheduleData.new_date}
                        onChange={(e) => setRescheduleData({
                          ...rescheduleData,
                          new_date: e.target.value
                        })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">New Time</label>
                      <input
                        type="time"
                        className="form-control"
                        value={rescheduleData.new_time}
                        onChange={(e) => setRescheduleData({
                          ...rescheduleData,
                          new_time: e.target.value
                        })}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Reason for Rescheduling</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={rescheduleData.reason}
                      onChange={(e) => setRescheduleData({
                        ...rescheduleData,
                        reason: e.target.value
                      })}
                      placeholder="Optional: Explain why this task is being rescheduled"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="form-label">Title <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="Enter task title"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter task description (optional)"
                    />
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Due Date <span className="text-danger">*</span></label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Due Time <span className="text-danger">*</span></label>
                      <input
                        type="time"
                        className="form-control"
                        value={formData.due_time}
                        onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Type</label>
                      <select
                        className="form-select"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        <option value="task">Task</option>
                        <option value="call">Call</option>
                        <option value="meeting">Meeting</option>
                        <option value="follow_up">Follow Up</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Reminder</label>
                    <select
                      className="form-select"
                      value={formData.reminder_minutes}
                      onChange={(e) => setFormData({ ...formData, reminder_minutes: parseInt(e.target.value) })}
                    >
                      <option value="0">No reminder</option>
                      <option value="15">15 minutes before</option>
                      <option value="30">30 minutes before</option>
                      <option value="60">1 hour before</option>
                      <option value="120">2 hours before</option>
                      <option value="1440">1 day before</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => handleClose(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    {mode === 'reschedule' ? 'Rescheduling...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {mode === 'create' && 'Create Task'}
                    {mode === 'edit' && 'Update Task'}
                    {mode === 'reschedule' && 'Reschedule Task'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}