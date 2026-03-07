'use client';

import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameSession, GameType } from '@/lib/game-types';
import SpaceInvaders from './SpaceInvaders';
import Bomberman from './Bomberman';
import JumpNBump from './JumpNBump';

interface Props {
  socket: Socket;
  gameId: string;
  gameType: GameType;
  onClose: () => void;
}

export default function GameOverlay({ socket, gameId, gameType, onClose }: Props) {
  const handleLeave = useCallback(() => {
    socket.emit('game:leave', { gameId });
    onClose();
  }, [socket, gameId, onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 250,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 40,
        background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', borderBottom: '1px solid #333',
      }}>
        <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 13 }}>
          {gameType === 'space-invaders' ? '👾 Space Invaders' :
           gameType === 'bomberman' ? '💣 Bomberman' : '🐰 Jump \'n Bump'}
        </span>
        <button onClick={handleLeave} style={{
          background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6,
          padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
        }}>✕ LEAVE</button>
      </div>

      {/* Game canvas area */}
      <div style={{ marginTop: 40 }}>
        {gameType === 'space-invaders' && <SpaceInvaders socket={socket} gameId={gameId} />}
        {gameType === 'bomberman' && <Bomberman socket={socket} gameId={gameId} />}
        {gameType === 'jump-n-bump' && <JumpNBump socket={socket} gameId={gameId} />}
      </div>
    </div>
  );
}
