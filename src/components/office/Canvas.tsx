'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  MapData, User, Emote, TILE_SIZE, SOLID_TILES, Room,
  TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_DESK, TILE_CHAIR,
  TILE_COUCH, TILE_PLANT, TILE_WHITEBOARD, TILE_TV, TILE_CARPET,
  TILE_WOOD_FLOOR, TILE_KITCHEN_COUNTER, TILE_FRIDGE, TILE_COFFEE,
  TILE_BOOKSHELF, TILE_LAMP, TILE_RUG, TILE_OUTDOOR, TILE_PHONE_BOOTH,
  TILE_ARCADE, MeetingRoomState, ScheduledMeeting,
} from '@/lib/types';

interface Props {
  map: MapData;
  users: User[];
  currentUserId: string;
  emotes: Emote[];
  meetingRoomStates: Record<string, MeetingRoomState>;
  scheduledMeetings: ScheduledMeeting[];
  onMove: (x: number, y: number) => void;
}

const KEYS_DOWN = new Set<string>();
const MOVE_SPEED = 0.12;

// ========================
// PIXEL ART DRAWING UTILS
// ========================

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

// Darken/lighten a hex color
function shade(hex: string, amt: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// ========================
// PARTICLE SYSTEM
// ========================
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

const particles: Particle[] = [];
let lastParticlePos = { x: 0, y: 0 };

function spawnFootstepDust(wx: number, wy: number) {
  const dist = Math.abs(wx - lastParticlePos.x) + Math.abs(wy - lastParticlePos.y);
  if (dist < 0.3) return;
  lastParticlePos = { x: wx, y: wy };
  for (let i = 0; i < 2; i++) {
    particles.push({
      x: wx * TILE_SIZE + (Math.random() - 0.5) * 6,
      y: wy * TILE_SIZE + 8 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.2 - Math.random() * 0.3,
      life: 1, maxLife: 1,
      size: 2 + Math.random() * 2,
      color: 'rgba(200,190,170,',
    });
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.life -= dt * 0.003;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife) * 0.5;
    ctx.fillStyle = p.color + a + ')';
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
}

// ========================
// TILE RENDERERS
// ========================

function drawFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Stone floor with subtle checkerboard
  const light = (x / s + y / s) % 2 === 0;
  ctx.fillStyle = light ? '#E8E4DB' : '#DDD9D0';
  ctx.fillRect(x, y, s, s);
  // Subtle grout lines
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  ctx.fillRect(x, y, s, 1);
  ctx.fillRect(x, y, 1, s);
}

function drawWoodFloor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  const base = (gx + gy) % 2 === 0 ? '#C4A265' : '#B89555';
  ctx.fillStyle = base;
  ctx.fillRect(x, y, s, s);
  // Wood grain lines
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < s; i += 4) {
    ctx.fillRect(x, y + i, s, 1);
  }
  // Plank edge
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(x, y + s - 1, s, 1);
}

