import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import './Chat.css';

// ── Format timestamp ──────────────────────────────────────────────────────────
function formatMsgTime(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function ChatAvatar({ user, size = 40, online = false }) {
  const initials = user?.name?.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="chat-avatar-wrap" style={{ width: size, height: size }}>
      <div className="chat-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {user?.avatar ? <img src={user.avatar} alt={user.name} /> : initials}
      </div>
      {online && <span className="chat-online-dot" />}
    </div>
  );
}

// ── Conversation list item ────────────────────────────────────────────────────
function ConversationItem({ conv, isActive, onClick }) {
  const { user, lastMessage, unreadCount } = conv;
  const timeStr = lastMessage ? formatMsgTime(lastMessage.createdAt) : '';

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <ChatAvatar user={user} size={44} />
      <div className="conv-info">
        <div className="conv-name-row">
          <span className="conv-name">{user.name}</span>
          {timeStr && <span className="conv-time">{timeStr}</span>}
        </div>
        <div className="conv-preview-row">
          <span className="conv-preview">
            {lastMessage ? lastMessage.content : <em>No messages yet</em>}
          </span>
          {unreadCount > 0 && (
            <span className="conv-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine }) {
  return (
    <div className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && (
        <div className="chat-avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0, alignSelf: 'flex-end' }}>
          {msg.from?.avatar ? <img src={msg.from.avatar} alt={msg.from.name} /> : msg.from?.name?.[0]?.toUpperCase()}
        </div>
      )}
      <div className={`message-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
        <div className="bubble-content">{msg.content}</div>
        <div className="bubble-time">{formatMsgTime(msg.createdAt)}</div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function ChatEmpty() {
  return (
    <div className="chat-main-empty">
      <div className="chat-empty-icon">💬</div>
      <div className="chat-empty-title">Your Team Chat</div>
      <div className="chat-empty-desc">
        Select a teammate from the left to start a conversation. Messages are delivered in real time.
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="message-row theirs">
      <div className="typing-indicator">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ── Main Chat Page ────────────────────────────────────────────────────────────
export default function Chat() {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { registerChatListener, registerTypingListener, emitTyping, setUnreadChatCount } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // remote user is typing
  const typingTimer = useRef(null);
  const localTypingTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load conversations ───────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data.data);
    } catch { toast.error('Failed to load conversations'); }
    finally { setConvLoading(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Open chat with a user (from URL param or click) ──────────────────────
  const openChat = useCallback(async (chatUser) => {
    setActiveUser(chatUser);
    navigate(`/chat/${chatUser._id}`, { replace: true });
    setMsgLoading(true);
    setMessages([]);
    try {
      const res = await api.get(`/chat/messages/${chatUser._id}`);
      setMessages(res.data.data);
      // Mark as read
      await api.patch(`/chat/messages/${chatUser._id}/read`);
      // Update conversations unread count
      setConversations((prev) =>
        prev.map((c) => c.user._id === chatUser._id ? { ...c, unreadCount: 0 } : c)
      );
      // Refresh global unread badge
      const countRes = await api.get('/chat/unread-count');
      setUnreadChatCount(countRes.data.data);
    } catch { toast.error('Failed to load messages'); }
    finally { setMsgLoading(false); }
  }, [navigate, setUnreadChatCount]);

  // Open from URL param on mount
  useEffect(() => {
    if (routeUserId && conversations.length > 0 && !activeUser) {
      const conv = conversations.find((c) => c.user._id === routeUserId);
      if (conv) openChat(conv.user);
    }
  }, [routeUserId, conversations, activeUser, openChat]);

  // ── Auto-scroll to bottom ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Register socket listeners ────────────────────────────────────────────
  useEffect(() => {
    registerChatListener((message) => {
      const fromId = message.from?._id || message.from;
      // If we're in the conversation with this sender, add message immediately
      if (activeUser && fromId === activeUser._id) {
        setMessages((prev) => [...prev, message]);
        // Mark as read right away
        api.patch(`/chat/messages/${fromId}/read`).catch(() => {});
        setConversations((prev) =>
          prev.map((c) => c.user._id === fromId ? { ...c, lastMessage: message, unreadCount: 0 } : c)
        );
      } else {
        // Not in this conversation — update sidebar unread badge
        setConversations((prev) =>
          prev.map((c) =>
            c.user._id === fromId
              ? { ...c, lastMessage: message, unreadCount: (c.unreadCount || 0) + 1 }
              : c
          )
        );
        setUnreadChatCount((c) => c + 1);
      }
    });
  }, [activeUser, registerChatListener, setUnreadChatCount]);

  // ── Typing indicator ─────────────────────────────────────────────────────
  useEffect(() => {
    registerTypingListener(({ fromUserId, isTyping: typing }) => {
      if (activeUser && fromUserId === activeUser._id) {
        setIsTyping(typing);
        clearTimeout(typingTimer.current);
        if (typing) {
          typingTimer.current = setTimeout(() => setIsTyping(false), 3000);
        }
      }
    });
  }, [activeUser, registerTypingListener]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!inputText.trim() || !activeUser || sending) return;
    const content = inputText.trim();
    setInputText('');
    setSending(true);
    // Stop typing signal
    emitTyping(activeUser._id, false);
    try {
      const res = await api.post('/chat/messages', { to: activeUser._id, content });
      const newMsg = res.data.data;
      setMessages((prev) => [...prev, newMsg]);
      setConversations((prev) =>
        prev.map((c) => c.user._id === activeUser._id ? { ...c, lastMessage: newMsg } : c)
      );
    } catch { toast.error('Failed to send message'); setInputText(content); }
    finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!activeUser) return;
    emitTyping(activeUser._id, true);
    clearTimeout(localTypingTimer.current);
    localTypingTimer.current = setTimeout(() => emitTyping(activeUser._id, false), 2000);
  };

  // Group messages by date
  const groupedMessages = [];
  let lastDate = null;
  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const dateLabel = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy');
    if (dateLabel !== lastDate) {
      groupedMessages.push({ type: 'divider', label: dateLabel, key: `div-${msg._id}` });
      lastDate = dateLabel;
    }
    groupedMessages.push({ type: 'message', msg, key: msg._id });
  }

  return (
    <div className="chat-layout">
      {/* ── Left: Conversations sidebar ── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2 className="chat-sidebar-title">💬 Messages</h2>
          <span className="chat-sidebar-count">{conversations.length} teammate{conversations.length !== 1 ? 's' : ''}</span>
        </div>

        {convLoading ? (
          <div className="chat-sidebar-loading">
            {[1,2,3,4].map((i) => (
              <div key={i} className="conv-skeleton">
                <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 6, borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '80%', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="chat-sidebar-empty">
            <span>👥</span>
            <span>No teammates yet. Add team members first.</span>
          </div>
        ) : (
          <div className="conversations-list">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.user._id}
                conv={conv}
                isActive={activeUser?._id === conv.user._id}
                onClick={() => openChat(conv.user)}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ── Right: Chat window ── */}
      <main className="chat-main">
        {!activeUser ? (
          <ChatEmpty />
        ) : (
          <>
            {/* Chat header */}
            <div className="chat-main-header">
              <ChatAvatar user={activeUser} size={40} />
              <div className="chat-main-header-info">
                <div className="chat-main-name">{activeUser.name}</div>
                <div className="chat-main-email">{activeUser.email}</div>
              </div>
            </div>

            {/* Messages area */}
            <div className="messages-area" id="messages-area">
              {msgLoading ? (
                <div className="messages-loading">
                  <div className="spinner spinner-lg" />
                </div>
              ) : messages.length === 0 ? (
                <div className="messages-empty">
                  <span>👋</span>
                  <span>Say hello to <strong>{activeUser.name}</strong>!</span>
                </div>
              ) : (
                <>
                  {groupedMessages.map((item) =>
                    item.type === 'divider' ? (
                      <div key={item.key} className="date-divider">
                        <span className="date-divider-label">{item.label}</span>
                      </div>
                    ) : (
                      <MessageBubble
                        key={item.key}
                        msg={item.msg}
                        isMine={item.msg.from?._id === user?._id || item.msg.from === user?._id}
                      />
                    )
                  )}
                  {isTyping && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input area */}
            <div className="chat-input-area">
              <textarea
                id="chat-message-input"
                ref={inputRef}
                className="chat-input"
                placeholder={`Message ${activeUser.name}…`}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                id="chat-send-btn"
                className="chat-send-btn"
                onClick={sendMessage}
                disabled={!inputText.trim() || sending}
                title="Send (Enter)"
              >
                {sending ? <div className="spinner spinner-sm" /> : '➤'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
