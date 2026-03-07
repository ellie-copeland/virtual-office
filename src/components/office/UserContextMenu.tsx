'use client';

import { useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { getSocket } from '@/lib/socket';

interface Props {
  user: User | null;
  currentUserId: string;
  currentUser: User | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onStartDM: (userId: string) => void;
}

export default function UserContextMenu({ user, currentUserId, currentUser, position, onClose, onStartDM }: Props) {
  const [showConfirm, setShowConfirm] = useState<{ action: string; message: string } | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!position) return;
      const menu = document.getElementById('user-context-menu');
      if (menu && !menu.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [position, onClose]);

  if (!user || !position || user.id === currentUserId) return null;

  const isAdmin = currentUser?.title === 'Admin' || currentUser?.title === 'Owner';
  const socket = getSocket();

  const handleAction = (action: string) => {
    switch (action) {
      case 'dm':
        onStartDM(user.id);
        onClose();
        break;
      
      case 'follow':
        socket.emit('follow:start', { targetId: user.id });
        onClose();
        break;
      
      case 'profile':
        // This would open a user profile modal
        console.log('View profile:', user.name);
        onClose();
        break;
      
      case 'mute':
        setShowConfirm({
          action: 'mute',
          message: `Mute ${user.name}? They won't be able to speak in voice chat.`
        });
        break;
      
      case 'kick':
        setShowConfirm({
          action: 'kick',
          message: `Kick ${user.name} from the office? They can rejoin later.`
        });
        break;
    }
  };

  const handleConfirm = (confirmed: boolean) => {
    if (confirmed && showConfirm) {
      if (showConfirm.action === 'mute') {
        socket.emit('admin:mute', { targetId: user.id });
      } else if (showConfirm.action === 'kick') {
        socket.emit('admin:kick', { targetId: user.id });
      }
    }
    setShowConfirm(null);
    onClose();
  };

  const menuItems = [
    { id: 'dm', label: '💬 Send DM', icon: '💬' },
    { id: 'follow', label: '👥 Follow', icon: '👥' },
    { id: 'profile', label: '👤 View Profile', icon: '👤' },
  ];

  if (isAdmin) {
    menuItems.push(
      { id: 'mute', label: '🔇 Mute', icon: '🔇' },
      { id: 'kick', label: '🚪 Kick', icon: '🚪' }
    );
  }

  return (
    <>
      <div
        id="user-context-menu"
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          background: '#5C4A38',
          border: '2px solid #C8A850',
          borderRadius: 8,
          padding: 4,
          zIndex: 200,
          minWidth: 160,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* User header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderBottom: '1px solid #C8A850',
          marginBottom: 4
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: user.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#fff', fontWeight: 700,
          }}>
            {user.name[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ color: '#E8D8C0', fontSize: 13, fontWeight: 600 }}>
              {user.name}
            </div>
            {user.title && (
              <div style={{ color: '#D4B88A', fontSize: 11 }}>
                {user.title}
              </div>
            )}
          </div>
        </div>

        {/* Menu items */}
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleAction(item.id)}
            style={{
              width: '100%', padding: '8px 12px', background: 'transparent',
              border: 'none', color: '#E8D8C0', cursor: 'pointer',
              fontSize: 13, textAlign: 'left', borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = item.id === 'kick' ? '#8B2020' : 
                                         item.id === 'mute' ? '#C8A850' : '#6B4226';
            }}
            onMouseLeave={e => (e.target as HTMLButtonElement).style.background = 'transparent'}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#5C4A38', borderRadius: 12, padding: 24,
            width: 400, border: '2px solid #C8A850'
          }}>
            <h3 style={{ 
              color: '#E8D8C0', margin: '0 0 16px 0', 
              fontSize: 18, fontWeight: 600 
            }}>
              Confirm Action
            </h3>
            
            <p style={{ 
              color: '#D4B88A', lineHeight: 1.5, margin: '0 0 20px 0' 
            }}>
              {showConfirm.message}
            </p>
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleConfirm(false)}
                style={{
                  background: '#6B4226', color: '#E8D8C0', border: 'none',
                  borderRadius: 6, padding: '10px 16px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirm(true)}
                style={{
                  background: showConfirm.action === 'kick' ? '#8B2020' : '#C8A850',
                  color: '#E8D8C0', border: 'none',
                  borderRadius: 6, padding: '10px 16px', cursor: 'pointer'
                }}
              >
                {showConfirm.action === 'kick' ? 'Kick' : 'Mute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}