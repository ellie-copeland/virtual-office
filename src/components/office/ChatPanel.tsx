'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, User } from '@/lib/types';
import { getSocket } from '@/lib/socket';

type Tab = 'global' | 'proximity' | 'room' | 'dm';

interface Props {
  isOpen: boolean;
  messages: ChatMessage[];
  currentUserId: string;
  currentRoomId: string | null;
  users: User[];
  onSend: (content: string, channel: Tab, recipientId?: string) => void;
}

interface TypingState {
  [userId: string]: {
    timestamp: number;
    recipientId?: string;
  };
}

interface UnreadCounts {
  global: number;
  proximity: number;
  room: number;
  dm: { [userId: string]: number };
}

export default function ChatPanel({ isOpen, messages, currentUserId, currentRoomId, users, onSend }: Props) {
  const [tab, setTab] = useState<Tab>('global');
  const [input, setInput] = useState('');
  const [dmTarget, setDmTarget] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingState>({});
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    global: 0,
    proximity: 0,
    room: 0,
    dm: {}
  });
  const [lastSeenMessages, setLastSeenMessages] = useState<{ [channel: string]: number }>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-switch to room chat when entering a room
  useEffect(() => {
    if (currentRoomId && tab !== 'dm') {
      setTab('room');
    }
  }, [currentRoomId, tab]);

  // Socket listeners for typing and DM read events
  useEffect(() => {
    const socket = getSocket();
    
    const handleTyping = (data: { userId: string; recipientId?: string }) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.userId]: { timestamp: Date.now(), recipientId: data.recipientId }
      }));
    };

    const handleDMRead = (data: { messageId: string }) => {
      // Mark DM as read - handled by message filtering
    };

    socket.on('typing', handleTyping);
    socket.on('dm:read', handleDMRead);

    return () => {
      socket.off('typing', handleTyping);
      socket.off('dm:read', handleDMRead);
    };
  }, []);

  // Clean up expired typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const filtered: TypingState = {};
        Object.entries(prev).forEach(([userId, data]) => {
          if (now - data.timestamp < 3000) { // 3 second timeout
            filtered[userId] = data;
          }
        });
        return filtered;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update unread counts when messages change
  useEffect(() => {
    const newCounts: UnreadCounts = { global: 0, proximity: 0, room: 0, dm: {} };
    
    messages.forEach(msg => {
      if (msg.senderId === currentUserId) return; // Don't count own messages
      
      const lastSeen = lastSeenMessages[msg.channel + (msg.recipientId || msg.roomId || '')] || 0;
      if (msg.timestamp > lastSeen) {
        if (msg.channel === 'global') newCounts.global++;
        else if (msg.channel === 'proximity') newCounts.proximity++;
        else if (msg.channel === 'room' && msg.roomId === currentRoomId) newCounts.room++;
        else if (msg.channel === 'dm' && (msg.recipientId === currentUserId || msg.senderId === currentUserId)) {
          const otherUserId = msg.recipientId === currentUserId ? msg.senderId : msg.recipientId;
          if (otherUserId) newCounts.dm[otherUserId] = (newCounts.dm[otherUserId] || 0) + 1;
        }
      }
    });
    
    setUnreadCounts(newCounts);
  }, [messages, lastSeenMessages, currentUserId, currentRoomId]);

  // Mark messages as read when tab changes or panel opens
  useEffect(() => {
    if (isOpen) {
      const key = tab + (dmTarget || currentRoomId || '');
      setLastSeenMessages(prev => ({ ...prev, [key]: Date.now() }));
    }
  }, [isOpen, tab, dmTarget, currentRoomId]);

  const filtered = messages.filter(m => {
    if (tab === 'global') return m.channel === 'global';
    if (tab === 'room') return m.channel === 'room' && m.roomId === currentRoomId;
    if (tab === 'proximity') return m.channel === 'proximity';
    if (tab === 'dm') {
      return m.channel === 'dm' && (
        (m.senderId === currentUserId && m.recipientId === dmTarget) ||
        (m.recipientId === currentUserId && m.senderId === dmTarget) ||
        (!dmTarget && (m.senderId === currentUserId || m.recipientId === currentUserId))
      );
    }
    return true;
  });

  // Get typing users for current context
  const currentTypingUsers = Object.entries(typingUsers).filter(([userId, data]) => {
    if (userId === currentUserId) return false;
    if (tab === 'dm') return data.recipientId === currentUserId;
    return !data.recipientId; // Room/global/proximity typing
  }).map(([userId]) => users.find(u => u.id === userId)?.name).filter(Boolean);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim(), tab, tab === 'dm' ? dmTarget || undefined : undefined);
    setInput('');
    setShowEmojiPicker(false);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    
    // Send typing indicator
    const socket = getSocket();
    clearTimeout(typingTimeoutRef.current);
    
    if (value.trim()) {
      socket.emit('typing', { 
        userId: currentUserId, 
        recipientId: tab === 'dm' ? dmTarget : undefined 
      });
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { 
          userId: currentUserId, 
          recipientId: tab === 'dm' ? dmTarget : undefined 
        });
      }, 2500);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  const getTabLabel = (tabId: Tab) => {
    let unreadCount = 0;
    if (tabId === 'global') unreadCount = unreadCounts.global;
    else if (tabId === 'proximity') unreadCount = unreadCounts.proximity;
    else if (tabId === 'room') unreadCount = unreadCounts.room;
    else if (tabId === 'dm') unreadCount = Object.values(unreadCounts.dm).reduce((a, b) => a + b, 0);

    const labels = {
      global: '🌍 Global',
      proximity: '📍 Nearby', 
      room: '🚪 Room',
      dm: '✉️ DM'
    };

    return unreadCount > 0 ? `${labels[tabId]} (${unreadCount})` : labels[tabId];
  };

  const emojis = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '💯', '👀', '😅', '😎', '🤗', '😴'];

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 136, width: 340,
      background: '#2d2d3d', borderLeft: '1px solid #3d3d4d',
      display: 'flex', flexDirection: 'column', zIndex: 90,
    }}>
      {/* Tabs with unread badges */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3d3d4d' }}>
        {(['global', 'proximity', 'room', 'dm'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 4px', background: tab === t ? '#3d3d4d' : 'transparent',
              color: tab === t ? '#fff' : '#888', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, transition: 'all 0.15s', position: 'relative',
            }}
          >
            {getTabLabel(t)}
          </button>
        ))}
      </div>

      {/* DM target selector with unread indicators */}
      {tab === 'dm' && (
        <div style={{ padding: 8 }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#aaa' }}>Direct Messages:</div>
          {users.filter(u => u.id !== currentUserId).map(u => {
            const unreadCount = unreadCounts.dm[u.id] || 0;
            return (
              <div
                key={u.id}
                onClick={() => setDmTarget(u.id)}
                style={{
                  padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                  background: dmTarget === u.id ? '#3d3d4d' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  border: unreadCount > 0 ? '1px solid #6C5CE7' : '1px solid transparent',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: u.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#fff', fontWeight: 700, flexShrink: 0,
                }}>
                  {u.name[0]?.toUpperCase()}
                </div>
                <span style={{ color: '#fff', fontSize: 13, flex: 1 }}>{u.name}</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: '#6C5CE7', color: '#fff', fontSize: 10, 
                    padding: '2px 6px', borderRadius: '10px', minWidth: 16, textAlign: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {filtered.length === 0 && (
          <div style={{ color: '#666', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
            {tab === 'dm' && !dmTarget ? 'Select a user to start chatting' : 'No messages yet'}
          </div>
        )}
        {filtered.map(m => (
          <div key={m.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: m.senderColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0,
              }}>
                {m.senderName[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: m.senderColor }}>
                {m.senderName}
              </span>
              <span style={{ fontSize: 10, color: '#666' }}>
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#ddd', marginLeft: 26, lineHeight: 1.4 }}>
              {m.content}
            </div>
          </div>
        ))}
        
        {/* Typing indicators */}
        {currentTypingUsers.length > 0 && (
          <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 8 }}>
            {currentTypingUsers.join(', ')} {currentTypingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div style={{
          position: 'absolute', bottom: 70, right: 12, background: '#3d3d4d',
          border: '1px solid #4d4d5d', borderRadius: 8, padding: 8,
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4,
          zIndex: 100,
        }}>
          {emojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => insertEmoji(emoji)}
              style={{
                padding: 8, background: 'transparent', border: 'none',
                cursor: 'pointer', fontSize: 18, borderRadius: 4,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.target as HTMLButtonElement).style.background = '#4d4d5d'}
              onMouseLeave={e => (e.target as HTMLButtonElement).style.background = 'transparent'}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input with emoji button */}
      <div style={{
        padding: 12, borderTop: '1px solid #3d3d4d',
        display: 'flex', gap: 8,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={tab === 'dm' && !dmTarget ? 'Select a user first...' : `Message ${tab}...`}
          disabled={tab === 'dm' && !dmTarget}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            background: '#1a1a2e', color: '#fff', border: '1px solid #3d3d4d',
            fontSize: 13, outline: 'none',
            opacity: tab === 'dm' && !dmTarget ? 0.5 : 1,
          }}
        />
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          style={{
            padding: '10px 12px', borderRadius: 10, background: showEmojiPicker ? '#6C5CE7' : '#4d4d5d',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14,
          }}
        >
          😀
        </button>
        <button
          onClick={handleSend}
          disabled={!input.trim() || (tab === 'dm' && !dmTarget)}
          style={{
            padding: '10px 16px', borderRadius: 10, 
            background: (!input.trim() || (tab === 'dm' && !dmTarget)) ? '#4d4d5d' : '#6C5CE7',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14,
            opacity: (!input.trim() || (tab === 'dm' && !dmTarget)) ? 0.5 : 1,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
