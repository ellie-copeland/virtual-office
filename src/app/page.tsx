'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#FF8C42', '#6C5CE7', '#A8E6CF', '#FF85A2',
  '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6',
];

type AuthMode = 'login' | 'register';

export default function LandingPage() {
  const router = useRouter();
  
  // Auth state
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user has valid token
    const token = localStorage.getItem('vo-token');
    if (token) {
      // Validate token by trying to connect
      router.push('/office');
      return;
    }

    // Legacy: check if user has old format data
    const saved = localStorage.getItem('vo-user');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.name) setName(data.name);
        if (data.color) setColor(data.color);
        if (data.title) setTitle(data.title);
      } catch {}
    }
  }, [router]);

  const handleAuth = async () => {
    if (loading) return;
    
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' 
        ? { email, password }
        : { name: name.trim(), email, password, color, title: title.trim() };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success && result.token) {
        localStorage.setItem('vo-token', result.token);
        localStorage.setItem('vo-user-data', JSON.stringify(result.user));
        router.push('/office');
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (mode === 'login') {
      return email.trim() && password.trim();
    }
    return email.trim() && password.trim() && name.trim();
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

        {/* Mode Toggle */}
        <div style={{ display: 'flex', marginBottom: 24, background: '#1a1a2e', borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setMode('login')}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: mode === 'login' ? '#6C5CE7' : 'transparent',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: mode === 'register' ? '#6C5CE7' : 'transparent',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Register
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#ff444444', border: '1px solid #ff4444', borderRadius: 8,
            padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#ffaaaa',
          }}>
            {error}
          </div>
        )}

        {/* Name field (register only) */}
        {mode === 'register' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
              Your Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
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
        )}

        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10,
              border: '2px solid #3d3d4d', background: '#1a1a2e', color: '#fff',
              fontSize: 16, outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = '#6C5CE7')}
            onBlur={e => (e.target.style.borderColor = '#3d3d4d')}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="Enter your password..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10,
              border: '2px solid #3d3d4d', background: '#1a1a2e', color: '#fff',
              fontSize: 16, outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = '#6C5CE7')}
            onBlur={e => (e.target.style.borderColor = '#3d3d4d')}
          />
        </div>

        {/* Title (register only) */}
        {mode === 'register' && (
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
        )}

        {/* Avatar Color (register only) */}
        {mode === 'register' && (
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
        )}

        {/* Preview (register only) */}
        {mode === 'register' && (
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
        )}

        <button
          onClick={handleAuth}
          disabled={!isFormValid() || loading}
          style={{
            width: '100%', padding: '14px 24px', borderRadius: 12,
            background: isFormValid() && !loading ? 'linear-gradient(135deg, #6C5CE7, #a855f7)' : '#3d3d4d',
            color: '#fff', border: 'none', fontSize: 16, fontWeight: 600,
            cursor: isFormValid() && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {loading ? '...' : mode === 'login' ? 'Login' : 'Create Account'} →
        </button>
      </div>
    </div>
  );
}
