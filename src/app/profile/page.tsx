'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#FF8C42', '#6C5CE7', '#A8E6CF', '#FF85A2',
  '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6',
];

interface UserData {
  id: string;
  name: string;
  email: string;
  color: string;
  title?: string;
  avatar?: string;
  role: 'admin' | 'member';
  settings: {
    defaultMuted: boolean;
    defaultCamera: boolean;
    theme?: 'light' | 'dark';
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [defaultMuted, setDefaultMuted] = useState(true);
  const [defaultCamera, setDefaultCamera] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('vo-token');
    if (!token) {
      router.push('/');
      return;
    }

    // Load user data
    const userDataStr = localStorage.getItem('vo-user-data');
    if (userDataStr) {
      try {
        const data = JSON.parse(userDataStr) as UserData;
        setUserData(data);
        setName(data.name || '');
        setTitle(data.title || '');
        setColor(data.color || AVATAR_COLORS[0]);
        setDefaultMuted(data.settings.defaultMuted);
        setDefaultCamera(data.settings.defaultCamera);
        setTheme(data.settings.theme || 'dark');
      } catch (err) {
        console.error('Error loading user data:', err);
      }
    }
  }, [router]);

  const handleSave = async () => {
    if (!userData || loading) return;
    
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const token = localStorage.getItem('vo-token');
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          color,
          settings: {
            defaultMuted,
            defaultCamera,
            theme,
          }
        }),
      });

      const result = await response.json();

      if (result.success && result.user) {
        localStorage.setItem('vo-user-data', JSON.stringify(result.user));
        setUserData(result.user);
        setMessage('Profile updated successfully!');
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vo-token');
    localStorage.removeItem('vo-user-data');
    router.push('/');
  };

  if (!userData) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#1a1a2e', color: '#fff',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: '#2d2d3d', borderRadius: 20, padding: 48, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>👤</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>Profile Settings</h1>
          <p style={{ color: '#888', marginTop: 8, fontSize: 14 }}>
            {userData.email} • {userData.role === 'admin' ? 'Admin' : 'Member'}
          </p>
        </div>

        {/* Success/Error Messages */}
        {message && (
          <div style={{
            background: '#22c55e44', border: '1px solid #22c55e', borderRadius: 8,
            padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#86efac',
          }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{
            background: '#ef444444', border: '1px solid #ef4444', borderRadius: 8,
            padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#fca5a5',
          }}>
            {error}
          </div>
        )}

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
            Display Name
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

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa', fontWeight: 500 }}>
            Job Title
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
            onFocus={e => (e.target.style.borderColor = '#6C5CE7')}
            onBlur={e => (e.target.style.borderColor = '#3d3d4d')}
          />
        </div>

        {/* Avatar Color */}
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

        {/* Settings */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', marginBottom: 16, fontSize: 15, color: '#fff', fontWeight: 600 }}>
            Default Settings
          </label>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: '#ccc' }}>Start muted</span>
            <button
              onClick={() => setDefaultMuted(!defaultMuted)}
              style={{
                width: 48, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: defaultMuted ? '#6C5CE7' : '#3d3d4d', position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2, transition: 'left 0.2s',
                left: defaultMuted ? 26 : 2,
              }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: '#ccc' }}>Start with camera on</span>
            <button
              onClick={() => setDefaultCamera(!defaultCamera)}
              style={{
                width: 48, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: defaultCamera ? '#6C5CE7' : '#3d3d4d', position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2, transition: 'left 0.2s',
                left: defaultCamera ? 26 : 2,
              }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: '#ccc' }}>Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '2px solid #3d3d4d',
                background: '#1a1a2e', color: '#fff', fontSize: 14, outline: 'none',
              }}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        {/* Avatar Preview */}
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
            <span style={{ fontSize: 11, color: '#888' }}>{title}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={!name.trim() || loading}
            style={{
              flex: 1, padding: '14px 24px', borderRadius: 12,
              background: name.trim() && !loading ? 'linear-gradient(135deg, #6C5CE7, #a855f7)' : '#3d3d4d',
              color: '#fff', border: 'none', fontSize: 16, fontWeight: 600,
              cursor: name.trim() && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button
            onClick={() => router.push('/office')}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 10,
              background: 'transparent', color: '#6C5CE7', border: '2px solid #6C5CE7',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            Back to Office
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 10,
              background: 'transparent', color: '#ff4444', border: '2px solid #ff4444',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}