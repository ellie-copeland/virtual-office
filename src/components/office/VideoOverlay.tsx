'use client';

import { useEffect, useRef } from 'react';
import { User, TILE_SIZE } from '@/lib/types';

interface Props {
  users: User[];
  currentUserId: string;
  remoteStreams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  cameraOffset: { x: number; y: number };
  volumes?: Record<string, number>;
}

export default function VideoOverlay({ users, currentUserId, remoteStreams, localStream, cameraOffset, volumes = {} }: Props) {
  // Show video bubbles for nearby users with cameras on
  const nearbyUsers = users.filter(u => {
    if (u.id === currentUserId && !localStream) return false;
    if (u.id !== currentUserId && !u.isCameraOn) return false;
    const me = users.find(uu => uu.id === currentUserId);
    if (!me) return false;
    if (u.id === currentUserId) return localStream !== null;
    const dx = u.position.x - me.position.x;
    const dy = u.position.y - me.position.y;
    return Math.sqrt(dx * dx + dy * dy) < 8;
  });

  // Audio-only users (unmuted, no camera, nearby)
  const audioOnlyUsers = users.filter(u => {
    if (u.id === currentUserId) return false;
    if (u.isCameraOn) return false; // already handled by video
    if (u.isMuted) return false;
    const me = users.find(uu => uu.id === currentUserId);
    if (!me) return false;
    const dx = u.position.x - me.position.x;
    const dy = u.position.y - me.position.y;
    return Math.sqrt(dx * dx + dy * dy) < 8 && remoteStreams.has(u.id);
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      {/* Video bubbles */}
      {nearbyUsers.map(user => {
        const stream = user.id === currentUserId ? localStream : remoteStreams.get(user.id);
        if (!stream) return null;
        const isLocal = user.id === currentUserId;
        return (
          <VideoBubble
            key={user.id}
            stream={stream}
            user={user}
            cameraOffset={cameraOffset}
            isLocal={isLocal}
            volume={isLocal ? 0 : (volumes[user.id] ?? 1)}
          />
        );
      })}

      {/* Hidden audio elements for all remote streams (ensures audio plays) */}
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
        <RemoteAudio key={peerId} stream={stream} volume={volumes[peerId] ?? 1} />
      ))}
    </div>
  );
}

function RemoteAudio({ stream, volume }: { stream: MediaStream; volume: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [stream, volume]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

function VideoBubble({ stream, user, cameraOffset, isLocal, volume }: {
  stream: MediaStream; user: User; cameraOffset: { x: number; y: number }; isLocal: boolean; volume: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const screenX = user.position.x * TILE_SIZE - cameraOffset.x + (typeof window !== 'undefined' ? window.innerWidth / 2 : 400);
  const screenY = user.position.y * TILE_SIZE - cameraOffset.y + (typeof window !== 'undefined' ? window.innerHeight / 2 : 300) - 80;

  return (
    <div style={{
      position: 'absolute', left: screenX - 40, top: screenY - 40,
      width: 80, height: 80, pointerEvents: 'auto',
    }}>
      <video
        ref={videoRef}
        autoPlay
        muted={isLocal} // Only mute local preview to prevent echo
        playsInline
        style={{
          width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
          border: `3px solid ${user.color}`,
          boxShadow: user.isSpeaking ? `0 0 12px ${user.color}` : '0 4px 12px rgba(0,0,0,0.4)',
          transform: isLocal ? 'scaleX(-1)' : 'none',
        }}
      />
      <div style={{
        position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, padding: '2px 6px',
        borderRadius: 4, whiteSpace: 'nowrap',
      }}>{user.name}</div>
    </div>
  );
}
