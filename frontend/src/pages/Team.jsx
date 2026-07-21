import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';
import './Team.css';

// ── Avatar helper ─────────────────────────────────────────────────────────────
function MemberAvatar({ user, size = 48, showActiveDot = false }) {
  const initials = user?.name
    ?.split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="member-avatar-wrap" style={{ width: size, height: size }}>
      <div className="member-avatar" style={{ width: size, height: size, fontSize: size * 0.35 }}>
        {user?.avatar ? <img src={user.avatar} alt={user.name} /> : initials}
      </div>
      {showActiveDot && <span className="member-active-dot" />}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function TeamSkeleton() {
  return (
    <div className="team-skeleton-grid">
      {[1, 2, 3].map((i) => (
        <div key={i} className="team-skeleton-card">
          <div className="flex items-center gap-3">
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8, borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 11, width: '40%', borderRadius: 6 }} />
            </div>
          </div>
          <div className="skeleton" style={{ height: 64, borderRadius: 10 }} />
          <div className="skeleton" style={{ height: 36, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

// ── Member Card ───────────────────────────────────────────────────────────────
function MemberCard({ memberData, onRemove }) {
  const { user, stats, inProgressTasks, projects } = memberData;
  const isActive = inProgressTasks && inProgressTasks.length > 0;
  return (
    <div className="member-card animate-bounceIn">
      <div className="member-card-strip" />
      <div className="member-card-body">
        <div className="member-identity">
          <MemberAvatar user={user} size={48} showActiveDot={isActive} />
          <div className="member-info">
            <div className="member-name">{user.name}</div>
            <div className="member-email">{user.email}</div>
          </div>
          <button className="member-remove-btn" onClick={() => onRemove(user._id, user.name)} title="Remove from team">
            ✕ Remove
          </button>
        </div>
        <div className="member-stats">
          <div className="member-stat"><span className="member-stat-num todo">{stats.todo}</span><span className="member-stat-label">Todo</span></div>
          <div className="member-stat"><span className="member-stat-num inprog">{stats.inprogress}</span><span className="member-stat-label">In Progress</span></div>
          <div className="member-stat"><span className="member-stat-num done">{stats.done}</span><span className="member-stat-label">Done</span></div>
        </div>
        <div className="member-active-section">
          <div className="member-section-title">{isActive ? '🚀 Currently working on' : '💤 Current work'}</div>
          {isActive ? (
            inProgressTasks.slice(0, 3).map((task) => (
              <div key={task._id} className="member-active-task">
                <span className="member-task-dot" />
                <span className="member-task-name">{task.title}</span>
                {task.project && (
                  <span className="member-task-project" style={{ background: task.project.color + '22', color: task.project.color }}>
                    {task.project.title}
                  </span>
                )}
              </div>
            ))
          ) : (
            <span className="member-idle">No active tasks right now</span>
          )}
          {inProgressTasks && inProgressTasks.length > 3 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '0.5rem' }}>
              +{inProgressTasks.length - 3} more task{inProgressTasks.length - 3 > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {projects && projects.length > 0 && (
          <div>
            <div className="member-section-title">📁 Projects</div>
            <div className="member-projects">
              {projects.slice(0, 6).map((p) => (
                <span key={p._id} className="member-project-chip">
                  <span className="member-project-chip-dot" style={{ background: p.color }} />
                  {p.title}
                </span>
              ))}
              {projects.length > 6 && <span className="member-project-chip">+{projects.length - 6} more</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Member Panel (now sends join requests) ────────────────────────────────
function AddMemberPanel({ onRequestSent }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(null);
  const dropdownRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setResults([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (value) => {
    setQuery(value);
    clearTimeout(searchTimer.current);
    if (value.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/team/search?q=${encodeURIComponent(value.trim())}`);
        setResults(res.data.data);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  };

  const handleSendRequest = async (user) => {
    setSending(user._id);
    try {
      await api.post('/team/requests', { targetUserId: user._id });
      toast.success(`Request sent to ${user.name}! 📨`);
      setResults((prev) => prev.map((u) => u._id === user._id ? { ...u, requestPending: true } : u));
      onRequestSent?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="add-member-card">
      <div className="add-member-title"><span>➕</span> Add Team Member</div>
      <div className="add-member-search-wrap" ref={dropdownRef}>
        <div className="add-member-input-row">
          <input
            id="team-member-search"
            type="text"
            className="form-input"
            placeholder="Search by name or email to send a join request..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoComplete="off"
          />
          {searching && <div style={{ display: 'flex', alignItems: 'center', paddingRight: '0.5rem' }}><div className="spinner spinner-sm" /></div>}
        </div>
        {results.length > 0 && (
          <div className="search-results-dropdown">
            {results.map((user) => (
              <div key={user._id} className="search-result-item">
                <div className="member-avatar" style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
                  {user.avatar ? <img src={user.avatar} alt={user.name} /> : user.name?.[0]?.toUpperCase()}
                </div>
                <div className="search-result-info">
                  <div className="search-result-name">{user.name}</div>
                  <div className="search-result-email">{user.email}</div>
                </div>
                <button
                  className={`search-result-add-btn ${user.requestPending ? 'pending' : ''}`}
                  onClick={() => !user.requestPending && handleSendRequest(user)}
                  disabled={sending === user._id || user.requestPending}
                >
                  {sending === user._id ? '...' : user.requestPending ? '⏳ Pending' : '📨 Request'}
                </button>
              </div>
            ))}
          </div>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <div className="search-results-dropdown">
            <div className="search-no-results">No users found matching "<strong>{query}</strong>"</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Incoming Requests Panel ───────────────────────────────────────────────────
function IncomingRequestsPanel({ requests, onAccept, onDecline }) {
  if (!requests.length) return null;
  return (
    <div className="requests-panel incoming-panel">
      <div className="requests-panel-title">
        <span className="requests-panel-icon">📬</span>
        Incoming Team Requests
        <span className="requests-count-badge">{requests.length}</span>
      </div>
      <div className="requests-list">
        {requests.map((req) => (
          <div key={req._id} className="request-row">
            <div className="member-avatar" style={{ width: 40, height: 40, fontSize: 14, flexShrink: 0 }}>
              {req.from?.avatar ? <img src={req.from.avatar} alt={req.from.name} /> : req.from?.name?.[0]?.toUpperCase()}
            </div>
            <div className="request-info">
              <div className="request-name">{req.from?.name}</div>
              <div className="request-email">{req.from?.email}</div>
              <div className="request-meta">Wants to join your team</div>
            </div>
            <div className="request-actions">
              <button className="req-accept-btn" onClick={() => onAccept(req)}>✓ Accept</button>
              <button className="req-decline-btn" onClick={() => onDecline(req)}>✕ Decline</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Outgoing Requests Panel ───────────────────────────────────────────────────
function OutgoingRequestsPanel({ requests, onCancel }) {
  if (!requests.length) return null;
  return (
    <div className="requests-panel outgoing-panel">
      <div className="requests-panel-title">
        <span className="requests-panel-icon">📤</span>
        Sent Requests
        <span className="requests-count-badge outgoing">{requests.length}</span>
      </div>
      <div className="requests-list">
        {requests.map((req) => (
          <div key={req._id} className="request-row">
            <div className="member-avatar" style={{ width: 40, height: 40, fontSize: 14, flexShrink: 0 }}>
              {req.to?.avatar ? <img src={req.to.avatar} alt={req.to.name} /> : req.to?.name?.[0]?.toUpperCase()}
            </div>
            <div className="request-info">
              <div className="request-name">{req.to?.name}</div>
              <div className="request-email">{req.to?.email}</div>
              <div className="request-meta" style={{ color: 'var(--brand-warning)' }}>⏳ Awaiting response</div>
            </div>
            <button className="req-cancel-btn" onClick={() => onCancel(req)}>Cancel</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── My Visibility Panel ───────────────────────────────────────────────────────
function MyVisibilityPanel() {
  const [data, setData] = useState({ tasks: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});

  const loadVisibility = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/team/my-visibility');
      setData(res.data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadVisibility(); }, [loadVisibility]);

  const toggleTaskPrivacy = async (task) => {
    setToggling((prev) => ({ ...prev, [task._id]: true }));
    try {
      const res = await api.patch(`/tasks/${task._id}/privacy`);
      const { isPrivate } = res.data.data;
      setData((prev) => ({ ...prev, tasks: prev.tasks.map((t) => t._id === task._id ? { ...t, isPrivate } : t) }));
      toast.success(isPrivate ? `"${task.title}" is now private 🔒` : `"${task.title}" is now visible to your team 🔓`);
    } catch { toast.error('Failed to update task privacy'); }
    finally { setToggling((prev) => ({ ...prev, [task._id]: false })); }
  };

  const toggleProjectPrivacy = async (project) => {
    setToggling((prev) => ({ ...prev, [project._id]: true }));
    try {
      const res = await api.patch(`/projects/${project._id}/privacy`);
      const { isPrivate } = res.data.data;
      setData((prev) => ({ ...prev, projects: prev.projects.map((p) => p._id === project._id ? { ...p, isPrivate } : p) }));
      toast.success(isPrivate ? `"${project.title}" is now private 🔒` : `"${project.title}" is now visible to your team 🔓`);
    } catch { toast.error('Failed to update project privacy'); }
    finally { setToggling((prev) => ({ ...prev, [project._id]: false })); }
  };

  if (loading) return (
    <div className="my-visibility-card">
      <div className="my-visibility-header"><div><div className="my-visibility-title">👁 My Visibility</div><div className="my-visibility-desc">Loading your settings…</div></div></div>
      <div className="visibility-skeleton">{[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10, marginBottom: 8 }} />)}</div>
    </div>
  );

  const hasContent = data.tasks.length > 0 || data.projects.length > 0;
  return (
    <div className="my-visibility-card">
      <div className="my-visibility-header">
        <div>
          <div className="my-visibility-title">👁 My Visibility</div>
          <div className="my-visibility-desc">Control what your teammates can see on your activity card. Private items are only visible to you.</div>
        </div>
        <div className="visibility-legend">
          <span className="visibility-legend-item"><span className="vl-icon public">🔓</span> Visible to team</span>
          <span className="visibility-legend-item"><span className="vl-icon private">🔒</span> Only you</span>
        </div>
      </div>
      {!hasContent && <div className="visibility-empty"><span>💤</span><span>No active tasks or projects to configure.</span></div>}
      {data.tasks.length > 0 && (
        <div className="visibility-section">
          <div className="visibility-section-label">🚀 In-Progress Tasks</div>
          <div className="visibility-items-list">
            {data.tasks.map((task) => (
              <div key={task._id} className={`visibility-item-row ${task.isPrivate ? 'is-private' : 'is-public'}`}>
                <div className="visibility-item-left">
                  <span className="visibility-item-dot" style={{ background: task.project?.color || 'var(--brand-primary)' }} />
                  <div className="visibility-item-info">
                    <div className="visibility-item-name">{task.title}</div>
                    {task.project && <div className="visibility-item-project" style={{ color: task.project.color }}>{task.project.title}</div>}
                  </div>
                  {task.isPrivate && <span className="privacy-badge task-badge">🔒 Private</span>}
                </div>
                <button id={`task-privacy-toggle-${task._id}`} className={`privacy-toggle-btn ${task.isPrivate ? 'btn-private' : 'btn-public'}`} onClick={() => toggleTaskPrivacy(task)} disabled={!!toggling[task._id]}>
                  {toggling[task._id] ? <span className="privacy-toggle-spinner" /> : task.isPrivate ? <><span>🔒</span><span>Private</span></> : <><span>🔓</span><span>Public</span></>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.projects.length > 0 && (
        <div className="visibility-section">
          <div className="visibility-section-label">📁 Projects</div>
          <div className="visibility-items-list">
            {data.projects.map((project) => (
              <div key={project._id} className={`visibility-item-row ${project.isPrivate ? 'is-private' : 'is-public'}`}>
                <div className="visibility-item-left">
                  <span className="visibility-item-dot" style={{ background: project.color }} />
                  <div className="visibility-item-info">
                    <div className="visibility-item-name">{project.title}</div>
                    <div className="visibility-item-project" style={{ color: 'var(--text-muted)' }}>{project.status}</div>
                  </div>
                  {project.isPrivate && <span className="privacy-badge project-badge">🔒 Private</span>}
                </div>
                <button id={`project-privacy-toggle-${project._id}`} className={`privacy-toggle-btn ${project.isPrivate ? 'btn-private' : 'btn-public'}`} onClick={() => toggleProjectPrivacy(project)} disabled={!!toggling[project._id]}>
                  {toggling[project._id] ? <span className="privacy-toggle-spinner" /> : project.isPrivate ? <><span>🔒</span><span>Private</span></> : <><span>🔓</span><span>Public</span></>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Team Page ────────────────────────────────────────────────────────────
export default function Team() {
  const { pendingRequestCount, setPendingRequestCount, registerRequestListener } = useSocket();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/team/activity');
      setActivity(res.data.data);
    } catch { toast.error('Failed to load team data'); }
    finally { setLoading(false); }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const [inRes, outRes] = await Promise.all([
        api.get('/team/requests/incoming'),
        api.get('/team/requests/outgoing'),
      ]);
      setIncomingRequests(inRes.data.data);
      setPendingRequestCount(inRes.data.data.length);
      setOutgoingRequests(outRes.data.data);
    } catch { /* silent */ }
  }, [setPendingRequestCount]);

  useEffect(() => {
    loadActivity();
    loadRequests();
  }, [loadActivity, loadRequests]);

  // Register socket listener so new requests appear instantly
  useEffect(() => {
    registerRequestListener(() => {
      loadRequests();
    });
  }, [registerRequestListener, loadRequests]);

  const handleAccept = async (req) => {
    try {
      await api.patch(`/team/requests/${req._id}/accept`);
      toast.success(`🎉 You and ${req.from.name} are now teammates!`);
      setIncomingRequests((prev) => prev.filter((r) => r._id !== req._id));
      setPendingRequestCount((c) => Math.max(0, c - 1));
      loadActivity();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to accept'); }
  };

  const handleDecline = async (req) => {
    try {
      await api.patch(`/team/requests/${req._id}/decline`);
      toast.success('Request declined');
      setIncomingRequests((prev) => prev.filter((r) => r._id !== req._id));
      setPendingRequestCount((c) => Math.max(0, c - 1));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to decline'); }
  };

  const handleCancelRequest = async (req) => {
    try {
      await api.delete(`/team/requests/${req._id}`);
      toast.success('Request cancelled');
      setOutgoingRequests((prev) => prev.filter((r) => r._id !== req._id));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to cancel'); }
  };

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from your team?`)) return;
    try {
      await api.delete(`/team/members/${userId}`);
      toast.success(`${name} removed from your team`);
      setActivity((prev) => prev.filter((m) => m.user._id !== userId));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove member'); }
  };

  const activeCount = activity.filter((m) => m.inProgressTasks?.length > 0).length;

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="team-header">
        <div className="team-header-info">
          <h1>Team</h1>
          <p>Track who's working on what, in real time</p>
          {!loading && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <span className="team-count-badge">👥 {activity.length} member{activity.length !== 1 ? 's' : ''}</span>
              {activeCount > 0 && (
                <span className="team-count-badge" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
                  🚀 {activeCount} active now
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Incoming Requests */}
      <IncomingRequestsPanel requests={incomingRequests} onAccept={handleAccept} onDecline={handleDecline} />

      {/* Outgoing Requests */}
      <OutgoingRequestsPanel requests={outgoingRequests} onCancel={handleCancelRequest} />

      {/* My Visibility */}
      <MyVisibilityPanel />

      {/* Add Member (now sends requests) */}
      <AddMemberPanel onRequestSent={loadRequests} />

      {/* Member Cards */}
      {loading ? <TeamSkeleton /> : activity.length === 0 ? (
        <div className="team-empty">
          <div className="team-empty-icon">👥</div>
          <div className="team-empty-title">Your team is empty</div>
          <p className="team-empty-desc">Search for teammates above to send them a join request. Once accepted, you'll see each other's work in real time.</p>
        </div>
      ) : (
        <div className="team-grid">
          {activity.map((memberData) => (
            <MemberCard key={memberData.user._id} memberData={memberData} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
