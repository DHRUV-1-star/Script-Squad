import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children, user }) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Pending team requests count (incoming)
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  // Total unread chat messages count
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Callbacks that other components can register
  const onChatMessageRef = useRef(null);
  const onRequestReceivedRef = useRef(null);
  const onTypingRef = useRef(null);

  const registerChatListener = useCallback((fn) => { onChatMessageRef.current = fn; }, []);
  const registerRequestListener = useCallback((fn) => { onRequestReceivedRef.current = fn; }, []);
  const registerTypingListener = useCallback((fn) => { onTypingRef.current = fn; }, []);

  const refreshPendingCount = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('ss_token');
      const res = await fetch('/api/team/requests/incoming', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPendingRequestCount(data.data.length);
    } catch { /* silent */ }
  }, [user]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('ss_token');
      const res = await fetch('/api/chat/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUnreadChatCount(data.data);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => {
    if (!user) {
      // Clean up on logout
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setPendingRequestCount(0);
      setUnreadChatCount(0);
      return;
    }

    // Initial data fetch
    refreshPendingCount();
    refreshUnreadCount();

    // Connect socket
    const socket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-user-room', user._id);
    });

    socket.on('disconnect', () => setIsConnected(false));

    // ── Incoming team join request ──────────────────────────────────────────
    socket.on('team-request-received', ({ request }) => {
      setPendingRequestCount((c) => c + 1);
      toast.custom((t) => (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '0.875rem 1.125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: 340,
            opacity: t.visible ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>👋</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
              Team Request
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              <strong>{request.from?.name}</strong> wants to join your team
            </div>
          </div>
        </div>
      ), { duration: 5000 });
      if (onRequestReceivedRef.current) onRequestReceivedRef.current(request);
    });

    // ── Request accepted / declined ─────────────────────────────────────────
    socket.on('team-request-responded', ({ status, by }) => {
      if (status === 'accepted') {
        toast.success(`🎉 ${by.name} accepted your team request!`, { duration: 5000 });
      } else {
        toast(`😔 ${by.name} declined your team request`, { icon: '❌', duration: 4000 });
      }
    });

    // ── Incoming chat message ───────────────────────────────────────────────
    socket.on('chat-message', (message) => {
      setUnreadChatCount((c) => c + 1);
      // Only show toast if the chat callback hasn't consumed it
      if (onChatMessageRef.current) {
        onChatMessageRef.current(message);
      } else {
        toast.custom((t) => (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '0.875rem 1.125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: 340,
              opacity: t.visible ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>💬</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                {message.from?.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {message.content}
              </div>
            </div>
          </div>
        ), { duration: 4000 });
      }
    });

    // ── Typing indicator ────────────────────────────────────────────────────
    socket.on('chat-typing', (data) => {
      if (onTypingRef.current) onTypingRef.current(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('team-request-received');
      socket.off('team-request-responded');
      socket.off('chat-message');
      socket.off('chat-typing');
      socket.disconnect();
    };
  }, [user, refreshPendingCount, refreshUnreadCount]);

  const emitTyping = useCallback((toUserId, isTyping) => {
    if (socketRef.current && user) {
      socketRef.current.emit('chat-typing', { toUserId, fromUserId: user._id, isTyping });
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      isConnected,
      pendingRequestCount,
      setPendingRequestCount,
      unreadChatCount,
      setUnreadChatCount,
      refreshPendingCount,
      refreshUnreadCount,
      registerChatListener,
      registerRequestListener,
      registerTypingListener,
      emitTyping,
    }}>
      {children}
    </SocketContext.Provider>
  );
};
