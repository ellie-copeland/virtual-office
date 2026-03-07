'use client';

import { useRef, useEffect, useCallback } from 'react';
import { MapData, User, Emote, TILE_COLORS, TILE_SIZE, SOLID_TILES, Room } from '@/lib/types';

interface Props {
  map: MapData;
  users: User[];
  currentUserId: string;
  emotes: Emote[];
  onMove: (x: number, y: number) => void;
}

const KEYS_DOWN = new Set<string>();
const MOVE_SPEED = 0.12; // tiles per frame

export default function OfficeCanvas({ map, users, currentUserId, emotes, onMove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const playerPosRef = useRef({ x: 14, y: 10 });
  const targetPosRef = useRef({ x: 14, y: 10 });
  const animFrameRef = useRef(0);
  const usersRef = useRef(users);
  const emotesRef = useRef(emotes);
  usersRef.current = users;
  emotesRef.current = emotes;

  // Initialize player pos from users
  useEffect(() => {
    const me = users.find(u => u.id === currentUserId);
    if (me) {
      playerPosRef.current = { ...me.position };
      targetPosRef.current = { ...me.position };
    }
  }, [currentUserId]); // eslint-disable-line

  const isWalkable = useCallback((x: number, y: number) => {
    const gx = Math.round(x);
    const gy = Math.round(y);
    if (gx < 0 || gx >= map.width || gy < 0 || gy >= map.height) return false;
    return !SOLID_TILES.has(map.tiles[gy][gx]);
  }, [map]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
        KEYS_DOWN.add(e.key);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => KEYS_DOWN.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastMove = 0;

    const gameLoop = (time: number) => {
      animFrameRef.current = requestAnimationFrame(gameLoop);

      // Resize canvas
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Movement
      let dx = 0, dy = 0;
      if (KEYS_DOWN.has('w') || KEYS_DOWN.has('ArrowUp')) dy -= 1;
      if (KEYS_DOWN.has('s') || KEYS_DOWN.has('ArrowDown')) dy += 1;
      if (KEYS_DOWN.has('a') || KEYS_DOWN.has('ArrowLeft')) dx -= 1;
      if (KEYS_DOWN.has('d') || KEYS_DOWN.has('ArrowRight')) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / len) * MOVE_SPEED;
        dy = (dy / len) * MOVE_SPEED;
        const nx = playerPosRef.current.x + dx;
        const ny = playerPosRef.current.y + dy;
        if (isWalkable(nx, ny)) {
          playerPosRef.current = { x: nx, y: ny };
          // Throttle emit to ~15fps
          if (time - lastMove > 66) {
            onMove(nx, ny);
            lastMove = time;
          }
        }
      }

      // Camera follows player
      const cam = cameraRef.current;
      const targetCamX = playerPosRef.current.x * TILE_SIZE - canvas.width / 2;
      const targetCamY = playerPosRef.current.y * TILE_SIZE - canvas.height / 2;
      cam.x += (targetCamX - cam.x) * 0.1;
      cam.y += (targetCamY - cam.y) * 0.1;

      // Clear
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-cam.x, -cam.y);

      // Draw tiles
      const startTileX = Math.max(0, Math.floor(cam.x / TILE_SIZE));
      const startTileY = Math.max(0, Math.floor(cam.y / TILE_SIZE));
      const endTileX = Math.min(map.width, Math.ceil((cam.x + canvas.width) / TILE_SIZE) + 1);
      const endTileY = Math.min(map.height, Math.ceil((cam.y + canvas.height) / TILE_SIZE) + 1);

      for (let y = startTileY; y < endTileY; y++) {
        for (let x = startTileX; x < endTileX; x++) {
          const tile = map.tiles[y][x];
          ctx.fillStyle = TILE_COLORS[tile] || '#2D2D2D';
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

          // Grid lines (subtle)
          if (tile !== 0) {
            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }

          // Furniture details
          drawTileDetail(ctx, tile, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE);
        }
      }

      // Room labels
      for (const room of map.rooms) {
        const rx = (room.bounds.x + room.bounds.width / 2) * TILE_SIZE;
        const ry = (room.bounds.y + 0.8) * TILE_SIZE;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(room.name, rx, ry);
      }

      // Draw other users
      const allUsers = usersRef.current;
      for (const user of allUsers) {
        if (user.id === currentUserId) continue;
        drawAvatar(ctx, user);
      }

      // Draw current user
      const me = allUsers.find(u => u.id === currentUserId);
      if (me) {
        drawAvatar(ctx, { ...me, position: playerPosRef.current });
      }

      // Draw emotes
      const now = Date.now();
      for (const emote of emotesRef.current) {
        const age = now - emote.timestamp;
        if (age > 3000) continue;
        const alpha = 1 - age / 3000;
        const yOff = -20 - (age / 3000) * 30;
        ctx.globalAlpha = alpha;
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emote.emoji, emote.position.x * TILE_SIZE, emote.position.y * TILE_SIZE + yOff);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [map, currentUserId, isWalkable, onMove]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: 'default' }}
      tabIndex={0}
    />
  );
}

function drawAvatar(ctx: CanvasRenderingContext2D, user: User) {
  const px = user.position.x * TILE_SIZE;
  const py = user.position.y * TILE_SIZE;
  const r = TILE_SIZE * 0.4;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(px, py + r * 0.7, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Speaking indicator
  if (user.isSpeaking) {
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py - 4, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Avatar circle
  ctx.fillStyle = user.color;
  ctx.beginPath();
  ctx.arc(px, py - 4, r, 0, Math.PI * 2);
  ctx.fill();

  // Initial
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(user.name[0]?.toUpperCase() || '?', px, py - 4);

  // Name label
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(user.name, px, py + r + 2);

  // Status dot
  const statusColors: Record<string, string> = {
    available: '#4CAF50', busy: '#f44336', away: '#FF9800', 'in-meeting': '#2196F3',
  };
  ctx.fillStyle = statusColors[user.status] || '#4CAF50';
  ctx.beginPath();
  ctx.arc(px + r * 0.7, py - 4 + r * 0.7, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2d2d3d';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Muted indicator
  if (user.isMuted) {
    ctx.fillStyle = 'rgba(244,67,54,0.8)';
    ctx.font = '10px sans-serif';
    ctx.fillText('🔇', px + r, py - r - 4);
  }
}

function drawTileDetail(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, size: number) {
  switch (tile) {
    case 7: // Plant
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2 - 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(x + size / 2 - 3, y + size / 2 + 4, 6, 8);
      break;
    case 6: // Couch
      ctx.fillStyle = '#6A5ACD';
      ctx.fillRect(x + 2, y + 4, size - 4, size - 8);
      ctx.fillStyle = '#5B4FC7';
      ctx.fillRect(x + 2, y + 4, size - 4, 6);
      break;
    case 8: // Whiteboard
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
      break;
    case 9: // TV
      ctx.fillStyle = '#111';
      ctx.fillRect(x + 2, y + 4, size - 4, size - 8);
      ctx.fillStyle = '#1a237e';
      ctx.fillRect(x + 4, y + 6, size - 8, size - 12);
      break;
  }
}