function drawCarpet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  const light = (gx + gy) % 2 === 0;
  ctx.fillStyle = light ? '#5B7FA5' : '#5578A0';
  ctx.fillRect(x, y, s, s);
  // Texture dots
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 2; i < s; i += 4) {
    for (let j = 2; j < s; j += 4) {
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#8E6BAA';
  ctx.fillRect(x, y, s, s);
  // Pattern
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  ctx.fillStyle = '#8E6BAA';
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
}

function drawOutdoor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  const hash = ((gx * 7 + gy * 13) % 3);
  const colors = ['#7CB342', '#75A83D', '#6E9E38'];
  ctx.fillStyle = colors[hash];
  ctx.fillRect(x, y, s, s);
  // Grass blades
  ctx.fillStyle = 'rgba(100,160,50,0.3)';
  const seed = (gx * 31 + gy * 17) % 5;
  ctx.fillRect(x + seed * 3 + 2, y + 4, 1, 3);
  ctx.fillRect(x + seed * 2 + 10, y + 12, 1, 3);
  ctx.fillRect(x + seed + 20, y + 8, 1, 2);
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, map: MapData, gx: number, gy: number) {
  // 3D top-down wall: dark body with lighter top face
  const wallBase = '#3A3A4A';
  const wallTop = '#5A5A6A';
  const wallHighlight = '#6A6A7A';

  ctx.fillStyle = wallBase;
  ctx.fillRect(x, y, s, s);

  // Top highlight (3px) — looks like top of wall catching light
  ctx.fillStyle = wallTop;
  ctx.fillRect(x, y, s, 4);
  ctx.fillStyle = wallHighlight;
  ctx.fillRect(x, y, s, 2);

  // Right shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x + s - 2, y, 2, s);

  // Bottom shadow (cast onto floor below)
  const belowY = gy + 1;
  if (belowY < map.height && !SOLID_TILES.has(map.tiles[belowY][gx]) && map.tiles[belowY][gx] !== TILE_VOID) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y + s, s, 4);
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Floor base
  ctx.fillStyle = '#E8E4DB';
  ctx.fillRect(x, y, s, s);
  // Door frame
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(x + 2, y, s - 4, s);
  // Door center (lighter wood)
  ctx.fillStyle = '#C4A265';
  ctx.fillRect(x + 4, y + 2, s - 8, s - 4);
  // Door handle
  ctx.fillStyle = '#FFD54F';
  ctx.fillRect(x + s - 9, y + s / 2 - 1, 3, 3);
  // Pulsing glow to indicate entrance
  const pulse = Math.sin(time * 0.003) * 0.15 + 0.15;
  ctx.fillStyle = `rgba(232,200,114,${pulse})`;
  ctx.fillRect(x, y, s, s);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Desk surface
  ctx.fillStyle = '#A0844A';
  ctx.fillRect(x + 1, y + 3, s - 2, s - 6);
  // Desk top highlight
  ctx.fillStyle = '#B89555';
  ctx.fillRect(x + 1, y + 3, s - 2, 3);
  // Monitor
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 8, y + 5, 16, 12);
  ctx.fillStyle = '#1a3a5a';
  ctx.fillRect(x + 9, y + 6, 14, 10);
  // Monitor stand
  ctx.fillStyle = '#444';
  ctx.fillRect(x + 14, y + 17, 4, 3);
  ctx.fillRect(x + 12, y + 19, 8, 2);
  // Keyboard
  ctx.fillStyle = '#555';
  ctx.fillRect(x + 8, y + 22, 16, 4);
  ctx.fillStyle = '#666';
  for (let kx = 0; kx < 7; kx++) {
    ctx.fillRect(x + 9 + kx * 2, y + 23, 1, 2);
  }
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Floor underneath
  ctx.fillStyle = '#E8E4DB';
  ctx.fillRect(x, y, s, s);
  // Chair seat
  ctx.fillStyle = '#4A4A5A';
  ctx.fillRect(x + 6, y + 8, s - 12, s - 12);
  // Chair back
  ctx.fillStyle = '#3A3A4A';
  ctx.fillRect(x + 6, y + 4, s - 12, 6);
  // Arm rests
  ctx.fillStyle = '#3A3A4A';
  ctx.fillRect(x + 4, y + 8, 3, 10);
  ctx.fillRect(x + s - 7, y + 8, 3, 10);
  // Wheel dots
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 8, y + s - 4, 2, 2);
  ctx.fillRect(x + s - 10, y + s - 4, 2, 2);
}

