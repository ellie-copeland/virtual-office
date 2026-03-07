'use client';

import { useState, useRef, useEffect } from 'react';
import { User, UserStatus, Room } from '@/lib/types';
import { getSocket } from '@/lib/socket';

interface Props {
  users: User[];
  currentUserId: string;
  currentRoom: Room | null;
  isMuted: boolean;
  isCameraOn: boolean;
  onStatusMessageChange: (message: string) => void;
}

const statusOptions: { id: UserStatus; label: string; icon: string; color: string }[] = [
  { id: 'available', label: 'Available', icon: '🟢', color: '#28a745' },
  { id: 'busy', label: 'Busy', icon: '🔴', color: '#dc3545' },
  { id: 'away', label: 'Away', icon: '🟡', color: '#ffc107' },
  { id: 'dnd', label: 'Do Not Disturb', icon: '⛔', color: '#6f42c1' },
  { id: 'ghost', label: 'Ghost Mode', icon: '👻', color: '#6c757d' },
];

export default function StatusBar({ users, currentUserId, currentRoom, isMuted, isCameraOn, onStatusMessageChange }: Props) {
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  
  const statusInputRef = useRef<HTMLInputElement>(null);
  const currentUser = users.find(u => u.id === currentUserId);
  
  // Count nearby users (within same room or proximity)
  const nearbyUsers = users.filter(u => {
    if (u.id === currentUserId) return false;
    if (currentRoom && u.roomId === currentRoom.id) return true;
    
    // Check proximity for users not in rooms
    if (!u.roomId && !currentUser?.roomId) {
      const dx = u.position.x - (currentUser?.position.x || 0);
      const dy = u.position.y - (currentUser?.position.y || 0);
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 5; // Within 5 tiles
    }
    
    return false;
  });

  useEffect(() => {
    if (currentUser?.statusMessage) {
      setStatusMessage(currentUser.statusMessage);
    }
  }, [currentUser?.statusMessage]);

  useEffect(() => {
    if (isEditingStatus && statusInputRef.current) {
      statusInputRef.current.focus();
    }
  }, [isEditingStatus]);

  const handleStatusChange = (status: UserStatus) => {
    const socket = getSocket();
    socket.emit('status', status);
    setShowStatusPicker(false);
  };

  const handleStatusMessageSubmit = () => {
    onStatusMessageChange(statusMessage);
    setIsEditingStatus(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStatusMessageSubmit();
    } else if (e.key === 'Escape') {
      setStatusMessage(currentUser?.statusMessage || '');
      setIsEditingStatus(false);
    }
  };

  const currentStatus = statusOptions.find(s => s.id === currentUser?.status) || statusOptions[0];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 64,
      background: 'linear-gradient(180deg, #6B4226 0%, #4A3828 100%)',
      borderTop: '2px solid #C8A850',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      zIndex: 80,
      boxShadow: '0 -2px 8px rgba(0,0,0,0.2)',
    }}>
      {/* Current Room */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>
            {currentRoom ? '🚪' : '🌍'}
          </span>
          <div>
            <div style={{ color: '#E8D8C0', fontSize: 13, fontWeight: 600 }}>
              {currentRoom?.name || 'Open Area'}
            </div>
            <div style={{ color: '#D4B88A', fontSize: 11 }}>
              {nearbyUsers.length} {nearbyUsers.length === 1 ? 'person' : 'people'} nearby
            </div>
          </div>
        </div>
      </div>

      {/* Media Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>
            {isMuted ? '🔇' : '🎤'}
          </span>
          <span style={{ color: '#D4B88A', fontSize: 11 }}>
            {isMuted ? 'Muted' : 'Mic On'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>
            {isCameraOn ? '📹' : '📷'}
          </span>
          <span style={{ color: '#D4B88A', fontSize: 11 }}>
            {isCameraOn ? 'Camera On' : 'Camera Off'}
          </span>
        </div>
      </div>

      {/* Status Message */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', maxWidth: 400, margin: '0 auto' }}>
        {isEditingStatus ? (
          <input
            ref={statusInputRef}
            value={statusMessage}
            onChange={e => setStatusMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleStatusMessageSubmit}
            placeholder="Set your status message..."
            style={{
              background: '#5C4A38',
              border: '1px solid #C8A87A',
              borderRadius: 16,
              padding: '6px 12px',
              color: '#E8D8C0',
              fontSize: 13,
              outline: 'none',
              width: '100%',
              maxWidth: 300,
            }}
          />
        ) : (
          <button
            onClick={() => setIsEditingStatus(true)}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 16,
              padding: '6px 12px',
              color: statusMessage ? '#E8D8C0' : '#D4B88A',
              fontSize: 13,
              cursor: 'pointer',
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.target as HTMLButtonElement).style.border = '1px solid #C8A850'}
            onMouseLeave={e => (e.target as HTMLButtonElement).style.border = '1px solid transparent'}
          >
            {statusMessage || 'Click to set status message...'}
          </button>
        )}
      </div>

      {/* Quick Status Picker */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowStatusPicker(!showStatusPicker)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: '1px solid #C8A87A',
            borderRadius: 20,
            padding: '8px 12px',
            color: '#E8D8C0',
            cursor: 'pointer',
            fontSize: 13,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.target as HTMLButtonElement).style.background = '#C8A850'}
          onMouseLeave={e => (e.target as HTMLButtonElement).style.background = 'transparent'}
        >
          <span>{currentStatus.icon}</span>
          <span>{currentStatus.label}</span>
          <span style={{ fontSize: 10, transform: showStatusPicker ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
            ▼
          </span>
        </button>

        {showStatusPicker && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 8,
            background: '#5C4A38',
            border: '2px solid #C8A850',
            borderRadius: 8,
            padding: 4,
            minWidth: 160,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            {statusOptions.map(status => (
              <button
                key={status.id}
                onClick={() => handleStatusChange(status.id)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: currentUser?.status === status.id ? '#C8A850' : 'transparent',
                  border: 'none',
                  color: '#E8D8C0',
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (currentUser?.status !== status.id) {
                    (e.target as HTMLButtonElement).style.background = '#6B4226';
                  }
                }}
                onMouseLeave={e => {
                  if (currentUser?.status !== status.id) {
                    (e.target as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                <span>{status.icon}</span>
                <span>{status.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}