'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, User } from '@/lib/types';

type Tab = 'global' | 'proximity' | 'room' | 'dm';

interface Props {
  isOpen: boolean;
  messages: ChatMessage[];
  currentUserId: string;
  currentRoomId: string | null;
  users: User[];
  onSend: (content: string, channel: Tab, recipientId?: string) => void;
}

export default function ChatPanel({ isOpen, messages, currentUserId, currentRoomId, users, onSend }: Props) {
  const [tab, setTab] = useState<Tab>('global');
  const [input, setInput] = useState('');
  const [dmTarget, setDmTarget] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = messages.filter(m => {
    if (tab === 'global') return m.channel === 'global';
    if (tab === 'room') return m.channel === 'room' && m.roomId === currentRoomId;
    if (tab === 'proximity') return m.channel === 'proximity';
    if (tab === 'dm') return m.channel === 'dm' && (m.senderId === currentUserId || m.recipientId === currentUserId);
    return true;
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim(), tab, tab === 'dm' ? dmTarget || undefined : undefined);
    setInput('');
  };

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'global', label: '🌍 Global' },
    { id: 'proximity', label: '📍 Nearby' },
    { id: 'room', label: '🚪 Room' },
    { id: 'dm', label: '✉️ DM' },
  ];

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 72, width: 340,
      background: '#2d2d3d', borderLeft: '1px solid #3d3d4d',
      display: 'flex', flexDirection: 'column', zIndex: 90,
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3d3d4d' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 4px', background: tab === t.id ? '#3d3d4d' : 'transparent',
              color: tab === t.id ? '#fff' : '#888', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* DM target selector */}
      {tab === 'dm' && (
        <select
          value={dmTarget || ''}
          onChange={e => setDmTarget(e.target.value || null)}
          style={{
            margin: 8, padding: 8, background: '#1a1a2e', color: '#fff',
            border: '1px solid #3d3d4d', borderRadius: 8, fontSize: 13,
          }}
        >
          <option value="">Select user...</option>
          {users.filter(u => u.id !== currentUserId).map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {filtered.length === 0 && (
          <div style={{ color: '#666', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
            No messages yet
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
      </div>

      {/* Input */}
      <div style={{
        padding: 12, borderTop: '1px solid #3d3d4d',
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={`Message ${tab}...`}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            background: '#1a1a2e', color: '#fff', border: '1px solid #3d3d4d',
            fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '10px 16px', borderRadius: 10, background: '#6C5CE7',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