function drawCouch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Couch body
  ctx.fillStyle = '#6A5ACD';
  ctx.fillRect(x + 2, y + 6, s - 4, s - 8);
  // Back cushion
  ctx.fillStyle = '#5B4FC7';
  ctx.fillRect(x + 2, y + 4, s - 4, 8);
  // Highlight
  ctx.fillStyle = '#7B6BD7';
  ctx.fillRect(x + 3, y + 5, s - 6, 3);
  // Arm
  ctx.fillStyle = '#5B4FC7';
  ctx.fillRect(x + 1, y + 6, 3, s - 10);
  ctx.fillRect(x + s - 4, y + 6, 3, s - 10);
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Pot
  ctx.fillStyle = '#8D6E4C';
  ctx.fillRect(x + 10, y + 20, 12, 10);
  ctx.fillStyle = '#7D5E3C';
  ctx.fillRect(x + 8, y + 18, 16, 4);
  // Soil
  ctx.fillStyle = '#4E3524';
  ctx.fillRect(x + 10, y + 18, 12, 3);
  // Leaves (slight sway)
  const sway = Math.sin(time * 0.001 + x) * 1;
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(x + 16 + sway, y + 10, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#388E3C';
  ctx.beginPath();
  ctx.arc(x + 12 + sway * 0.5, y + 13, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#66BB6A';
  ctx.beginPath();
  ctx.arc(x + 20 - sway * 0.5, y + 12, 5, 0, Math.PI * 2);
  ctx.fill();
  // Stem
  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(x + 15, y + 14, 2, 6);
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Board
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(x + 2, y + 2, s - 4, s - 6);
  // Frame
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, s - 4, s - 6);
  // Some "writing"
  ctx.fillStyle = '#E53935';
  ctx.fillRect(x + 6, y + 8, 10, 1);
  ctx.fillStyle = '#1E88E5';
  ctx.fillRect(x + 6, y + 12, 14, 1);
  ctx.fillStyle = '#43A047';
  ctx.fillRect(x + 6, y + 16, 8, 1);
  // Marker tray
  ctx.fillStyle = '#888';
  ctx.fillRect(x + 4, y + s - 5, s - 8, 3);
}

function drawTV(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Bezel
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 1, y + 3, s - 2, s - 6);
  // Screen
  const hue = (time * 0.02) % 360;
  ctx.fillStyle = `hsl(${hue}, 30%, 15%)`;
  ctx.fillRect(x + 3, y + 5, s - 6, s - 10);
  // Screen content (fake UI)
  ctx.fillStyle = 'rgba(100,150,255,0.3)';
  ctx.fillRect(x + 5, y + 7, s - 10, 3);
  ctx.fillStyle = 'rgba(100,255,150,0.2)';
  ctx.fillRect(x + 5, y + 12, (s - 10) * 0.6, 2);
  // Stand
  ctx.fillStyle = '#333';
  ctx.fillRect(x + s / 2 - 3, y + s - 4, 6, 3);
}

function drawKitchenCounter(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Counter body
  ctx.fillStyle = '#6D6D6D';
  ctx.fillRect(x, y + 4, s, s - 4);
  // Counter top
  ctx.fillStyle = '#A0A0A0';
  ctx.fillRect(x, y + 2, s, 6);
  // Highlight
  ctx.fillStyle = '#B0B0B0';
  ctx.fillRect(x, y + 2, s, 2);
  // Cabinet lines
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x + s / 2, y + 10, 1, s - 14);
}

