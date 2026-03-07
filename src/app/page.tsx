'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#FF8C42', '#6C5CE7', '#A8E6CF', '#FF85A2',
  '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6',
];

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('vo-user');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.name) setName(data.name);
        if (data.color) setColor(data.color);
        if (data.title) setTitle(data.title);
      } catch {}
    }
  }, []);

  const handleJoin = () => {
    if (!name.trim()) return;
    localStorage.setItem('vo-user', JSON.stringify({ name: name.trim(), color, title: title.trim() }));
    router.push('/office');
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <div style={{
        background: '#2d2d3d', borderRadius: 20, padding: 48, width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏢</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>Virtual Office</h1>
          <p style={{ color: '#888', marginTop: 8, fontSize: 14 }}>Walk around, talk to your team</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
            Your Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Enter your name..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10,
              border: '2px solid #3d3d4d', background: '#1a1a2e', color: '#fff',
              fontSize: 16, outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = '#6C5CE7')}
            onBlur={e => (e.target.style.borderColor = '#3d3d4d')}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
            Title (optional)
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Engineer, Designer..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10,
              border: '2px solid #3d3d4d', background: '#1a1a2e', color: '#fff',
              fontSize: 14, outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
            Avatar Color
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 36, height: 36, borderRadius: '50%', background: c,
                  border: color === c ? '3px solid #fff' : '3px solid transparent',
                  cursor: 'pointer', transition: 'transform 0.15s',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: '#fff',
              boxShadow: `0 0 20px ${color}44`,
            }}>
              {name ? name[0].toUpperCase() : '?'}
            </div>
            <span style={{ fontSize: 13, color: '#ccc' }}>{name || 'You'}</span>
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={!name.trim()}
          style={{
            width: '100%', padding: '14px 24px', borderRadius: 12,
            background: name.trim() ? 'linear-gradient(135deg, #6C5CE7, #a855f7)' : '#3d3d4d',
            color: '#fff', border: 'none', fontSize: 16, fontWeight: 600,
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Enter Office →
        </button>
      </div>
    </div>
  );
}
