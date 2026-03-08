'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GameSession, GameType } from '@/lib/game-types';

interface Props {
  socket: Socket;
  userName: string;
  userColor: string;
  onJoinGame: (session: GameSession) => void;
  onClose: () => void;
}

const GAMES: { type: GameType; name: string; icon: string; desc: string; color: string }[] = [
  { type: 'space-invaders', name: 'Space Invaders', icon: '👾', desc: 'Co-op alien blasting', color: '#00ff41' },
  { type: 'bomberman', name: 'Bomberman', icon: '💣', desc: 'Blow up your friends', color: '#ff6b35' },
  { type: 'jump-n-bump', name: "Jump 'n Bump", icon: '🐰', desc: 'Stomp heads, score points', color: '#ff69b4' },
  { type: 'zombie-survival', name: 'Zombie Survival', icon: '🧟', desc: 'PvP zombie apocalypse', color: '#2ecc71' },
];

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(4px)',
};

const modal: React.CSSProperties = {
  background: '#1a1a2e', borderRadius: 16, padding: 32, width: 520, maxHeight: '80vh',
  overflowY: 'auto', border: '1px solid #333', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};

const cardStyle = (color: string): React.CSSProperties => ({
  background: '#16213e', borderRadius: 12, padding: 20, cursor: 'pointer',
  border: '2px solid transparent', transition: 'all 0.2s',
  display: 'flex', alignItems: 'center', gap: 16,
});

export default function GameLauncher({ socket, userName, userColor, onJoinGame, onClose }: Props) {
  const [lobbies, setLobbies] = useState<GameSession[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    socket.emit('game:list', (sessions: GameSession[]) => setLobbies(sessions));
    const handler = (sessions: GameSession[]) => setLobbies(sessions);
    socket.on('game:lobby-update', handler);
    return () => { socket.off('game:lobby-update', handler); };
  }, [socket]);

  const createGame = (type: GameType) => {
    setCreating(true);
    socket.emit('game:create', { type, name: userName, color: userColor });
    socket.once('game:created', (session: GameSession) => {
      setCreating(false);
      onJoinGame(session);
    });
  };

  const joinGame = (gameId: string) => {
    socket.emit('game:join', { gameId, name: userName, color: userColor });
    const lobby = lobbies.find(l => l.id === gameId);
    if (lobby) onJoinGame(lobby);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: 22, fontFamily: 'monospace' }}>🎮 ARCADE</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#888', fontSize: 24, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* New Game */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            Start New Game
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {GAMES.map(g => (
              <div
                key={g.type}
                style={cardStyle(g.color)}
                onClick={() => !creating && createGame(g.type)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = g.color; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
              >
                <span style={{ fontSize: 36 }}>{g.icon}</span>
                <div>
                  <div style={{ color: g.color, fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>{g.name}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>{g.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: '#555', fontSize: 12 }}>2-10 players</div>
              </div>
            ))}
          </div>
        </div>

        {/* Open Lobbies */}
        {lobbies.length > 0 && (
          <div>
            <h3 style={{ color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
              Open Lobbies
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lobbies.filter(l => l.state === 'lobby').map(l => {
                const info = GAMES.find(g => g.type === l.type)!;
                return (
                  <div key={l.id} style={{
                    background: '#16213e', borderRadius: 10, padding: 14, display: 'flex',
                    alignItems: 'center', gap: 12, cursor: 'pointer', border: '1px solid #333',
                  }} onClick={() => joinGame(l.id)}>
                    <span style={{ fontSize: 24 }}>{info.icon}</span>
                    <div>
                      <div style={{ color: '#fff', fontSize: 14 }}>{info.name}</div>
                      <div style={{ color: '#888', fontSize: 12 }}>
                        Host: {l.players[0]?.name} · {l.players.length}/10 players
                      </div>
                    </div>
                    <button style={{
                      marginLeft: 'auto', background: info.color, color: '#000', border: 'none',
                      borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer',
                    }}>JOIN</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