function drawFridge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Body
  ctx.fillStyle = '#D0D8E0';
  ctx.fillRect(x + 2, y + 1, s - 4, s - 2);
  // Door line
  ctx.fillStyle = '#B0B8C0';
  ctx.fillRect(x + s / 2, y + 1, 1, s - 2);
  // Handle
  ctx.fillStyle = '#888';
  ctx.fillRect(x + s / 2 - 4, y + 8, 2, 8);
  ctx.fillRect(x + s / 2 - 4, y + 20, 2, 6);
  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 3, y + 2, s - 6, 2);
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Base (on counter)
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(x + 6, y + 8, s - 12, s - 10);
  // Body
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 8, y + 4, s - 16, 12);
  // Water tank
  ctx.fillStyle = '#5588AA';
  ctx.fillRect(x + 9, y + 5, 4, 8);
  // Cup
  ctx.fillStyle = '#FFF';
  ctx.fillRect(x + 14, y + 18, 6, 6);
  ctx.fillStyle = '#DDD';
  ctx.fillRect(x + 14, y + 18, 6, 2);
  // Steam
  const steamAlpha = Math.sin(time * 0.005) * 0.2 + 0.3;
  ctx.fillStyle = `rgba(255,255,255,${steamAlpha})`;
  ctx.fillRect(x + 16, y + 14, 2, 4);
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Shelf frame
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(x + 2, y + 1, s - 4, s - 2);
  // Shelf dividers
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(x + 2, y + 10, s - 4, 2);
  ctx.fillRect(x + 2, y + 20, s - 4, 2);
  // Books
  const bookColors = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1'];
  let bx = x + 4;
  for (let row = 0; row < 3; row++) {
    const by = y + 2 + row * 10;
    let cx = bx;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = bookColors[(row * 5 + i) % bookColors.length];
      const bw = 3 + (i % 2);
      ctx.fillRect(cx, by, bw, 7);
      cx += bw + 1;
    }
  }
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Warm glow
  const glowR = 24 + Math.sin(time * 0.002) * 3;
  const grad = ctx.createRadialGradient(x + s / 2, y + s / 2 - 4, 2, x + s / 2, y + s / 2 - 4, glowR);
  grad.addColorStop(0, 'rgba(255,220,130,0.25)');
  grad.addColorStop(1, 'rgba(255,220,130,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 8, y - 8, s + 16, s + 16);
  // Pole
  ctx.fillStyle = '#555';
  ctx.fillRect(x + s / 2 - 1, y + 10, 3, 18);
  // Base
  ctx.fillStyle = '#444';
  ctx.fillRect(x + s / 2 - 5, y + 26, 11, 3);
  // Shade
  ctx.fillStyle = '#FFF8E1';
  ctx.fillRect(x + s / 2 - 7, y + 4, 15, 8);
  ctx.fillStyle = '#FFE082';
  ctx.fillRect(x + s / 2 - 6, y + 5, 13, 6);
  // Bulb
  ctx.fillStyle = '#FFEE58';
  ctx.fillRect(x + s / 2 - 2, y + 10, 5, 3);
}

function drawPhoneBooth(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Glass walls
  ctx.fillStyle = '#B0BEC5';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(144,164,174,0.5)';
  ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  // Interior
  ctx.fillStyle = '#E0E0E0';
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
  // Small desk
  ctx.fillStyle = '#8D6E4C';
  ctx.fillRect(x + 6, y + 10, s - 12, 4);
}

function drawArcade(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Cabinet
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 4, y + 2, s - 8, s - 4);
  // Screen
  const hue = (time * 0.05 + x) % 360;
  ctx.fillStyle = `hsl(${hue}, 80%, 20%)`;
  ctx.fillRect(x + 6, y + 4, s - 12, 12);
  // Pixel art on screen
  ctx.fillStyle = `hsl(${(hue + 120) % 360}, 90%, 60%)`;
  ctx.fillRect(x + 10, y + 7, 3, 3);
  ctx.fillRect(x + 17, y + 9, 3, 3);
  ctx.fillStyle = `hsl(${(hue + 240) % 360}, 90%, 60%)`;
  ctx.fillRect(x + 13, y + 10, 4, 2);
  // Controls
  ctx.fillStyle = '#555';
  ctx.fillRect(x + 8, y + 18, s - 16, 6);
  // Joystick
  ctx.fillStyle = '#E53935';
  ctx.fillRect(x + 10, y + 19, 3, 4);
  // Buttons
  ctx.fillStyle = '#FDD835';
  ctx.fillRect(x + 17, y + 19, 3, 3);
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(x + 21, y + 20, 3, 3);
  // Side art stripe
  ctx.fillStyle = '#7C4DFF';
  ctx.fillRect(x + 4, y + 2, 2, s - 4);
  ctx.fillRect(x + s - 6, y + 2, 2, s - 4);
}

