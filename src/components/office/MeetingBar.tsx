'use client';

import { useState, useEffect, useCallback } from 'react';
import { Room, User, MeetingRoomState, ScheduledMeeting } from '@/lib/types';

interface Props {
  room: Room;
  users: User[];
  currentUserId: string;
  meetingState: MeetingRoomState | null;
  scheduledMeetings: ScheduledMeeting[];
  onLeaveRoom: () => void;
  onSchedule: () => void;
}

export default function MeetingBar({
  room,
  users,
  currentUserId,
  meetingState,
  scheduledMeetings,
  onLeaveRoom,
  onSchedule,
}: Props) {
  const [elapsed, setElapsed] = useState('00:00');
  const [copied, setCopied] = useState(false);

  // Timer
  useEffect(() => {
    if (!meetingState?.meetingStartedAt) return;
    const interval = setInterval(() => {
      const diff = Date.now() - meetingState.meetingStartedAt!;
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingState?.meetingStartedAt]);

  const occupants = meetingState?.occupants || [];
  const occupantUsers = users.filter(u => occupants.includes(u.id));
  const capacity = room.meetingRoom?.capacity || 0;

  const handleCopyLink = useCallback(() => {
    const slug = room.meetingRoom?.slug || room.id;
    const url = `${window.location.origin}/office?room=${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [room]);

  const roomMeetings = scheduledMeetings
    .filter(m => m.roomId === room.id)
    .filter(m => new Date(m.endTime).getTime() > Date.now())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const nextMeeting = roomMeetings[0];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      background: 'linear-gradient(135deg, #1a1a3e 0%, #2d1b69 100%)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderTop: 'none',
      borderRadius: '0 0 16px 16px',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      minWidth: 500,
    }}>
      {/* Room name & capacity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          📍 {room.name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          {occupants.length}/{capacity} people
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.15)' }} />

      {/* Participant avatars */}
      <div style={{ display: 'flex', gap: -4, alignItems: 'center' }}>
        {occupantUsers.slice(0, 8).map((u, i) => (
          <div key={u.id} style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: u.color,
            border: u.id === currentUserId ? '2px solid #4CAF50' : '2px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            marginLeft: i > 0 ? -6 : 0,
            zIndex: 10 - i,
          }}>
            {u.name[0]?.toUpperCase()}
          </div>
        ))}
        {occupants.length > 8 && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 10, marginLeft: -6,
          }}>
            +{occupants.length - 8}
          </div>
        )}
      </div>

      {/* Timer */}
      <div style={{
        fontFamily: 'monospace',
        fontSize: 16,
        fontWeight: 700,
        color: '#4CAF50',
        minWidth: 50,
        textAlign: 'center',
      }}>
        ⏱ {elapsed}
      </div>

      {/* Next meeting */}
      {nextMeeting && (
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.6)',
          maxWidth: 120,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          📅 {nextMeeting.title} @ {new Date(nextMeeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        style={{
          background: copied ? '#4CAF50' : 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          color: '#fff',
          padding: '6px 12px',
          fontSize: 12,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {copied ? '✓ Copied!' : '🔗 Copy Link'}
      </button>

      {/* Schedule */}
      <button
        onClick={onSchedule}
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          color: '#fff',
          padding: '6px 12px',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        📅 Schedule
      </button>

      {/* Leave Room */}
      <button
        onClick={onLeaveRoom}
        style={{
          background: '#f44336',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        🚪 Leave Room
      </button>
    </div>
  );
}
