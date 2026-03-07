'use client';

import { useEffect, useState } from 'react';
import { User, ChatMessage, ScheduledMeeting, Room } from '@/lib/types';
import { getSocket } from '@/lib/socket';

interface Toast {
  id: string;
  type: 'dm' | 'user_entered' | 'meeting_starting' | 'meeting_reminder';
  title: string;
  message: string;
  icon: string;
  timestamp: number;
  actionable?: boolean;
  roomId?: string;
  userId?: string;
}

interface Props {
  users: User[];
  currentUserId: string;
  messages: ChatMessage[];
  meetings: ScheduledMeeting[];
  rooms: Room[];
  onNavigate?: (roomId?: string, userId?: string) => void;
}

export default function NotificationToast({ users, currentUserId, messages, meetings, rooms, onNavigate }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastMessageId, setLastMessageId] = useState<string>('');
  const [usersInRoom, setUsersInRoom] = useState<Set<string>>(new Set());

  const currentUser = users.find(u => u.id === currentUserId);
  const currentRoomId = currentUser?.roomId;

  // Track users entering the current room
  useEffect(() => {
    if (!currentRoomId) {
      setUsersInRoom(new Set());
      return;
    }

    const currentRoomUsers = new Set(users.filter(u => u.roomId === currentRoomId && u.id !== currentUserId).map(u => u.id));
    const previousUsers = usersInRoom;

    // Check for new users entering the room
    currentRoomUsers.forEach(userId => {
      if (!previousUsers.has(userId)) {
        const user = users.find(u => u.id === userId);
        if (user) {
          const room = rooms.find(r => r.id === currentRoomId);
          addToast({
            type: 'user_entered',
            title: 'Someone joined',
            message: `${user.name} entered ${room?.name || 'the room'}`,
            icon: '👋',
            userId: user.id,
            roomId: currentRoomId,
          });
        }
      }
    });

    setUsersInRoom(currentRoomUsers);
  }, [users, currentUserId, currentRoomId, rooms, usersInRoom]);

  // Check for new DM messages
  useEffect(() => {
    const latestDM = messages
      .filter(m => m.channel === 'dm' && m.recipientId === currentUserId && m.senderId !== currentUserId)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestDM && latestDM.id !== lastMessageId) {
      setLastMessageId(latestDM.id);
      
      addToast({
        type: 'dm',
        title: 'New Direct Message',
        message: `${latestDM.senderName}: ${latestDM.content.substring(0, 50)}${latestDM.content.length > 50 ? '...' : ''}`,
        icon: '💬',
        userId: latestDM.senderId,
      });
    }
  }, [messages, currentUserId, lastMessageId]);

  // Check for upcoming meetings
  useEffect(() => {
    const checkMeetings = () => {
      const now = new Date();
      const in5Minutes = new Date(now.getTime() + 5 * 60 * 1000);
      const in1Minute = new Date(now.getTime() + 1 * 60 * 1000);

      meetings.forEach(meeting => {
        const startTime = new Date(meeting.startTime);
        const room = rooms.find(r => r.id === meeting.roomId);
        
        // 5 minute warning
        if (startTime > now && startTime <= in5Minutes) {
          const existing = toasts.find(t => t.id === `meeting-5-${meeting.id}`);
          if (!existing) {
            addToast({
              type: 'meeting_reminder',
              title: 'Meeting starting soon',
              message: `"${meeting.title}" starts in 5 minutes in ${room?.name || 'a meeting room'}`,
              icon: '⏰',
              roomId: meeting.roomId,
            }, `meeting-5-${meeting.id}`);
          }
        }
        
        // 1 minute warning
        if (startTime > now && startTime <= in1Minute) {
          const existing = toasts.find(t => t.id === `meeting-1-${meeting.id}`);
          if (!existing) {
            addToast({
              type: 'meeting_starting',
              title: 'Meeting starting now!',
              message: `"${meeting.title}" is starting in ${room?.name || 'a meeting room'}`,
              icon: '🏃‍♂️',
              roomId: meeting.roomId,
            }, `meeting-1-${meeting.id}`);
          }
        }
      });
    };

    const interval = setInterval(checkMeetings, 30000); // Check every 30 seconds
    checkMeetings(); // Initial check

    return () => clearInterval(interval);
  }, [meetings, rooms, toasts]);

  const addToast = (toast: Omit<Toast, 'id' | 'timestamp' | 'actionable'>, customId?: string) => {
    const id = customId || `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = {
      ...toast,
      id,
      timestamp: Date.now(),
      actionable: true,
    };

    setToasts(prev => [newToast, ...prev]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleToastClick = (toast: Toast) => {
    if (onNavigate && toast.actionable) {
      onNavigate(toast.roomId, toast.userId);
    }
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 150,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      pointerEvents: 'none', // Allow clicks through the container
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => handleToastClick(toast)}
          style={{
            background: 'linear-gradient(135deg, #2d2d3d 0%, #1a1a2e 100%)',
            border: '1px solid #4d4d5d',
            borderRadius: 12,
            padding: 16,
            minWidth: 300,
            maxWidth: 400,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            cursor: toast.actionable ? 'pointer' : 'default',
            pointerEvents: 'auto',
            animation: 'slideInRight 0.3s ease-out',
            transition: 'transform 0.15s ease',
            transform: 'translateX(0)',
          }}
          onMouseEnter={e => {
            if (toast.actionable) {
              (e.target as HTMLElement).style.transform = 'translateX(-4px)';
            }
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.transform = 'translateX(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>
              {toast.icon}
            </span>
            
            <div style={{ flex: 1 }}>
              <div style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 4,
              }}>
                {toast.title}
              </div>
              
              <div style={{
                color: '#ddd',
                fontSize: 13,
                lineHeight: 1.4,
              }}>
                {toast.message}
              </div>

              {toast.actionable && (
                <div style={{
                  color: '#6C5CE7',
                  fontSize: 11,
                  marginTop: 8,
                  fontWeight: 500,
                }}>
                  Click to navigate →
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 16,
                padding: 4,
                lineHeight: 1,
                borderRadius: 4,
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.target as HTMLButtonElement).style.color = '#fff'}
              onMouseLeave={e => (e.target as HTMLButtonElement).style.color = '#888'}
            >
              ×
            </button>
          </div>

          {/* Progress bar for auto-dismiss */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'rgba(108, 92, 231, 0.2)',
            borderRadius: '0 0 12px 12px',
          }}>
            <div style={{
              height: '100%',
              background: '#6C5CE7',
              borderRadius: '0 0 12px 12px',
              animation: 'progressBar 5s linear',
              transformOrigin: 'left',
            }} />
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes progressBar {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>
    </div>
  );
}