function drawTile(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, s: number, time: number, map: MapData, gx: number, gy: number) {
  switch (tile) {
    case TILE_VOID:
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, y, s, s);
      break;
    case TILE_FLOOR: drawFloorTile(ctx, x, y, s); break;
    case TILE_WALL: drawWall(ctx, x, y, s, map, gx, gy); break;
    case TILE_DOOR: drawDoor(ctx, x, y, s, time); break;
    case TILE_DESK: drawDesk(ctx, x, y, s); break;
    case TILE_CHAIR: drawChair(ctx, x, y, s); break;
    case TILE_COUCH: drawCouch(ctx, x, y, s); break;
    case TILE_PLANT: {
      // Draw floor under plant
      drawFloorTile(ctx, x, y, s);
      drawPlant(ctx, x, y, s, time);
      break;
    }
    case TILE_WHITEBOARD: drawWhiteboard(ctx, x, y, s); break;
    case TILE_TV: drawTV(ctx, x, y, s, time); break;
    case TILE_CARPET: drawCarpet(ctx, x, y, s); break;
    case TILE_WOOD_FLOOR: drawWoodFloor(ctx, x, y, s); break;
    case TILE_KITCHEN_COUNTER: drawKitchenCounter(ctx, x, y, s); break;
    case TILE_FRIDGE: drawFridge(ctx, x, y, s); break;
    case TILE_COFFEE: drawCoffeeMachine(ctx, x, y, s, time); break;
    case TILE_BOOKSHELF: drawBookshelf(ctx, x, y, s); break;
    case TILE_LAMP: {
      drawFloorTile(ctx, x, y, s);
      drawLamp(ctx, x, y, s, time);
      break;
    }
    case TILE_RUG: drawRug(ctx, x, y, s); break;
    case TILE_OUTDOOR: drawOutdoor(ctx, x, y, s); break;
    case TILE_PHONE_BOOTH: drawPhoneBooth(ctx, x, y, s); break;
    case TILE_ARCADE: {
      drawCarpet(ctx, x, y, s);
      drawArcade(ctx, x, y, s, time);
      break;
    }
    default:
      ctx.fillStyle = '#2D2D2D';
      ctx.fillRect(x, y, s, s);
  }
}

// ========================
// AMBIENT OCCLUSION
// ========================
function drawAmbientOcclusion(ctx: CanvasRenderingContext2D, map: MapData, startX: number, startY: number, endX: number, endY: number) {
  for (let gy = startY; gy < endY; gy++) {
    for (let gx = startX; gx < endX; gx++) {
      const tile = map.tiles[gy]?.[gx];
      if (tile === undefined || tile === TILE_VOID || SOLID_TILES.has(tile) || tile === TILE_WALL) continue;
      // Check adjacent walls
      const x = gx * TILE_SIZE, y = gy * TILE_SIZE;
      // Above
      if (gy > 0 && map.tiles[gy - 1][gx] === TILE_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, TILE_SIZE, 6);
      }
      // Left
      if (gx > 0 && map.tiles[gy][gx - 1] === TILE_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(x, y, 4, TILE_SIZE);
      }
      // Right
      if (gx < map.width - 1 && map.tiles[gy][gx + 1] === TILE_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        ctx.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE);
      }
    }
  }
}

// ========================
// SPRITE AVATAR SYSTEM
// ========================

type Direction = 'down' | 'up' | 'left' | 'right';

interface SpriteState {
  dir: Direction;
  frame: number;
  lastX: number;
  lastY: number;
  bobOffset: number;
  moving: boolean;
}

const spriteStates = new Map<string, SpriteState>();

function getSpriteState(userId: string, x: number, y: number): SpriteState {
  let st = spriteStates.get(userId);
  if (!st) {
    st = { dir: 'down', frame: 0, lastX: x, lastY: y, bobOffset: 0, moving: false };
    spriteStates.set(userId, st);
  }
  // Determine direction from movement
  const dx = x - st.lastX;
  const dy = y - st.lastY;
  const moved = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
  st.moving = moved;
  if (moved) {
    if (Math.abs(dx) > Math.abs(dy)) {
      st.dir = dx > 0 ? 'right' : 'left';
    } else {
      st.dir = dy > 0 ? 'down' : 'up';
    }
    st.frame = (st.frame + 0.15) % 3;
  } else {
    st.frame = 0;
    st.bobOffset = (st.bobOffset + 0.03) % (Math.PI * 2);
  }
  st.lastX = x; st.lastY = y;
  return st;
}

function tintColor(base: string, tint: string): string {
  // Simple: just return tint as the primary color
  return tint;
}

