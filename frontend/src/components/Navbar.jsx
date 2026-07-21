import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import './Navbar.css';

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your work' },
  '/projects': { title: 'Projects', subtitle: 'Manage all your projects' },
  '/analytics': { title: 'Analytics', subtitle: 'Insights & productivity trends' },
  '/team': { title: 'Team', subtitle: 'Manage your team' },
  '/chat': { title: 'Chat', subtitle: 'Message your teammates' },
};

export default function Navbar() {
  const { toggleTheme, isDark } = useTheme();
  const { user } = useAuth();
  const { pendingRequestCount } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const pageKey = Object.keys(PAGE_TITLES).find((k) => location.pathname.startsWith(k)) || '/dashboard';
  const { title, subtitle } = PAGE_TITLES[pageKey] || { title: 'Script Squad', subtitle: '' };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div>
          <h1 className="navbar-title">{title}</h1>
          <p className="navbar-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="navbar-right">
        {/* Date display */}
        <div className="navbar-date">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>

        {/* Team request notification bell */}
        <button
          id="team-notifications-btn"
          className="navbar-bell btn-icon"
          onClick={() => navigate('/team')}
          title={pendingRequestCount > 0 ? `${pendingRequestCount} pending team request${pendingRequestCount > 1 ? 's' : ''}` : 'Team requests'}
          aria-label="Team notifications"
        >
          <span className="bell-icon">🔔</span>
          {pendingRequestCount > 0 && (
            <span className="bell-badge">{pendingRequestCount > 9 ? '9+' : pendingRequestCount}</span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          id="theme-toggle"
          className="theme-toggle btn-icon"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          <span className="theme-icon">{isDark ? '☀️' : '🌙'}</span>
        </button>

        {/* User avatar */}
        {user && (
          <div className="navbar-avatar avatar">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              user.name?.[0]?.toUpperCase()
            )}
          </div>
        )}
      </div>
    </header>
  );
}
