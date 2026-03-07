'use client';

import { useEffect, useRef } from 'react';
import { User, TILE_SIZE } from '@/lib/types';

interface Props {
  users: User[];
  currentUserId: string;
  remoteStreams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  cameraOffset: { x: number; y: number };
}

export default function VideoOverlay({ users, currentUserId, remoteStreams, localStream, cameraOffset }: Props) {
  const nearbyUsers = users.filter(u => {
    if (!u.isCameraOn) return false;
    const me = users.find(uu => uu.id === currentUserId);
    if (!me) return false;
    const dx = u.position.x - me.position.x;
    const dy = u.position.y - me.position.y;
    return Math.sqrt(dx * dx + dy * dy) < 8;
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      {nearbyUsers.map(user => {
        const stream = user.id === currentUserId ? localStream : remoteStreams.get(user.id);
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
          />
        );
      })}
    </div>
  );
}

function VideoBubble({ stream, x, y, name, color }: {
  stream: MediaStream; x: number; y: number; name: string; color: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      position: 'absolute', left: x - 40, top: y - 40,
      width: 80, height: 80, pointerEvents: 'auto',
    }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
          border: `3px solid ${color}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}
