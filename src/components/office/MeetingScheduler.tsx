'use client';

import { useState } from 'react';
import { Room, ScheduledMeeting } from '@/lib/types';

interface Props {
  rooms: Room[];
  currentRoomId: string | null;
  scheduledMeetings: ScheduledMeeting[];
  onSchedule: (meeting: Omit<ScheduledMeeting, 'id'>) => void;
  onClose: () => void;
  isCalendarConnected: boolean;
  onConnectCalendar: () => void;
}

export default function MeetingScheduler({
  rooms,
  currentRoomId,
  scheduledMeetings,
  onSchedule,
  onClose,
  isCalendarConnected,
  onConnectCalendar,
}: Props) {
  const meetingRooms = rooms.filter(r => r.type === 'meeting');
  const [title, setTitle] = useState('');
  const [roomId, setRoomId] = useState(
    currentRoomId && meetingRooms.find(r => r.id === currentRoomId)
      ? currentRoomId
      : meetingRooms[0]?.id || ''
  );
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [organizer, setOrganizer] = useState('');

  const handleSubmit = () => {
    if (!title || !roomId || !date || !startTime) return;
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(start.getTime() + duration * 60000);

    const room = meetingRooms.find(r => r.id === roomId);
    const slug = room?.meetingRoom?.slug || roomId;
    const roomLink = `${window.location.origin}/office?room=${slug}`;

    onSchedule({
      title,
      roomId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      organizer: organizer || 'Anonymous',
    });

    // If calendar connected, also create calendar event
    if (isCalendarConnected) {
      fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          roomLink,
          roomName: room?.name || roomId,
        }),
      }).catch(err => console.error('Failed to create calendar event:', err));
    }

    onClose();
  };

  // Upcoming meetings for display
  const upcoming = scheduledMeetings
    .filter(m => new Date(m.endTime).getTime() > Date.now())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#1a1a3e',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 16,
        padding: 24,
        width: 480,
        maxHeight: '80vh',
        overflowY: 'auto',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>📅 Schedule Meeting</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Google Calendar connection */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13 }}>
            {isCalendarConnected ? '✅ Google Calendar connected' : '📆 Connect Google Calendar'}
          </span>
          {!isCalendarConnected && (
            <button onClick={onConnectCalendar} style={{
              background: '#4285F4',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}>
              Connect
            </button>
          )}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
              Meeting Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Sprint Planning"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
              Room
            </label>
            <select
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                outline: 'none',
              }}
            >
              {meetingRooms.map(r => (
                <option key={r.id} value={r.id} style={{ background: '#1a1a3e' }}>
                  {r.name} (capacity: {r.meetingRoom?.capacity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
              Your Name
            </label>
            <input
              value={organizer}
              onChange={e => setOrganizer(e.target.value)}
              placeholder="Your name"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
              Duration
            </label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                outline: 'none',
              }}
            >
              <option value={15} style={{ background: '#1a1a3e' }}>15 minutes</option>
              <option value={30} style={{ background: '#1a1a3e' }}>30 minutes</option>
              <option value={45} style={{ background: '#1a1a3e' }}>45 minutes</option>
              <option value={60} style={{ background: '#1a1a3e' }}>1 hour</option>
              <option value={90} style={{ background: '#1a1a3e' }}>1.5 hours</option>
              <option value={120} style={{ background: '#1a1a3e' }}>2 hours</option>
            </select>
          </div>

          <button onClick={handleSubmit} style={{
            background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 8,
          }}>
            Schedule Meeting
          </button>
        </div>

        {/* Upcoming meetings */}
        {upcoming.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 8px 0' }}>
              Upcoming Meetings
            </h3>
            {upcoming.map(m => {
              const room = meetingRooms.find(r => r.id === m.roomId);
              return (
                <div key={m.id} style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 6,
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 700 }}>{m.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {room?.name} · {new Date(m.startTime).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })} · {m.organizer}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
