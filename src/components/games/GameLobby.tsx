'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GameSession, GamePlayer } from '@/lib/game-types';

interface Props {
  socket: Socket;
  session: GameSession;
  onStart: () => void;
  onLeave: () => void;
}

const GAME_NAMES: Record<string, { name: string; icon: string; color: string }> = {
  'space-invaders': { name: 'Space Invaders', icon: '👾', color: '#00ff41' },
  'bomberman': { name: 'Bomberman', icon: '💣', color: '#ff6b35' },
  'jump-n-bump': { name: "Jump 'n Bump", icon: '🐰', color: '#ff69b4' },
};

export default function GameLobby({ socket, session, onStart, onLeave }: Props) {
  const [players, setPlayers] = useState<GamePlayer[]>(session.players);
  const isHost = session.hostId === socket.id;
  const info = GAME_NAMES[session.type];

  useEffect(() => {
    const onJoined = ({ gameId, players: p }: any) => {
      if (gameId === session.id) setPlayers(p);
    };
    const onLeft = ({ gameId, players: p }: any) => {
      if (gameId === session.id) setPlayers(p);
    };
    socket.on('game:player-joined', onJoined);
    socket.on('game:player-left', onLeft);
    return () => {
      socket.off('game:player-joined', onJoined);
      socket.off('game:player-left', onLeft);
    };
  }, [socket, session.id]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a2e', borderRadius: 16, padding: 32, width: 400,
        border: `2px solid ${info.color}`, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{info.icon}</div>
        <h2 style={{ color: info.color, fontFamily: 'monospace', margin: '0 0 24px' }}>{info.name}</h2>

        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            Players ({players.length}/10)
          </div>
          {players.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: '#16213e', borderRadius: 8, marginBottom: 6,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color }} />
              <span style={{ color: '#fff', fontSize: 14 }}>{p.name}</span>
              {p.id === session.hostId && <span style={{ color: '#ffd700', fontSize: 11, marginLeft: 'auto' }}>HOST</span>}
            </div>
          ))}
        </div>

        {!isHost && (
          <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Waiting for host to start...</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onLeave} style={{
            background: '#333', color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 20px', cursor: 'pointer', fontSize: 14,
          }}>Leave</button>
          {isHost && (
            <button onClick={() => {
              socket.emit('game:start', { gameId: session.id });
              onStart();
            }} style={{
              background: info.color, color: '#000', border: 'none', borderRadius: 10,
              padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            }}>START GAME</button>
          )}
        </div>
      </div>
    </div>
  );
}
