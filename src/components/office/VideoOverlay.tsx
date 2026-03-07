'use client';

import { useEffect, useRef } from 'react';
import { User, TILE_SIZE } from '@/lib/types';

interface Props {
  users: User[];
  currentUserId: string;
  remoteStreams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  cameraOffset: { x: number; y: number };
  volumes?: Map<string, number>;
}

export default function VideoOverlay({ users, currentUserId, remoteStreams, localStream, cameraOffset, volumes }: Props) {
  const me = users.find(u => u.id === currentUserId);

  // Collect users who have camera/screen on and are nearby
  const nearbyUsers = users.filter(u => {
    if (!u.isCameraOn && !u.isScreenSharing) return false;
    if (!me) return false;
    const dx = u.position.x - me.position.x;
    const dy = u.position.y - me.position.y;
    return Math.sqrt(dx * dx + dy * dy) < 8;
  });

  // Also render audio-only elements for remote streams with audio but no video display
  const audioOnlyUsers = Array.from(remoteStreams.entries()).filter(([uid]) => {
    // Not already shown as video bubble
    return !nearbyUsers.find(u => u.id === uid);
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      {nearbyUsers.map(user => {
        const isLocal = user.id === currentUserId;
        const stream = isLocal ? localStream : remoteStreams.get(user.id);
        if (!stream) return null;
        const screenX = user.position.x * TILE_SIZE - cameraOffset.x;
        const screenY = user.position.y * TILE_SIZE - cameraOffset.y - 80;
        return (
          <VideoBubble
            key={user.id}
            stream={stream}
            x={screenX}
            y={screenY}
            name={user.name}
            color={user.color}
            isLocal={isLocal}
            isScreenShare={user.isScreenSharing ?? false}
            volume={volumes?.get(user.id) ?? 1}
          />
        );
      })}
      {/* Hidden audio elements for remote users who have audio but no video bubble shown */}
      {audioOnlyUsers.map(([uid, stream]) => (
        <AudioOnly
          key={`audio-${uid}`}
          stream={stream}
          volume={volumes?.get(uid) ?? 1}
        />
      ))}
    </div>
  );
}

function AudioOnly({ stream, volume }: { stream: MediaStream; volume: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

function VideoBubble({ stream, x, y, name, color, isLocal, isScreenShare, volume }: {
  stream: MediaStream; x: number; y: number; name: string; color: string;
  isLocal: boolean; isScreenShare: boolean; volume: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    // For remote streams, also attach audio separately to control volume
    if (!isLocal && audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, isLocal]);

  useEffect(() => {
    if (!isLocal && audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume, isLocal]);

  const size = isScreenShare ? 200 : 80;

  return (
    <div style={{
      position: 'absolute', left: x - size / 2, top: y - size / 2,
      width: size, height: size, pointerEvents: 'auto',
    }}>
      <video
        ref={videoRef}
        autoPlay
        muted={true}  /* Always mute the video element; audio handled separately */
        playsInline
        style={{
          width: size, height: size,
          borderRadius: isScreenShare ? 8 : '50%',
          objectFit: 'cover',
          border: `3px solid ${color}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}
      />
      {/* Separate audio element for remote streams so we can control volume */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      )}
    </div>
  );
}
