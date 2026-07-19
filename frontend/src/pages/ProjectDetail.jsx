import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTaskTimer } from '../hooks/useTaskTimer';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../contexts/AuthContext';
import Modal, { ConfirmModal } from '../components/Modal';
import toast from 'react-hot-toast';
import { format, isPast, isToday } from 'date-fns';
import { io } from 'socket.io-client';
import './ProjectDetail.css';

const COLUMNS = [
  { id: 'todo', label: '📋 Todo', color: '#94a3b8' },
  { id: 'inprogress', label: '🚀 In Progress', color: '#6366f1' },
  { id: 'done', label: '✅ Done', color: '#10b981' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: '🔴 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low', label: '🟢 Low' },
];

const defaultTaskForm = {
  title: '', description: '', priority: 'medium', dueDate: '', status: 'todo',
};

// --- Format ms as HH:MM:SS clock ---
function formatMsClock(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

// --- Project-level live time aggregator ---
function ProjectTimePanel({ tasks }) {
  const inProgressTasks = tasks.filter((t) => t.status === 'inprogress');
  const [totalMs, setTotalMs] = useState(0);

  useEffect(() => {
    const compute = () => {
      let ms = 0;
      for (const t of tasks) {
        ms += t.totalTimeSpent || 0;
        if (t.status === 'inprogress' && t.timerStartedAt) {
          ms += Date.now() - new Date(t.timerStartedAt).getTime();
        }
      }
      return Math.max(0, ms);
    };

    setTotalMs(compute());
    const interval = setInterval(() => setTotalMs(compute()), 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  const hours   = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');

  const timeStr = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;

  const isActive = inProgressTasks.length > 0;

  return (
    <div className={`project-time-panel ${isActive ? 'project-time-panel-active' : ''}`}>
      <div className="project-time-panel-header">
        {isActive && <span className="project-time-dot" />}
        <span className="project-time-panel-icon">{isActive ? '⏱️' : '🕐'}</span>
        <span className="project-time-panel-label">Time Invested</span>
      </div>
      <div className="project-time-panel-clock">{timeStr}</div>
      {isActive && (
        <div className="project-time-panel-sub">
          {inProgressTasks.length} task{inProgressTasks.length > 1 ? 's' : ''} running
        </div>
      )}
      {!isActive && totalMs === 0 && (
        <div className="project-time-panel-sub">No time tracked yet</div>
      )}
    </div>
  );
}

// --- Sortable Task Card ---
function TaskCard({ task, onEdit, onDelete, isDragging = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSelf } = useSortable({
    id: task._id,
    data: { type: 'task', task },
  });

  const { totalMs } = useTaskTimer({
    timerStartedAt: task.timerStartedAt,
    totalTimeSpent: task.totalTimeSpent,
    status: task.status,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSelf ? 0.3 : 1,
  };

  const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
  const dueSoon = task.dueDate && isToday(new Date(task.dueDate)) && task.status !== 'done';
  const isInProgress = task.status === 'inprogress';
  const hasTime = isInProgress || (task.totalTimeSpent && task.totalTimeSpent > 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isDragging ? 'dragging' : ''} ${isInProgress ? 'task-card-inprogress' : ''}`}
    >
      <div className="task-card-header">
        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
        <div className="task-card-actions">
          <button
            className="btn-icon btn-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            title="Edit task"
          >
            ✏️
          </button>
          <button
            className="btn-icon btn-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
            title="Delete task"
          >
            🗑️
          </button>
        </div>
      </div>

      <h4 className="task-card-title">{task.title}</h4>
      {task.description && (
        <p className="task-card-desc">{task.description}</p>
      )}

      {/* ── Enhanced Timer Display ─────────────────────────────────────────── */}
      {hasTime && (
        <div className={`task-timer-wrap ${isInProgress ? 'task-timer-wrap-running' : 'task-timer-wrap-paused'}`}>
          {isInProgress && (
            <div className="task-timer-header">
              <span className="task-timer-dot" />
              <span className="task-timer-status-text">LIVE TIMER</span>
            </div>
          )}
          <div className="task-timer-clock">
            {formatMsClock(totalMs)}
          </div>
          {!isInProgress && totalMs > 0 && (
            <div className="task-timer-total-label">time invested</div>
          )}
        </div>
      )}

      {task.dueDate && (
        <div
          className="task-card-due"
          style={{ color: overdue ? '#ef4444' : dueSoon ? '#f59e0b' : 'var(--text-muted)' }}
        >
          📅 {format(new Date(task.dueDate), 'MMM d, yyyy')}
          {overdue && ' • Overdue!'}
          {dueSoon && ' • Due today!'}
        </div>
      )}
    </div>
  );
}

// --- Kanban Column ---
function KanbanColumn({ column, tasks, onEdit, onDelete, onAddTask }) {
  return (
    <div className="kanban-column" data-status={column.id}>
      <div className="kanban-column-header">
        <div className="kanban-column-title">
          <span>{column.label}</span>
          <span className="kanban-count">{tasks.length}</span>
        </div>
        <button
          className="btn-icon btn-sm"
          onClick={() => onAddTask(column.id)}
          title={`Add task to ${column.label}`}
        >
          +
        </button>
      </div>

      <div className="kanban-column-body">
        <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task._id} task={task} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="kanban-empty" onClick={() => onAddTask(column.id)}>
            <span>+</span>
            <p>Add a task</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main ProjectDetail ---
export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(defaultTaskForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    loadProject();
    // Fetch team members to display in header
    api.get('/team').then((res) => setTeamMembers(res.data.data || [])).catch(() => {});
    // Socket.io
    const backendUrl = import.meta.env.VITE_API_URL || '';
    socketRef.current = io(backendUrl, { path: '/socket.io' });
    socketRef.current.emit('join-project', id);
    socketRef.current.on('task-updated', (data) => {
      setTasks((prev) => prev.map((t) => t._id === data.task._id ? data.task : t));
    });
    socketRef.current.on('task-created', (data) => {
      setTasks((prev) => [...prev, data.task]);
    });
    socketRef.current.on('task-deleted', (data) => {
      setTasks((prev) => prev.filter((t) => t._id !== data.taskId));
    });
    return () => {
      socketRef.current?.emit('leave-project', id);
      socketRef.current?.disconnect();
    };
  }, [id]);

  const loadProject = async () => {
    try {
      const [projRes, tasksRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks?project=${id}`),
      ]);
      setProject(projRes.data.data);
      setTasks(tasksRes.data.data);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Project not found');
        navigate('/projects');
      } else {
        toast.error('Failed to load project');
      }
    } finally {
      setLoading(false);
    }
  };

  const getColumnTasks = (status) => {
    return tasks
      .filter((t) => t.status === status)
      .filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()))
      .filter((t) => !priorityFilter || t.priority === priorityFilter)
      .sort((a, b) => a.order - b.order);
  };

  const openCreateTask = (status = 'todo') => {
    setEditingTask(null);
    setTaskForm({ ...defaultTaskForm, status });
    setFormErrors({});
    setShowTaskModal(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    });
    setFormErrors({});
    setShowTaskModal(true);
  };

  const validateTask = () => {
    const e = {};
    if (!taskForm.title.trim()) e.title = 'Title is required';
    else if (taskForm.title.length > 200) e.title = 'Max 200 characters';
    return e;
  };

  const handleSaveTask = async () => {
    const errors = validateTask();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setSaving(true);
    try {
      if (editingTask) {
        const res = await api.put(`/tasks/${editingTask._id}`, taskForm);
        setTasks((prev) => prev.map((t) => t._id === editingTask._id ? res.data.data : t));
        socketRef.current?.emit('task-updated', { projectId: id, task: res.data.data });
        toast.success('Task updated!');
      } else {
        const res = await api.post('/tasks', { ...taskForm, project: id });
        setTasks((prev) => [...prev, res.data.data]);
        socketRef.current?.emit('task-created', { projectId: id, task: res.data.data });
        toast.success('Task created!');
      }
      setShowTaskModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/tasks/${deleteTarget._id}`);
      setTasks((prev) => prev.filter((t) => t._id !== deleteTarget._id));
      socketRef.current?.emit('task-deleted', { projectId: id, taskId: deleteTarget._id });
      toast.success('Task deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete task');
    }
  };

  // --- DnD Handlers ---
  const findTaskColumn = (taskId) => {
    return tasks.find((t) => t._id === taskId)?.status || null;
  };

  const handleDragStart = ({ active }) => {
    const task = tasks.find((t) => t._id === active.id);
    setActiveTask(task || null);
  };

  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const activeCol = findTaskColumn(activeId);
    const overCol = COLUMNS.find((c) => c.id === overId)?.id || findTaskColumn(overId);

    if (!activeCol || !overCol || activeCol === overCol) return;

    setTasks((prev) =>
      prev.map((t) => (t._id === activeId ? { ...t, status: overCol } : t))
    );
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;

    const overCol = COLUMNS.find((c) => c.id === overId)?.id || findTaskColumn(overId);
    const draggedTask = tasks.find((t) => t._id === activeId);
    if (!draggedTask || !overCol) return;

    const colTasks = tasks
      .filter((t) => t.status === overCol)
      .sort((a, b) => a.order - b.order);

    const oldIdx = colTasks.findIndex((t) => t._id === activeId);
    const newIdx = colTasks.findIndex((t) => t._id === overId);

    let reordered = colTasks;
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      reordered = arrayMove(colTasks, oldIdx, newIdx);
    }

    const updatedTasks = reordered.map((t, i) => ({ ...t, status: overCol, order: i }));

    setTasks((prev) => [
      ...prev.filter((t) => t.status !== overCol),
      ...updatedTasks,
    ]);

    try {
      const res = await api.put('/tasks/reorder/bulk', {
        tasks: updatedTasks.map((t) => ({ _id: t._id, status: t.status, order: t.order })),
      });
      if (res.data?.data) {
        const serverMap = new Map(res.data.data.map((t) => [t._id, t]));
        setTasks((prev) =>
          prev.map((t) => (serverMap.has(t._id) ? { ...t, ...serverMap.get(t._id) } : t))
        );
      }
    } catch {
      toast.error('Failed to save order');
      loadProject();
    }
  };

  if (loading) {
    return <div className="page-container"><div className="loading-overlay"><div className="spinner spinner-lg" /></div></div>;
  }

  if (!project) return null;

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const completionPct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="page-container animate-fadeIn">
      {/* Project header */}
      <div className="project-detail-header">
        <div className="project-detail-info">
          <Link to="/projects" className="back-link">← Projects</Link>
          <div className="flex items-center gap-3">
            <div className="project-detail-dot" style={{ background: project.color }} />
            <div>
              <h1 className="project-detail-title">{project.title}</h1>
              {project.description && (
                <p className="project-detail-desc">{project.description}</p>
              )}
            </div>
          </div>
          <div className="project-detail-stats">
            <span className="badge badge-active">{project.status}</span>
            <span className="text-sm text-muted">{tasks.length} tasks</span>
            <span className="text-sm" style={{ color: project.color }}>{completionPct}% complete</span>
            {/* Team member avatar stack */}
            {teamMembers.length > 0 && (
              <div className="project-members-stack">
                {teamMembers.slice(0, 5).map((m) => (
                  <div
                    key={m._id}
                    className="project-member-avatar"
                    title={m.name}
                    style={{ background: `hsl(${m._id.charCodeAt(0) * 37 % 360}, 60%, 55%)` }}
                  >
                    {m.avatar
                      ? <img src={m.avatar} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : m.name?.[0]?.toUpperCase()
                    }
                  </div>
                ))}
                {teamMembers.length > 5 && (
                  <div className="project-member-avatar project-member-overflow">
                    +{teamMembers.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ⏱ Project-level Time Panel */}
          <ProjectTimePanel tasks={tasks} />
        </div>

        <div className="project-detail-actions">
          {/* Search */}
          <div className="search-bar">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="task-search"
            />
          </div>
          {/* Priority filter */}
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            id="priority-filter"
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button id="add-task-btn" className="btn btn-primary" onClick={() => openCreateTask()}>
            + Add Task
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="project-progress-bar-wrap">
        <div className="progress-bar" style={{ height: '8px' }}>
          <div
            className="progress-fill"
            style={{ width: `${completionPct}%`, background: project.color }}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={getColumnTasks(col.id)}
              onEdit={openEditTask}
              onDelete={(task) => setDeleteTarget(task)}
              onAddTask={openCreateTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="task-card dragging-overlay">
              <div className="task-card-header">
                <span className={`badge badge-${activeTask.priority}`}>{activeTask.priority}</span>
              </div>
              <h4 className="task-card-title">{activeTask.title}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={editingTask ? 'Edit Task' : 'New Task'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
            <button
              id="save-task-btn"
              className="btn btn-primary"
              onClick={handleSaveTask}
              disabled={saving}
            >
              {saving ? <><div className="spinner spinner-sm" /> Saving...</> : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Task Title *</label>
          <input
            id="task-title-input"
            type="text"
            className={`form-input ${formErrors.title ? 'error' : ''}`}
            placeholder="What needs to be done?"
            value={taskForm.title}
            onChange={(e) => { setTaskForm((p) => ({ ...p, title: e.target.value })); setFormErrors((p) => ({ ...p, title: '' })); }}
            autoFocus
          />
          {formErrors.title && <span className="form-error">{formErrors.title}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            placeholder="Optional details..."
            value={taskForm.description}
            onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={taskForm.priority}
              onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={taskForm.status}
              onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="todo">📋 Todo</option>
              <option value="inprogress">🚀 In Progress</option>
              <option value="done">✅ Done</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Due Date</label>
          <input
            type="date"
            className="form-input"
            value={taskForm.dueDate}
            onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
      />
    </div>
  );
}