function drawSpriteAvatar(ctx: CanvasRenderingContext2D, user: User, pos: { x: number; y: number }, time: number) {
  const wx = pos.x * TILE_SIZE;
  const wy = pos.y * TILE_SIZE;
  const st = getSpriteState(user.id, pos.x, pos.y);

  // Idle bob
  const bob = st.moving ? 0 : Math.sin(st.bobOffset + time * 0.004) * 1.5;
  const walkBob = st.moving ? Math.sin(Math.floor(st.frame) * Math.PI) * 2 : 0;
  const yOff = -8 + bob + walkBob;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(wx, wy + 6, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Speaking ring
  if (user.isSpeaking) {
    const pulse = Math.sin(time * 0.008) * 2 + 14;
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, wy + yOff, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  const color = user.color;
  const dark = shade(color, -40);
  const light = shade(color, 40);
  const skin = '#FFCC99';
  const skinDark = '#E6B580';

  // Body (24x24 sprite area centered on wx, wy+yOff)
  const bx = wx - 12;
  const by = wy + yOff - 12;

  // --- DRAW SPRITE based on direction ---
  const f = Math.floor(st.frame);

  // Hair/head top
  px(ctx, bx + 8, by, 8, 3, dark);
  px(ctx, bx + 6, by + 2, 12, 2, dark);

  // Face
  px(ctx, bx + 7, by + 4, 10, 6, skin);
  px(ctx, bx + 6, by + 5, 12, 4, skin);

  // Eyes
  if (st.dir === 'down') {
    px(ctx, bx + 9, by + 6, 2, 2, '#333');
    px(ctx, bx + 13, by + 6, 2, 2, '#333');
    // Mouth
    px(ctx, bx + 11, by + 9, 2, 1, skinDark);
  } else if (st.dir === 'up') {
    // Back of head — hair
    px(ctx, bx + 7, by + 4, 10, 6, dark);
  } else if (st.dir === 'left') {
    px(ctx, bx + 8, by + 6, 2, 2, '#333');
    px(ctx, bx + 10, by + 9, 2, 1, skinDark);
  } else {
    px(ctx, bx + 14, by + 6, 2, 2, '#333');
    px(ctx, bx + 12, by + 9, 2, 1, skinDark);
  }

  // Body / shirt
  px(ctx, bx + 7, by + 10, 10, 8, color);
  px(ctx, bx + 8, by + 10, 8, 2, light); // collar highlight

  // Arms
  const armSwing = st.moving ? Math.sin(f * 2.1) * 2 : 0;
  px(ctx, bx + 4, by + 11 + armSwing, 3, 6, color);
  px(ctx, bx + 17, by + 11 - armSwing, 3, 6, color);
  // Hands
  px(ctx, bx + 4, by + 16 + armSwing, 3, 2, skin);
  px(ctx, bx + 17, by + 16 - armSwing, 3, 2, skin);

  // Legs / pants
  const legOff = st.moving ? (f === 1 ? 1 : f === 2 ? -1 : 0) : 0;
  px(ctx, bx + 8, by + 18, 3, 5 + legOff, dark);
  px(ctx, bx + 13, by + 18, 3, 5 - legOff, dark);
  // Shoes
  px(ctx, bx + 7, by + 22 + legOff, 4, 2, '#333');
  px(ctx, bx + 13, by + 22 - legOff, 4, 2, '#333');

  // Name tag with background pill
  const name = user.name;
  ctx.font = 'bold 10px monospace';
  const nameW = ctx.measureText(name).width;
  const tagX = wx - nameW / 2 - 4;
  const tagY = wy + yOff + 16;
  // Pill background
  ctx.fillStyle = 'rgba(30,30,50,0.75)';
  const pillW = nameW + 8;
  const pillH = 14;
  const pillR = 4;
  ctx.beginPath();
  ctx.moveTo(tagX + pillR, tagY);
  ctx.lineTo(tagX + pillW - pillR, tagY);
  ctx.quadraticCurveTo(tagX + pillW, tagY, tagX + pillW, tagY + pillR);
  ctx.lineTo(tagX + pillW, tagY + pillH - pillR);
  ctx.quadraticCurveTo(tagX + pillW, tagY + pillH, tagX + pillW - pillR, tagY + pillH);
  ctx.lineTo(tagX + pillR, tagY + pillH);
  ctx.quadraticCurveTo(tagX, tagY + pillH, tagX, tagY + pillH - pillR);
  ctx.lineTo(tagX, tagY + pillR);
  ctx.quadraticCurveTo(tagX, tagY, tagX + pillR, tagY);
  ctx.closePath();
  ctx.fill();
  // Name text
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, wx, tagY + pillH / 2);

  // Status dot
  const statusColors: Record<string, string> = {
    available: '#4CAF50', busy: '#f44336', away: '#FF9800', 'in-meeting': '#2196F3',
  };
  ctx.fillStyle = statusColors[user.status] || '#4CAF50';
  ctx.beginPath();
  ctx.arc(wx + nameW / 2 + 6, tagY + pillH / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Muted indicator
  if (user.isMuted) {
    ctx.fillStyle = 'rgba(244,67,54,0.9)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔇', wx + 14, wy + yOff - 14);
  }
}

// ========================
// ROOM LABELS
// ========================
function drawRoomLabels(ctx: CanvasRenderingContext2D, rooms: Room[]) {
  for (const room of rooms) {
    const rx = (room.bounds.x + room.bounds.width / 2) * TILE_SIZE;
    const ry = (room.bounds.y + 1) * TILE_SIZE;
    ctx.font = 'bold 11px monospace';
    const tw = ctx.measureText(room.name).width;
    // Badge background
    ctx.fillStyle = room.type === 'private' ? 'rgba(233,30,99,0.2)' : 'rgba(255,255,255,0.1)';
    const bw = tw + 12, bh = 16;
    ctx.beginPath();
    const bx = rx - bw / 2, by = ry - bh / 2;
    ctx.moveTo(bx + 4, by);
    ctx.lineTo(bx + bw - 4, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 4);
    ctx.lineTo(bx + bw, by + bh - 4);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 4, by + bh);
    ctx.lineTo(bx + 4, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 4);
    ctx.lineTo(bx, by + 4);
    ctx.quadraticCurveTo(bx, by, bx + 4, by);
    ctx.closePath();
    ctx.fill();
    // Text
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.name, rx, ry);
    // Lock icon for private
    if (room.type === 'private') {
      ctx.fillText('🔒', rx - tw / 2 - 10, ry);
    }
  }
}

