'use client';

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { JNBState } from '@/lib/game-types';

interface Props {
  socket: Socket;
  gameId: string;
}

const W = 600, H = 450;
const COLORS = ['#ff69b4', '#00ff41', '#00bfff', '#ffff00', '#ff6b35', '#ff4444', '#44ffff', '#aa44ff', '#ff8800', '#88ff44'];

export default function JumpNBump({ socket, gameId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<JNBState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const handler = ({ gameId: gid, state }: { gameId: string; state: JNBState }) => {
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
      socket.emit('game:input', {
        gameId,
        input: {
          left: keys.has('ArrowLeft') || keys.has('a'),
          right: keys.has('ArrowRight') || keys.has('d'),
          jump: keys.has(' ') || keys.has('ArrowUp') || keys.has('w'),
        },
      });
    }, 33);
    return () => clearInterval(interval);
  }, [socket, gameId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      // Background - gradient sky
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a0020');
      grad.addColorStop(1, '#1a0a40');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const st = stateRef.current;
      if (!st) {
        ctx.fillStyle = '#888';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting...', W / 2, H / 2);
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Stars
      ctx.fillStyle = '#ffffff22';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect((i * 151) % W, (i * 89) % (H - 100), 2, 2);
      }

      // Platforms
      for (const plat of st.platforms) {
        // Platform shadow
        ctx.fillStyle = '#00000044';
        ctx.fillRect(plat.x + 2, plat.y + plat.h, plat.w, 4);

        // Main platform
        const pg = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
        pg.addColorStop(0, '#5b4a8a');
        pg.addColorStop(1, '#3a2a6a');
        ctx.fillStyle = pg;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Top edge highlight
        ctx.fillStyle = '#8b7aba';
        ctx.fillRect(plat.x, plat.y, plat.w, 2);

        // Grass-like top
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(plat.x, plat.y - 2, plat.w, 3);
      }

      // Particles (gibs)
      for (const p of st.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / 15);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        // Trail
        ctx.fillStyle = p.color + '44';
        ctx.fillRect(p.x - p.vx - 1, p.y - p.vy - 1, 2, 2);
      }
      ctx.globalAlpha = 1;

      // Players
      const playerIds = Object.keys(st.players);
      playerIds.forEach((pid, idx) => {
        const p = st.players[pid];
        if (!p.alive) {
          // Ghost effect for dead players
          if (p.respawnTimer > 0) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = COLORS[idx % COLORS.length];
            ctx.font = '16px serif';
            ctx.textAlign = 'center';
            ctx.fillText('👻', p.x, p.y);
            ctx.globalAlpha = 1;
          }
          return;
        }

        const color = COLORS[idx % COLORS.length];
        const facing = p.facing;

        // Shadow
        ctx.fillStyle = '#00000033';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 16, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (bunny shape)
        ctx.fillStyle = color;
        // Body
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.ellipse(p.x - 4 * facing, p.y - 16, 3, 8, facing * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(p.x + 2 * facing, p.y - 17, 3, 9, -facing * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Inner ears
        ctx.fillStyle = '#ffcccc';
        ctx.beginPath();
        ctx.ellipse(p.x - 4 * facing, p.y - 16, 1.5, 5, facing * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(p.x + 2 * facing, p.y - 17, 1.5, 6, -facing * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x - 3 * facing, p.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x + 3 * facing, p.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(p.x - 3 * facing + facing, p.y - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x + 3 * facing + facing, p.y - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x - 6 * facing, p.y + 6, 3, 0, Math.PI * 2);
        ctx.fill();

        // Feet
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(p.x - 4, p.y + 10, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(p.x + 4, p.y + 10, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // "You" indicator
        if (pid === socket.id) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 30);
          ctx.lineTo(p.x - 4, p.y - 24);
          ctx.lineTo(p.x + 4, p.y - 24);
          ctx.closePath();
          ctx.fill();
        }

        // Name tag
        ctx.fillStyle = color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`P${idx + 1}`, p.x, p.y - 32);
      });

      // HUD - Scoreboard
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, 30);

      ctx.textAlign = 'left';
      ctx.font = 'bold 13px monospace';
      let hx = 10;
      playerIds.forEach((pid, idx) => {
        const p = st.players[pid];
        const color = COLORS[idx % COLORS.length];
        ctx.fillStyle = p.alive ? color : '#555';
        const marker = pid === socket.id ? '►' : ' ';
        const text = `${marker}P${idx + 1}: ${p.score}`;
        ctx.fillText(text, hx, 20);
        hx += 120;
      });

      // Timer
      ctx.textAlign = 'right';
      ctx.fillStyle = st.timeLeft <= 30 ? '#ff4444' : '#fff';
      ctx.font = 'bold 14px monospace';
      const mins = Math.floor(st.timeLeft / 60);
      const secs = st.timeLeft % 60;
      ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, W - 10, 20);

      // Game over
      if (st.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff69b4';
        ctx.font = 'bold 36px monospace';
        ctx.fillText('TIME UP!', W / 2, H / 2 - 30);

        // Final scores
        const sorted = playerIds
          .map((pid, idx) => ({ pid, idx, score: st.players[pid].score }))
          .sort((a, b) => b.score - a.score);

        sorted.forEach((s, rank) => {
          const color = COLORS[s.idx % COLORS.length];
          ctx.fillStyle = rank === 0 ? '#ffd700' : color;
          ctx.font = rank === 0 ? 'bold 20px monospace' : '16px monospace';
          const trophy = rank === 0 ? '👑 ' : '   ';
          ctx.fillText(`${trophy}P${s.idx + 1}: ${s.score} kills`, W / 2, H / 2 + 10 + rank * 28);
        });
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [socket]);

  return (
    <div>
      <canvas ref={canvasRef} width={W} height={H} style={{
        border: '2px solid #ff69b4', borderRadius: 4,
      }} />
      <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8, fontFamily: 'monospace' }}>
        ← → Move · SPACE/↑ Jump · Stomp heads to score!
      </div>
    </div>
  );
}
