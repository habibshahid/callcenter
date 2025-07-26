import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, 
  Clock, AlertCircle, CheckCircle, X, Edit, RefreshCw
} from 'lucide-react';

// Calendar Component with month/week/day/hour views
export default function CalendarView({ 
  tasks = [], 
  onTaskClick, 
  onAddTask, 
  onUpdateStatus,
  currentDate = new Date() 
}) {
  const [viewType, setViewType] = useState('month'); // month, week, day, agenda
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [hoveredTask, setHoveredTask] = useState(null);

  // Get calendar grid based on view type
  const getCalendarDays = useCallback(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    const endDate = new Date(lastDay);

    // Adjust to start from Sunday
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    // Adjust to end on Saturday
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [selectedDate]);

  const getWeekDays = useCallback(() => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }

    return days;
  }, [selectedDate]);

  const getDayHours = useCallback(() => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i);
    }
    return hours;
  }, []);

  // Filter tasks for a specific date
  const getTasksForDate = useCallback((date) => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter(task => {
      const taskDate = new Date(task.due_date);
      return taskDate.toDateString() === date.toDateString();
    });
  }, [tasks]);

  // Filter tasks for a specific hour
  const getTasksForHour = useCallback((date, hour) => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter(task => {
      const taskDate = new Date(task.due_date);
      return taskDate.toDateString() === date.toDateString() && 
             taskDate.getHours() === hour;
    });
  }, [tasks]);

  // Navigation functions
  const navigatePrevious = () => {
    const newDate = new Date(selectedDate);
    switch (viewType) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    setSelectedDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(selectedDate);
    switch (viewType) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    setSelectedDate(newDate);
  };

  const navigateToday = () => {
    setSelectedDate(new Date());
  };

  // Format display title based on view
  const getDisplayTitle = () => {
    const options = { year: 'numeric' };
    switch (viewType) {
      case 'month':
        return selectedDate.toLocaleDateString('en-US', { ...options, month: 'long' });
      case 'week':
        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'day':
        return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      default:
        return '';
    }
  };

  const getTaskPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'border-danger text-danger';
      case 'medium': return 'border-warning text-warning';
      case 'low': return 'border-info text-info';
      default: return 'border-secondary';
    }
  };

  const getTaskStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} className="text-success" />;
      case 'cancelled':
        return <X size={14} className="text-danger" />;
      default:
        return <Clock size={14} className="text-primary" />;
    }
  };

  const isOverdue = (task) => {
    return task.status === 'pending' && new Date(task.due_date) < new Date();
  };

  // Render task item
  const renderTask = (task) => (
    <div
      key={task.id}
      className={`calendar-task p-1 mb-1 border rounded small ${getTaskPriorityClass(task.priority)} ${isOverdue(task) ? 'bg-danger bg-opacity-10' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick(task);
      }}
      onMouseEnter={() => setHoveredTask(task.id)}
      onMouseLeave={() => setHoveredTask(null)}
      style={{ cursor: 'pointer', fontSize: '0.75rem' }}
    >
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center text-truncate">
          {getTaskStatusIcon(task.status)}
          <span className="ms-1 text-truncate">{task.title}</span>
        </div>
        {hoveredTask === task.id && task.status === 'pending' && (
          <div className="d-flex gap-1">
            <CheckCircle 
              size={14} 
              className="text-success" 
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStatus(task.id, 'completed');
              }}
            />
            <RefreshCw 
              size={14} 
              className="text-info"
              onClick={(e) => {
                e.stopPropagation();
                onTaskClick(task, 'reschedule');
              }}
            />
          </div>
        )}
      </div>
      {task.contact_id && (
        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
          {task.first_name} {task.last_name}
        </div>
      )}
    </div>
  );

  // Render views
  const renderMonthView = () => {
    const days = getCalendarDays();
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="calendar-month">
        <div className="calendar-header row g-0 border-bottom">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="col text-center py-2 fw-bold">
              {day}
            </div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="calendar-week row g-0">
            {week.map((day, dayIndex) => {
              const dayTasks = getTasksForDate(day);
              const isToday = day.toDateString() === new Date().toDateString();
              const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
              
              return (
                <div 
                  key={dayIndex} 
                  className={`col calendar-day border p-1 ${!isCurrentMonth ? 'bg-light' : ''} ${isToday ? 'bg-primary bg-opacity-10' : ''}`}
                  style={{ minHeight: '100px', cursor: 'pointer' }}
                  onClick={() => onAddTask(day)}
                >
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <small className={`${!isCurrentMonth ? 'text-muted' : ''} ${isToday ? 'fw-bold text-primary' : ''}`}>
                      {day.getDate()}
                    </small>
                    {dayTasks.length > 0 && (
                      <span className="badge bg-secondary rounded-pill" style={{ fontSize: '0.65rem' }}>
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="calendar-day-tasks">
                    {dayTasks.slice(0, 3).map(renderTask)}
                    {dayTasks.length > 3 && (
                      <small className="text-muted">+{dayTasks.length - 3} more</small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays();
    const hours = getDayHours();

    return (
      <div className="calendar-week-view">
        <div className="row g-0">
          <div className="col-1"></div>
          {days.map((day, index) => (
            <div key={index} className="col text-center border py-2">
              <div className="fw-bold">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className={day.toDateString() === new Date().toDateString() ? 'text-primary fw-bold' : ''}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        <div className="calendar-week-grid" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {hours.map(hour => (
            <div key={hour} className="row g-0">
              <div className="col-1 border text-end pe-2 py-1">
                <small>{hour}:00</small>
              </div>
              {days.map((day, dayIndex) => {
                const hourTasks = getTasksForHour(day, hour);
                return (
                  <div 
                    key={dayIndex} 
                    className="col border p-1" 
                    style={{ minHeight: '60px', cursor: 'pointer' }}
                    onClick={() => {
                      const dateTime = new Date(day);
                      dateTime.setHours(hour);
                      onAddTask(dateTime);
                    }}
                  >
                    {hourTasks.map(renderTask)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = getDayHours();
    const dayTasks = getTasksForDate(selectedDate);

    return (
      <div className="calendar-day-view">
        <div className="calendar-day-grid" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {hours.map(hour => {
            const hourTasks = getTasksForHour(selectedDate, hour);
            return (
              <div key={hour} className="row g-0 border-bottom">
                <div className="col-2 border-end text-end pe-2 py-2">
                  <small>{hour}:00</small>
                </div>
                <div 
                  className="col-10 p-2" 
                  style={{ minHeight: '60px', cursor: 'pointer' }}
                  onClick={() => {
                    const dateTime = new Date(selectedDate);
                    dateTime.setHours(hour);
                    onAddTask(dateTime);
                  }}
                >
                  {hourTasks.map(renderTask)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    if (!Array.isArray(tasks)) return <div>No tasks available</div>;
    
    const sortedTasks = [...tasks].sort((a, b) => 
      new Date(a.due_date) - new Date(b.due_date)
    );

    const groupedTasks = sortedTasks.reduce((groups, task) => {
      const date = new Date(task.due_date).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(task);
      return groups;
    }, {});

    return (
      <div className="calendar-agenda-view" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {Object.entries(groupedTasks).map(([date, dateTasks]) => (
          <div key={date} className="mb-3">
            <h6 className="text-muted mb-2">
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
            </h6>
            {dateTasks.map(task => (
              <div 
                key={task.id} 
                className={`d-flex align-items-center justify-content-between p-2 mb-2 border rounded ${getTaskPriorityClass(task.priority)} ${isOverdue(task) ? 'bg-danger bg-opacity-10' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onTaskClick(task)}
              >
                <div className="d-flex align-items-center">
                  {getTaskStatusIcon(task.status)}
                  <div className="ms-2">
                    <div className="fw-bold">{task.title}</div>
                    <small className="text-muted">
                      {new Date(task.due_date).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                      {task.contact_id && ` • ${task.first_name} ${task.last_name}`}
                    </small>
                  </div>
                </div>
                {task.status === 'pending' && (
                  <div className="d-flex gap-2">
                    <CheckCircle 
                      size={20} 
                      className="text-success" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(task.id, 'completed');
                      }}
                    />
                    <RefreshCw 
                      size={20} 
                      className="text-info"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task, 'reschedule');
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="calendar-container">
      {/* Calendar Header */}
      <div className="calendar-controls d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={navigatePrevious}>
            <ChevronLeft size={16} />
          </button>
          <button className="btn btn-sm btn-outline-primary" onClick={navigateToday}>
            Today
          </button>
          <button className="btn btn-sm btn-outline-primary" onClick={navigateNext}>
            <ChevronRight size={16} />
          </button>
          <h5 className="mb-0 ms-3">{getDisplayTitle()}</h5>
        </div>
        <div className="d-flex gap-2">
          <select 
            className="form-select form-select-sm" 
            value={viewType} 
            onChange={(e) => setViewType(e.target.value)}
          >
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
            <option value="agenda">Agenda</option>
          </select>
          <button 
            className="btn btn-sm btn-primary"
            onClick={() => onAddTask(selectedDate)}
          >
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      {/* Calendar View */}
      <div className="calendar-view">
        {viewType === 'month' && renderMonthView()}
        {viewType === 'week' && renderWeekView()}
        {viewType === 'day' && renderDayView()}
        {viewType === 'agenda' && renderAgendaView()}
      </div>
    </div>
  );
}