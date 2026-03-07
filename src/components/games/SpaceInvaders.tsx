'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { SIState } from '@/lib/game-types';

interface Props {
  socket: Socket;
  gameId: string;
}

const W = 600, H = 450;
const COLORS = ['#00ff41', '#ff6b35', '#00bfff', '#ff69b4', '#ffff00', '#ff4444', '#44ffff', '#aa44ff', '#ff8800', '#88ff44'];

export default function SpaceInvaders({ socket, gameId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SIState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const handler = ({ gameId: gid, state }: { gameId: string; state: SIState }) => {
      if (gid === gameId) stateRef.current = state;
    };
    socket.on('game:state', handler);
    return () => { socket.off('game:state', handler); };
  }, [socket, gameId]);

  // Input
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Send input at 30fps
  useEffect(() => {
    const interval = setInterval(() => {
      const keys = keysRef.current;
      socket.emit('game:input', {
        gameId,
        input: {
          left: keys.has('ArrowLeft') || keys.has('a'),
          right: keys.has('ArrowRight') || keys.has('d'),
          shoot: keys.has(' ') || keys.has('ArrowUp'),
        },
      });
    }, 33);
    return () => clearInterval(interval);
  }, [socket, gameId]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      const st = stateRef.current;
      if (!st) {
        ctx.fillStyle = '#888';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for game state...', W / 2, H / 2);
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

      // Stars
      ctx.fillStyle = '#333';
      for (let i = 0; i < 50; i++) {
        const sx = ((i * 137 + frameRef.current * 0.1) % W);
        const sy = (i * 73) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Aliens
      for (const a of st.aliens) {
        if (!a.alive) continue;
        const colors = ['#00ff41', '#ffff00', '#ff0000'];
        ctx.fillStyle = colors[a.type];
        // Pixel alien shape
        const s = 10;
        if (a.type === 0) {
          // Basic invader
          ctx.fillRect(a.x - s, a.y - s/2, s*2, s);
          ctx.fillRect(a.x - s*1.2, a.y - s, s*0.5, s*0.5);
          ctx.fillRect(a.x + s*0.7, a.y - s, s*0.5, s*0.5);
          ctx.fillRect(a.x - s*0.5, a.y + s*0.5, s*0.4, s*0.4);
          ctx.fillRect(a.x + s*0.1, a.y + s*0.5, s*0.4, s*0.4);
        } else if (a.type === 1) {
          // Mid invader
          ctx.fillRect(a.x - s, a.y - s*0.6, s*2, s*1.2);
          ctx.fillRect(a.x - s*1.3, a.y, s*0.5, s*0.5);
          ctx.fillRect(a.x + s*0.8, a.y, s*0.5, s*0.5);
        } else {
          // Boss invader
          ctx.fillRect(a.x - s*1.2, a.y - s*0.8, s*2.4, s*1.6);
          ctx.fillRect(a.x - s*0.5, a.y - s*1.2, s, s*0.4);
        }
      }

      // Bullets
      for (const b of st.bullets) {
        ctx.fillStyle = b.dy < 0 ? '#00ff41' : '#ff4444';
        ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8);
        // Glow
        ctx.shadowColor = b.dy < 0 ? '#00ff41' : '#ff4444';
        ctx.shadowBlur = 6;
        ctx.fillRect(b.x - 1, b.y - 3, 2, 6);
        ctx.shadowBlur = 0;
      }

      // Players
      const playerIds = Object.keys(st.players);
      playerIds.forEach((pid, idx) => {
        const p = st.players[pid];
        if (!p.alive) return;
        const color = COLORS[idx % COLORS.length];
        ctx.fillStyle = color;
        // Ship shape
        ctx.beginPath();
        ctx.moveTo(p.x, 405);
        ctx.lineTo(p.x - 14, 425);
        ctx.lineTo(p.x + 14, 425);
        ctx.closePath();
        ctx.fill();
        // Engine glow
        ctx.fillStyle = color + '66';
        ctx.fillRect(p.x - 3, 425, 6, 4);
      });

      // HUD
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px monospace';
      playerIds.forEach((pid, idx) => {
        const p = st.players[pid];
        const color = COLORS[idx % COLORS.length];
        ctx.fillStyle = color;
        const marker = pid === socket.id ? '► ' : '  ';
        ctx.fillText(`${marker}P${idx + 1}: ${p.score}`, 10, 20 + idx * 18);
      });

      ctx.textAlign = 'right';
      ctx.fillStyle = '#888';
      ctx.font = '12px monospace';
      ctx.fillText(`LEVEL ${st.level}`, W - 10, 20);

      // Game over
      if (st.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        const topPlayer = playerIds.reduce((a, b) => st.players[a].score > st.players[b].score ? a : b);
        ctx.fillText(`Top Score: ${st.players[topPlayer].score}`, W / 2, H / 2 + 20);
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [socket]);

  return (
    <div>
      <canvas ref={canvasRef} width={W} height={H} style={{
        border: '2px solid #00ff41', borderRadius: 4, imageRendering: 'pixelated',
      }} />
      <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8, fontFamily: 'monospace' }}>
        ← → Move · SPACE Shoot
      </div>
    </div>
  );
}
