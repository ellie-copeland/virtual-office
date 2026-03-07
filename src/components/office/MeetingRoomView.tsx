'use client';

import { useEffect, useRef, useState } from 'react';
import { User, Room, MeetingRoomState } from '@/lib/types';

interface Props {
  room: Room;
  roomState: MeetingRoomState | null;
  users: User[];
  currentUserId: string;
  remoteStreams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
  onCopyLink: () => void;
}

export default function MeetingRoomView({
  room, roomState, users, currentUserId,
  remoteStreams, localStream,
  isMuted, isCameraOn, isScreenSharing,
  onToggleMic, onToggleCamera, onToggleScreenShare,
  onLeaveRoom, onCopyLink,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  // Timer
  useEffect(() => {
    const start = roomState?.meetingStartedAt || Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [roomState?.meetingStartedAt]);

  const roomUsers = users.filter(u => u.roomId === room.id);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  const handleCopyLink = () => {
    const slug = room.id || room.name.toLowerCase().replace(/\s+/g, '-');
    const url = `${window.location.origin}/office?room=${slug}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
    width: 48, height: 48, borderRadius: 24, border: 'none',
    background: active ? color : '#3d3d4d', color: '#fff',
    cursor: 'pointer', fontSize: 20, display: 'flex',
    alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#111122', zIndex: 180,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        height: 56, background: '#1a1a2e', display: 'flex', alignItems: 'center',
        padding: '0 20px', justifyContent: 'space-between', borderBottom: '1px solid #333',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🏢</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{room.name}</span>
          <span style={{ color: '#888', fontSize: 13 }}>{roomUsers.length} participant{roomUsers.length !== 1 ? 's' : ''}</span>
          <span style={{ color: '#6C5CE7', fontSize: 13, fontFamily: 'monospace' }}>
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleCopyLink} style={{
            background: linkCopied ? '#4CAF50' : '#3d3d4d', color: '#fff', border: 'none',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
          }}>
            {linkCopied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
          <button onClick={onLeaveRoom} style={{
            background: '#e74c3c', color: '#fff', border: 'none',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Leave Room</button>
        </div>
      </div>

      {/* Video grid */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: roomUsers.length <= 1 ? '1fr' :
          roomUsers.length <= 4 ? 'repeat(2, 1fr)' :
          roomUsers.length <= 9 ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
        gap: 8, padding: 16, overflow: 'auto',
      }}>
        {roomUsers.map(user => {
          const isMe = user.id === currentUserId;
          const stream = isMe ? localStream : remoteStreams.get(user.id);
          return (
            <VideoTile
              key={user.id}
              user={user}
              stream={stream || null}
              isLocal={isMe}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div style={{
        height: 72, background: '#1a1a2e', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 12, borderTop: '1px solid #333',
      }}>
        <button onClick={onToggleMic} style={btnStyle(!isMuted, '#4CAF50')} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button onClick={onToggleCamera} style={btnStyle(isCameraOn, '#4CAF50')} title="Toggle camera">
          {isCameraOn ? '📹' : '📷'}
        </button>
        <button onClick={onToggleScreenShare} style={btnStyle(isScreenSharing, '#2196F3')} title="Screen share">
          🖥️
        </button>
        <div style={{ width: 1, height: 32, background: '#333', margin: '0 8px' }} />
        <button onClick={onLeaveRoom} style={btnStyle(false, '#e74c3c')}>
          <span style={{ color: '#e74c3c' }}>📞</span>
        </button>
      </div>
    </div>
  );
}

function VideoTile({ user, stream, isLocal }: { user: User; stream: MediaStream | null; isLocal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      background: '#222233', borderRadius: 12, overflow: 'hidden', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180,
      border: user.isSpeaking ? `2px solid #4CAF50` : '2px solid transparent',
    }}>
      {stream && stream.getVideoTracks().length > 0 ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1)' : 'none',
          }}
        />
      ) : (
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: user.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, color: '#fff', fontWeight: 700,
        }}>
          {user.name[0]?.toUpperCase() || '?'}
        </div>
      )}

      {/* Name badge */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 13,
        padding: '4px 10px', borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {user.isMuted && <span style={{ fontSize: 11 }}>🔇</span>}
        <span>{user.name}</span>
        {isLocal && <span style={{ color: '#888', fontSize: 11 }}>(You)</span>}
      </div>
    </div>
  );
}