// ========================
// DAY/NIGHT CYCLE
// ========================
function getDayNightTint(): { r: number; g: number; b: number; a: number } {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  // Night: 22-6, Dusk/Dawn: 6-8, 18-22, Day: 8-18
  if (hour >= 8 && hour <= 18) return { r: 0, g: 0, b: 0, a: 0 }; // no tint
  if (hour >= 22 || hour <= 5) return { r: 10, g: 10, b: 40, a: 0.15 }; // night blue
  if (hour > 5 && hour < 8) {
    const t = (hour - 5) / 3;
    return { r: 10, g: 10, b: 40, a: 0.15 * (1 - t) };
  }
  // 18-22 dusk
  const t = (hour - 18) / 4;
  return { r: 10, g: 10, b: 40, a: 0.15 * t };
}

// ========================
// OFF-SCREEN USER ARROWS
// ========================
function drawOffscreenArrows(
  ctx: CanvasRenderingContext2D, users: User[], currentUserId: string,
  camX: number, camY: number, cw: number, ch: number
) {
  for (const user of users) {
    if (user.id === currentUserId) continue;
    const ux = user.position.x * TILE_SIZE - camX;
    const uy = user.position.y * TILE_SIZE - camY;
    if (ux >= -20 && ux <= cw + 20 && uy >= -20 && uy <= ch + 20) continue;
    // Clamp to screen edge
    const cx = cw / 2, cy = ch / 2;
    const dx = ux - cx, dy = uy - cy;
    const angle = Math.atan2(dy, dx);
    const margin = 30;
    const edgeX = Math.max(margin, Math.min(cw - margin, cx + Math.cos(angle) * (cw / 2 - margin)));
    const edgeY = Math.max(margin, Math.min(ch - margin, cy + Math.sin(angle) * (ch / 2 - margin)));

    ctx.save();
    ctx.translate(edgeX, edgeY);
    ctx.rotate(angle);
    // Arrow
    ctx.fillStyle = user.color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-4, -6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Name
    ctx.rotate(-angle);
    ctx.font = '9px monospace';
    ctx.fillStyle = user.color;
    ctx.textAlign = 'center';
    ctx.fillText(user.name, 0, -10);
    ctx.restore();
  }
}

