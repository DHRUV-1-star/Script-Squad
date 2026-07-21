import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import './QuickAddTask.css';

const PROJECT_COLORS = [
  '#6366f1', '#ec4899', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#8b5cf6', '#f97316',
];

const PRIORITY_OPTIONS = [
  { value: 'high',   label: '🔴 High',   color: '#ef4444' },
  { value: 'medium', label: '🟡 Medium', color: '#f59e0b' },
  { value: 'low',    label: '🟢 Low',    color: '#10b981' },
];

const STATUS_OPTIONS = [
  { value: 'todo',       label: '📋 Todo' },
  { value: 'inprogress', label: '🚀 In Progress' },
  { value: 'done',       label: '✅ Done' },
];

const EMPTY_FORM = {
  title: '', description: '', priority: 'medium',
  dueDate: '', status: 'todo',
};

// ── Inline New Project Form ───────────────────────────────────────────────────
function InlineNewProject({ initialName = '', onCreated, onCancel }) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/projects', { title: name.trim(), color });
      toast.success(`Project "${name.trim()}" created! 🎉`);
      onCreated(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qat-inline-project">
      <div className="qat-inline-project-title">✨ New Project</div>
      <div className="qat-inline-project-fields">
        <input
          className="form-input qat-inline-input"
          placeholder="Project name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
          maxLength={100}
        />
        <div className="qat-color-row">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              className={`qat-color-dot ${color === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              type="button"
              title={c}
            />
          ))}
        </div>
        <div className="qat-inline-project-actions">
          <button className="btn btn-secondary btn-sm" onClick={onCancel} type="button">Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            type="button"
          >
            {saving ? '…' : '➕ Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main QuickAddTask Component ───────────────────────────────────────────────
export default function QuickAddTask() {
  const [isOpen, setIsOpen] = useState(false);

  // Natural language input
  const [nlText, setNlText] = useState('');
  const [parsing, setParsing] = useState(false);

  // Form state
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiFilledFields, setAiFilledFields] = useState(new Set()); // highlight AI-filled fields

  // Project state
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [suggestedProjectName, setSuggestedProjectName] = useState('');

  // Submit state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const nlRef = useRef(null);
  const modalRef = useRef(null);

  // ── Load projects when modal opens ──────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data.data);
    } catch { /* silent */ }
  }, []);

  const openModal = () => {
    setIsOpen(true);
    setNlText('');
    setForm(EMPTY_FORM);
    setAiFilledFields(new Set());
    setSelectedProjectId('');
    setShowNewProject(false);
    setSuggestedProjectName('');
    setErrors({});
    loadProjects();
  };

  const closeModal = () => {
    setIsOpen(false);
    setNlText('');
    setForm(EMPTY_FORM);
    setAiFilledFields(new Set());
    setErrors({});
  };

  // Focus NL textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nlRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    const clickHandler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) closeModal();
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', clickHandler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', clickHandler);
    };
  }, [isOpen]);

  // ── AI Parse ────────────────────────────────────────────────────────────────
  const handleAIParse = async () => {
    if (!nlText.trim()) return;
    setParsing(true);
    setAiFilledFields(new Set());
    try {
      const res = await api.post('/ai/parse-task', {
        text: nlText.trim(),
        projectNames: projects.map((p) => p.title),
      });
      const parsed = res.data.data;

      // Build the form from parsed data
      const filled = new Set();
      const newForm = { ...EMPTY_FORM };

      if (parsed.title) { newForm.title = parsed.title; filled.add('title'); }
      if (parsed.description) { newForm.description = parsed.description; filled.add('description'); }
      if (parsed.priority) { newForm.priority = parsed.priority; filled.add('priority'); }
      if (parsed.dueDate) { newForm.dueDate = parsed.dueDate; filled.add('dueDate'); }
      if (parsed.status) { newForm.status = parsed.status; filled.add('status'); }

      setForm(newForm);
      setAiFilledFields(filled);

      // Auto-select project if suggested name matches an existing one
      if (parsed.suggestedProject) {
        const lower = parsed.suggestedProject.toLowerCase();
        const match = projects.find((p) => p.title.toLowerCase() === lower);
        if (match) {
          setSelectedProjectId(match._id);
          setSuggestedProjectName('');
        } else {
          // Offer to create a new project with that name
          setSuggestedProjectName(parsed.suggestedProject);
          setSelectedProjectId('');
        }
        filled.add('project');
        setAiFilledFields(new Set(filled));
      }

      toast.success('✨ Task auto-filled by AI!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI parsing failed. Please fill manually.');
    } finally {
      setParsing(false);
    }
  };

  // Handle Enter key in NL textarea (Shift+Enter = newline, Enter = parse)
  const handleNlKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIParse();
    }
  };

  // ── Handle new project created inline ───────────────────────────────────────
  const handleProjectCreated = (newProject) => {
    setProjects((prev) => [newProject, ...prev]);
    setSelectedProjectId(newProject._id);
    setShowNewProject(false);
    setSuggestedProjectName('');
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Validate
    const errs = {};
    if (!form.title.trim()) errs.title = 'Task title is required';
    if (!selectedProjectId) errs.project = 'Please select or create a project';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await api.post('/tasks', {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate || undefined,
        project: selectedProjectId,
      });
      toast.success(`✅ Task "${form.title}" created!`);
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const selectedProject = projects.find((p) => p._id === selectedProjectId);

  if (!isOpen) {
    return (
      <button
        id="quick-add-task-fab"
        className="qat-fab"
        onClick={openModal}
        title="Quick Add Task (AI-powered)"
        aria-label="Quick Add Task"
      >
        <span className="qat-fab-icon">⚡</span>
        <span className="qat-fab-label">Add Task</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="qat-backdrop" />

      {/* Modal */}
      <div className="qat-modal-wrap">
        <div className="qat-modal" ref={modalRef} role="dialog" aria-modal="true" aria-label="Quick Add Task">

          {/* Header */}
          <div className="qat-header">
            <div className="qat-header-left">
              <span className="qat-header-icon">⚡</span>
              <div>
                <div className="qat-header-title">Quick Add Task</div>
                <div className="qat-header-subtitle">Describe it naturally — AI fills the rest</div>
              </div>
            </div>
            <button className="btn-icon qat-close-btn" onClick={closeModal} aria-label="Close">✕</button>
          </div>

          {/* Natural language section */}
          <div className="qat-nl-section">
            <div className="qat-nl-label">
              <span className="qat-ai-dot" />
              Describe your task
            </div>
            <div className="qat-nl-row">
              <textarea
                ref={nlRef}
                id="qat-nl-input"
                className="qat-nl-input"
                placeholder={`e.g. "Fix the login bug in Auth project, high priority, due Friday"`}
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                onKeyDown={handleNlKeyDown}
                rows={2}
                disabled={parsing}
              />
              <button
                id="qat-autofill-btn"
                className={`qat-autofill-btn ${parsing ? 'loading' : ''}`}
                onClick={handleAIParse}
                disabled={!nlText.trim() || parsing}
                title="Let AI fill in the details (Enter)"
              >
                {parsing ? (
                  <><span className="qat-btn-spinner" /><span>Parsing…</span></>
                ) : (
                  <><span>✨</span><span>Auto-fill</span></>
                )}
              </button>
            </div>
            <div className="qat-nl-hint">Press Enter to auto-fill · Shift+Enter for new line</div>
          </div>

          <div className="qat-divider"><span>Task Details</span></div>

          {/* Form fields */}
          <div className="qat-form">

            {/* Title */}
            <div className={`qat-field ${aiFilledFields.has('title') ? 'ai-filled' : ''}`}>
              <label className="qat-label" htmlFor="qat-title">
                Title {aiFilledFields.has('title') && <span className="qat-ai-badge">✨ AI</span>}
              </label>
              <input
                id="qat-title"
                className={`form-input ${errors.title ? 'input-error' : ''}`}
                placeholder="Task title…"
                value={form.title}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setErrors((e2) => ({ ...e2, title: '' })); }}
                maxLength={200}
              />
              {errors.title && <div className="qat-error">{errors.title}</div>}
            </div>

            {/* Project */}
            <div className={`qat-field ${aiFilledFields.has('project') ? 'ai-filled' : ''}`}>
              <label className="qat-label" htmlFor="qat-project">
                Project {aiFilledFields.has('project') && <span className="qat-ai-badge">✨ AI</span>}
              </label>

              {showNewProject ? (
                <InlineNewProject
                  initialName={suggestedProjectName}
                  onCreated={handleProjectCreated}
                  onCancel={() => { setShowNewProject(false); setSuggestedProjectName(''); }}
                />
              ) : (
                <>
                  <div className="qat-project-row">
                    <select
                      id="qat-project"
                      className={`form-input qat-project-select ${errors.project ? 'input-error' : ''}`}
                      value={selectedProjectId}
                      onChange={(e) => { setSelectedProjectId(e.target.value); setErrors((e2) => ({ ...e2, project: '' })); }}
                    >
                      <option value="">— Select a project —</option>
                      {projects.map((p) => (
                        <option key={p._id} value={p._id}>{p.title}</option>
                      ))}
                    </select>
                    <button
                      className="qat-new-project-btn"
                      onClick={() => { setShowNewProject(true); }}
                      type="button"
                      title="Create a new project"
                    >
                      ➕ New
                    </button>
                  </div>

                  {/* AI project suggestion prompt */}
                  {suggestedProjectName && !selectedProjectId && (
                    <div className="qat-project-suggestion">
                      <span className="qat-suggestion-icon">💡</span>
                      <span>AI suggests: <strong>"{suggestedProjectName}"</strong></span>
                      <button
                        className="qat-suggestion-create-btn"
                        onClick={() => setShowNewProject(true)}
                        type="button"
                      >
                        Create it →
                      </button>
                    </div>
                  )}

                  {selectedProject && (
                    <div className="qat-selected-project-chip" style={{ borderColor: selectedProject.color + '44' }}>
                      <span className="qat-chip-dot" style={{ background: selectedProject.color }} />
                      {selectedProject.title}
                    </div>
                  )}
                </>
              )}
              {errors.project && <div className="qat-error">{errors.project}</div>}
            </div>

            {/* Priority + Status row */}
            <div className="qat-row-2">
              <div className={`qat-field ${aiFilledFields.has('priority') ? 'ai-filled' : ''}`}>
                <label className="qat-label" htmlFor="qat-priority">
                  Priority {aiFilledFields.has('priority') && <span className="qat-ai-badge">✨ AI</span>}
                </label>
                <select
                  id="qat-priority"
                  className="form-input"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className={`qat-field ${aiFilledFields.has('status') ? 'ai-filled' : ''}`}>
                <label className="qat-label" htmlFor="qat-status">
                  Status {aiFilledFields.has('status') && <span className="qat-ai-badge">✨ AI</span>}
                </label>
                <select
                  id="qat-status"
                  className="form-input"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div className={`qat-field ${aiFilledFields.has('dueDate') ? 'ai-filled' : ''}`}>
              <label className="qat-label" htmlFor="qat-due">
                Due Date {aiFilledFields.has('dueDate') && <span className="qat-ai-badge">✨ AI</span>}
              </label>
              <input
                id="qat-due"
                type="date"
                className="form-input"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className={`qat-field ${aiFilledFields.has('description') ? 'ai-filled' : ''}`}>
              <label className="qat-label" htmlFor="qat-desc">
                Notes {aiFilledFields.has('description') && <span className="qat-ai-badge">✨ AI</span>}
              </label>
              <textarea
                id="qat-desc"
                className="form-input qat-desc-input"
                placeholder="Optional description…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                maxLength={1000}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="qat-footer">
            <button className="btn btn-secondary" onClick={closeModal} type="button">Cancel</button>
            <button
              id="qat-submit-btn"
              className="qat-submit-btn"
              onClick={handleSubmit}
              disabled={saving}
              type="button"
            >
              {saving ? (
                <><span className="qat-btn-spinner" /><span>Creating…</span></>
              ) : (
                <><span>⚡</span><span>Create Task</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
