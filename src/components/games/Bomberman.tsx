'use client';

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { BMState } from '@/lib/game-types';

interface Props {
  socket: Socket;
  gameId: string;
}

const TILE = 36;
const COLORS = ['#00bfff', '#ff6b35', '#00ff41', '#ff69b4', '#ffff00', '#ff4444', '#44ffff', '#aa44ff', '#ff8800', '#88ff44'];

export default function Bomberman({ socket, gameId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<BMState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const handler = ({ gameId: gid, state }: { gameId: string; state: BMState }) => {
      if (gid === gameId) stateRef.current = state;
    };
    socket.on('game:state', handler);
    return () => { socket.off('game:state', handler); };
  }, [socket, gameId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keysRef.current.add(e.key); if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const keys = keysRef.current;
      const bomb = keys.has(' ');
      if (bomb) keys.delete(' '); // one-shot
      socket.emit('game:input', {
        gameId,
        input: {
          left: keys.has('ArrowLeft') || keys.has('a'),
          right: keys.has('ArrowRight') || keys.has('d'),
          up: keys.has('ArrowUp') || keys.has('w'),
          down: keys.has('ArrowDown') || keys.has('s'),
          bomb,
        },
      });
    }, 50);
    return () => clearInterval(interval);
  }, [socket, gameId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const st = stateRef.current;
      const gw = st?.gridW || 13;
      const gh = st?.gridH || 11;
      const W = gw * TILE;
      const H = gh * TILE;
      canvas.width = W;
      canvas.height = H;

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, W, H);

      if (!st) {
        ctx.fillStyle = '#888';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting...', W / 2, H / 2);
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Grid
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const cell = st.grid[y][x];
          const px = x * TILE, py = y * TILE;
          if (cell === 'wall') {
            ctx.fillStyle = '#4a4a6a';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#3a3a5a';
            ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          } else if (cell === 'brick') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.strokeStyle = '#6B3410';
            ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
            // Brick pattern
            ctx.fillStyle = '#6B3410';
            ctx.fillRect(px + TILE/2 - 0.5, py, 1, TILE);
            ctx.fillRect(px, py + TILE/2 - 0.5, TILE, 1);
          } else if (cell === 'empty') {
            ctx.fillStyle = '#222244';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#1d1d3d';
            ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          } else if (cell.startsWith('powerup-')) {
            ctx.fillStyle = '#222244';
            ctx.fillRect(px, py, TILE, TILE);
            // Powerup icon
            const icon = cell === 'powerup-bomb' ? '💣' : cell === 'powerup-fire' ? '🔥' : '⚡';
            ctx.font = `${TILE * 0.6}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(icon, px + TILE / 2, py + TILE * 0.7);
          }
        }
      }

      // Explosions
      for (const e of st.explosions) {
        const px = e.x * TILE, py = e.y * TILE;
        const alpha = e.timer / 8;
        ctx.fillStyle = `rgba(255, ${100 + e.timer * 15}, 0, ${alpha})`;
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.5})`;
        ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      }

      // Bombs
      for (const b of st.bombs) {
        const px = b.x * TILE + TILE / 2, py = b.y * TILE + TILE / 2;
        const pulse = 1 + Math.sin(Date.now() / 100) * 0.1;
        const r = TILE * 0.35 * pulse;
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        // Fuse
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py - r);
        ctx.lineTo(px + 4, py - r - 6);
        ctx.stroke();
        // Spark
        if (b.timer < 15) {
          ctx.fillStyle = '#ffff00';
          ctx.beginPath();
          ctx.arc(px + 4, py - r - 8, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Players
      const playerIds = Object.keys(st.players);
      playerIds.forEach((pid, idx) => {
        const p = st.players[pid];
        if (!p.alive) return;
        const px = p.x * TILE + TILE / 2;
        const py = p.y * TILE + TILE / 2;
        const color = COLORS[idx % COLORS.length];

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py - 2, TILE * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(px - 5, py - 6, 4, 4);
        ctx.fillRect(px + 1, py - 6, 4, 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(px - 4, py - 5, 2, 2);
        ctx.fillRect(px + 2, py - 5, 2, 2);

        // "You" indicator
        if (pid === socket.id) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(px, py - TILE * 0.5 - 8);
          ctx.lineTo(px - 4, py - TILE * 0.5 - 2);
          ctx.lineTo(px + 4, py - TILE * 0.5 - 2);
          ctx.closePath();
          ctx.fill();
        }
      });

      // HUD
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px monospace';
      playerIds.forEach((pid, idx) => {
        const p = st.players[pid];
        const color = COLORS[idx % COLORS.length];
        ctx.fillStyle = p.alive ? color : '#555';
        const marker = pid === socket.id ? '► ' : '  ';
        const status = p.alive ? `${p.score} kills` : '💀';
        ctx.fillText(`${marker}P${idx + 1}: ${status}`, 4, W + 16 + idx * 16);
      });

      // Game over
      if (st.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff6b35';
        ctx.font = 'bold 32px monospace';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
        if (st.winnerId) {
          const wi = playerIds.indexOf(st.winnerId);
          ctx.fillStyle = COLORS[wi % COLORS.length];
          ctx.font = '18px monospace';
          ctx.fillText(`P${wi + 1} WINS!`, W / 2, H / 2 + 16);
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [socket]);

  return (
    <div>
      <canvas ref={canvasRef} width={13 * TILE} height={11 * TILE + 80} style={{
        border: '2px solid #ff6b35', borderRadius: 4,
      }} />
      <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8, fontFamily: 'monospace' }}>
        WASD/Arrows Move · SPACE Bomb
      </div>
    </div>
  );
}