// ========================
// MAIN COMPONENT
// ========================

export default function OfficeCanvas({ map, users, currentUserId, emotes, onMove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const playerPosRef = useRef({ x: 20, y: 13 });
  const targetPosRef = useRef({ x: 20, y: 13 });
  const animFrameRef = useRef(0);
  const usersRef = useRef(users);
  const emotesRef = useRef(emotes);
  usersRef.current = users;
  emotesRef.current = emotes;

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
    let lastTime = 0;

    const gameLoop = (time: number) => {
      animFrameRef.current = requestAnimationFrame(gameLoop);
      const dt = time - lastTime;
      lastTime = time;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Disable image smoothing for pixel-art crispness
      ctx.imageSmoothingEnabled = false;

      // Movement
      let dx = 0, dy = 0;
      if (KEYS_DOWN.has('w') || KEYS_DOWN.has('ArrowUp')) dy -= 1;
      if (KEYS_DOWN.has('s') || KEYS_DOWN.has('ArrowDown')) dy += 1;
      if (KEYS_DOWN.has('a') || KEYS_DOWN.has('ArrowLeft')) dx -= 1;
      if (KEYS_DOWN.has('d') || KEYS_DOWN.has('ArrowRight')) dx += 1;

      const isMoving = dx !== 0 || dy !== 0;
      if (isMoving) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / len) * MOVE_SPEED;
        dy = (dy / len) * MOVE_SPEED;
        const nx = playerPosRef.current.x + dx;
        const ny = playerPosRef.current.y + dy;
        if (isWalkable(nx, ny)) {
          playerPosRef.current = { x: nx, y: ny };
          spawnFootstepDust(nx, ny);
          if (time - lastMove > 66) {
            onMove(nx, ny);
            lastMove = time;
          }
        }
      }

      // Update particles
      updateParticles(dt);

      // Camera
      const cam = cameraRef.current;
      const targetCamX = playerPosRef.current.x * TILE_SIZE - canvas.width / 2;
      const targetCamY = playerPosRef.current.y * TILE_SIZE - canvas.height / 2;
      cam.x += (targetCamX - cam.x) * 0.08;
      cam.y += (targetCamY - cam.y) * 0.08;

      // Clear
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

      // Visible tile range
      const startTileX = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
      const startTileY = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
      const endTileX = Math.min(map.width, Math.ceil((cam.x + canvas.width) / TILE_SIZE) + 2);
      const endTileY = Math.min(map.height, Math.ceil((cam.y + canvas.height) / TILE_SIZE) + 2);

      // Draw tiles
      for (let gy = startTileY; gy < endTileY; gy++) {
        for (let gx = startTileX; gx < endTileX; gx++) {
          const tile = map.tiles[gy]?.[gx];
          if (tile === undefined) continue;
          drawTile(ctx, tile, gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, time, map, gx, gy);
        }
      }

      // Ambient occlusion pass
      drawAmbientOcclusion(ctx, map, startTileX, startTileY, endTileX, endTileY);

      // Room labels
      drawRoomLabels(ctx, map.rooms);

      // Particles
      drawParticles(ctx);

      // Draw other users
      const allUsers = usersRef.current;
      for (const user of allUsers) {
        if (user.id === currentUserId) continue;
        drawSpriteAvatar(ctx, user, user.position, time);
      }

      // Draw current user
      const me = allUsers.find(u => u.id === currentUserId);
      if (me) {
        drawSpriteAvatar(ctx, { ...me, position: playerPosRef.current } as User, playerPosRef.current, time);
      }

      // Emotes
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

      // Day/night tint overlay
      const tint = getDayNightTint();
      if (tint.a > 0) {
        ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Off-screen user arrows (in screen space)
      drawOffscreenArrows(ctx, allUsers, currentUserId, cam.x, cam.y, canvas.width, canvas.height);
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
