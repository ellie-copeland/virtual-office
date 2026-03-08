'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { ZSState } from '@/lib/game-types';

interface Props { socket: Socket; gameId: string; }

const W = 800, H = 600;
const COLORS = { ground: '#2a1f14', wall: '#4a3728', crate: '#6b4f32', blood: '#8b0000' };
const ZOMBIE_COLORS = { normal: '#3d8b3d', fast: '#7cfc00', tank: '#1a5c1a' };
const PICKUP_COLORS: Record<string, string> = { health: '#ff4444', ammo: '#ffaa00', shotgun: '#44aaff', rifle: '#ff44ff' };
const PICKUP_ICONS: Record<string, string> = { health: '♥', ammo: '•', shotgun: 'S', rifle: 'R' };
const WEAPON_NAMES: Record<string, string> = { pistol: '🔫 Pistol', shotgun: '💥 Shotgun', rifle: '🎯 Rifle' };

export default function ZombieSurvival({ socket, gameId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ZSState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: W / 2, y: H / 2, down: false });
  const touchRef = useRef({ moveX: 0, moveY: 0, aimAngle: 0, shooting: false });
  const isMobile = useRef(false);
  const frameRef = useRef<number>(0);
  const scaleRef = useRef(1);

  useEffect(() => {
    isMobile.current = 'ontouchstart' in window;
  }, []);

  // Socket state listener
  useEffect(() => {
    const handler = (state: ZSState) => { stateRef.current = state; };
    socket.on('game:zombie-state', handler);
    return () => { socket.off('game:zombie-state', handler); };
  }, [socket]);

  // Input sending loop
  useEffect(() => {
    const interval = setInterval(() => {
      const keys = keysRef.current;
      const mouse = mouseRef.current;
      const touch = touchRef.current;
      let dx = 0, dy = 0, angle = 0, shooting = false;

      if (isMobile.current) {
        dx = touch.moveX; dy = touch.moveY;
        angle = touch.aimAngle; shooting = touch.shooting;
      } else {
        if (keys.has('w') || keys.has('arrowup')) dy = -1;
        if (keys.has('s') || keys.has('arrowdown')) dy = 1;
        if (keys.has('a') || keys.has('arrowleft')) dx = -1;
        if (keys.has('d') || keys.has('arrowright')) dx = 1;
        // Normalize diagonal
        if (dx && dy) { const n = 1 / Math.sqrt(2); dx *= n; dy *= n; }
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const scale = scaleRef.current;
          const mx = (mouse.x - rect.left) / scale;
          const my = (mouse.y - rect.top) / scale;
          const me = socket.id ? stateRef.current?.players[socket.id] : undefined;
          if (me) angle = Math.atan2(my - me.y, mx - me.x);
        }
        shooting = mouse.down;
      }

      socket.emit('game:input', { gameId, input: { dx, dy, angle, shooting } });
    }, 50);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, gameId]);

  // Keyboard handlers
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Mouse handlers
  useEffect(() => {
    const move = (e: MouseEvent) => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; };
    const down = () => { mouseRef.current.down = true; };
    const up = () => { mouseRef.current.down = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); };
  }, []);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const state = stateRef.current;
    if (!canvas || !ctx) { frameRef.current = requestAnimationFrame(render); return; }

    // Scale canvas to fit
    const parent = canvas.parentElement;
    if (parent) {
      const scale = Math.min(parent.clientWidth / W, (parent.clientHeight - 60) / H, 1);
      scaleRef.current = scale;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
    }

    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, W, H);

    if (!state) {
      ctx.fillStyle = '#d4a574';
      ctx.font = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for game state...', W / 2, H / 2);
      frameRef.current = requestAnimationFrame(render);
      return;
    }

    // Draw obstacles
    for (const o of state.obstacles) {
      ctx.fillStyle = COLORS.crate;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#3a2918';
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      // Cross detail
      ctx.beginPath();
      ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h);
      ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h);
      ctx.strokeStyle = '#3a291844';
      ctx.stroke();
    }

    // Draw pickups
    for (const pk of state.pickups) {
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = PICKUP_COLORS[pk.type] + '88';
      ctx.fill();
      ctx.strokeStyle = PICKUP_COLORS[pk.type];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
      // Glow
      ctx.shadowColor = PICKUP_COLORS[pk.type];
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(PICKUP_ICONS[pk.type], pk.x, pk.y + 4);
      ctx.shadowBlur = 0;
    }

    // Draw zombies
    for (const z of state.zombies) {
      const size = z.type === 'tank' ? 14 : z.type === 'fast' ? 8 : 10;
      ctx.beginPath();
      ctx.arc(z.x, z.y, size, 0, Math.PI * 2);
      ctx.fillStyle = ZOMBIE_COLORS[z.type];
      ctx.fill();
      ctx.strokeStyle = '#1a3a1a';
      ctx.stroke();
      // Eyes
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(z.x - 3, z.y - 3, 2, 2);
      ctx.fillRect(z.x + 1, z.y - 3, 2, 2);
      // Health bar for tanks
      if (z.type === 'tank') {
        const maxHp = 10;
        const barW = 20;
        ctx.fillStyle = '#333';
        ctx.fillRect(z.x - barW / 2, z.y - size - 6, barW, 3);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(z.x - barW / 2, z.y - size - 6, barW * (z.health / maxHp), 3);
      }
    }

    // Draw bullets
    ctx.fillStyle = '#ffdd44';
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw particles
    for (const p of state.particles) {
      ctx.globalAlpha = p.life / 15;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Draw players
    const myId = socket.id || '';
    for (const [pid, p] of Object.entries(state.players)) {
      if (!p.alive) continue;
      const isMe = pid === myId;
      // Body
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = isMe ? '#d4a574' : '#a08060';
      ctx.fill();
      ctx.strokeStyle = isMe ? '#fff' : '#888';
      ctx.lineWidth = isMe ? 2 : 1;
      ctx.stroke();
      ctx.lineWidth = 1;
      // Weapon line
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      const wLen = p.weapon === 'rifle' ? 22 : p.weapon === 'shotgun' ? 18 : 15;
      ctx.lineTo(p.x + Math.cos(p.angle) * wLen, p.y + Math.sin(p.angle) * wLen);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 1;
      // Health bar
      const barW = 24;
      ctx.fillStyle = '#333';
      ctx.fillRect(p.x - barW / 2, p.y - 20, barW, 4);
      ctx.fillStyle = p.health > 60 ? '#2ecc71' : p.health > 30 ? '#f1c40f' : '#e74c3c';
      ctx.fillRect(p.x - barW / 2, p.y - 20, barW * (p.health / p.maxHealth), 4);
      // Name
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isMe ? 'YOU' : `P${pid.slice(-3)}`, p.x, p.y - 24);
    }

    // HUD
    const me = state.players[myId];
    if (me) {
      // Bottom HUD bar
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, H - 40, W, 40);
      ctx.fillStyle = '#d4a574';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${WEAPON_NAMES[me.weapon]}  Ammo: ${me.ammo}`, 10, H - 16);
      ctx.fillText(`♥ ${Math.ceil(me.health)}/${me.maxHealth}`, 300, H - 16);
      ctx.textAlign = 'right';
      ctx.fillText(`Wave ${state.wave}/10  Kills: ${me.kills}`, W - 10, H - 16);
    }

    // Wave announcement
    if (state.zombies.length === 0 && state.wave > 0 && state.wave < 10 && !state.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W / 2 - 150, H / 2 - 30, 300, 60);
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${state.wave} CLEAR!`, W / 2, H / 2 + 8);
    }

    // Game over
    if (state.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = state.winnerId ? '#2ecc71' : '#e74c3c';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(state.winnerId ? (state.wave >= 10 ? 'SURVIVED!' : 'WINNER!') : 'GAME OVER', W / 2, H / 2 - 20);
      // Scoreboard
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      const sorted = Object.entries(state.players).sort(([, a], [, b]) => b.kills - a.kills);
      sorted.forEach(([pid, p], i) => {
        ctx.fillText(`${pid === myId ? '→ YOU' : `P${pid.slice(-3)}`}: ${p.kills} kills`, W / 2, H / 2 + 20 + i * 22);
      });
    }

    // Dead spectating
    if (me && !me.alive && !state.gameOver) {
      ctx.fillStyle = 'rgba(139,0,0,0.3)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('☠ YOU DIED — Spectating...', W / 2, 40);
    }

    frameRef.current = requestAnimationFrame(render);
  }, [socket]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [render]);

  // Touch controls
  const handleTouchMove = useCallback((side: 'left' | 'right', e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (touch.clientX - cx) / (rect.width / 2);
    const dy = (touch.clientY - cy) / (rect.height / 2);

    if (side === 'left') {
      touchRef.current.moveX = Math.max(-1, Math.min(1, dx));
      touchRef.current.moveY = Math.max(-1, Math.min(1, dy));
    } else {
      touchRef.current.aimAngle = Math.atan2(dy, dx);
      touchRef.current.shooting = true;
    }
  }, []);

  const handleTouchEnd = useCallback((side: 'left' | 'right') => {
    if (side === 'left') { touchRef.current.moveX = 0; touchRef.current.moveY = 0; }
    else { touchRef.current.shooting = false; }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', height: '100%', justifyContent: 'center' }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ border: '2px solid #4a3728', borderRadius: 4, cursor: 'crosshair', imageRendering: 'pixelated' }} />

      {/* Mobile touch controls */}
      {typeof window !== 'undefined' && 'ontouchstart' in window && (
        <div style={{ display: 'flex', gap: 20, width: '100%', maxWidth: 500, justifyContent: 'space-between', padding: '0 20px' }}>
          {/* Left joystick */}
          <div
            style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid #4a3728', touchAction: 'none' }}
            onTouchMove={e => handleTouchMove('left', e)}
            onTouchEnd={() => handleTouchEnd('left')}
          >
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12, fontFamily: 'monospace' }}>MOVE</div>
          </div>
          {/* Right aim/fire */}
          <div
            style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,0,0,0.1)', border: '2px solid #8b0000', touchAction: 'none' }}
            onTouchMove={e => handleTouchMove('right', e)}
            onTouchEnd={() => handleTouchEnd('right')}
            onTouchStart={e => handleTouchMove('right', e)}
          >
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4444', fontSize: 12, fontFamily: 'monospace' }}>AIM+FIRE</div>
          </div>
        </div>
      )}

      <div style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>
        WASD/Arrows: Move · Mouse: Aim · Click: Shoot · PvP enabled (50% friendly fire)
      </div>
    </div>
  );
}
