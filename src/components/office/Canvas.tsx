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

interface DeskClaim {
  tileKey: string;
  userId: string;
  userName: string;
  userColor: string;
}

interface ReactionBubble {
  id: string;
  userId: string;
  emoji: string;
  x: number;
  y: number;
  startTime: number;
}

interface Props {
  map: MapData;
  users: User[];
  currentUserId: string;
  emotes: Emote[];
  meetingRoomStates: Record<string, MeetingRoomState>;
  scheduledMeetings: ScheduledMeeting[];
  deskClaims?: DeskClaim[];
  reactionBubbles?: ReactionBubble[];
  onMove: (x: number, y: number) => void;
  onCameraChange?: (x: number, y: number) => void;
}

const KEYS_DOWN = new Set<string>();
const MOVE_SPEED = 0.12;

// ====================================
// SUIKODEN 2 PALETTE & PIXEL HELPERS
// ====================================

// Warm earthy palette inspired by Suikoden II's interior scenes
const PAL = {
  // Floors
  stoneLight: '#D4C8A8', stoneMid: '#C4B898', stoneDark: '#B0A480', stoneGrout: '#9E9470',
  woodLight: '#C8A060', woodMid: '#B08840', woodDark: '#987030', woodGrain: '#886828',
  carpetBase: '#4A6080', carpetLight: '#5A7090', carpetDark: '#3A5070', carpetPattern: '#6880A0',
  rugWine: '#803848', rugGold: '#C8A050', rugBorder: '#682838', rugPattern: '#A06848',
  // Walls
  wallStone: '#585068', wallStoneDark: '#484060', wallStoneMid: '#686078',
  wallMortar: '#706880', wallHighlight: '#787090', wallShadow: '#383040',
  wallMolding: '#907878', wallMoldingLight: '#A08888',
  // Furniture
  deskWood: '#A07840', deskTop: '#B88850', deskDark: '#886030', deskHighlight: '#C89858',
  monitorFrame: '#282028', monitorScreen: '#182838', monitorGlow: '#2A4868',
  chairSeat: '#584858', chairBack: '#483848', chairArm: '#504050', chairWheel: '#302830',
  couchBody: '#685890', couchDark: '#584878', couchLight: '#7868A0', couchCushion: '#786898',
  // Kitchen
  counterStone: '#888078', counterTop: '#A09888', counterDark: '#787068',
  fridgeBody: '#C8D0D8', fridgeLight: '#D8E0E8', fridgeDark: '#A8B0B8', fridgeHandle: '#808888',
  coffeeBody: '#383038', coffeeTank: '#508098', coffeeCup: '#F0E8D8',
  // Nature
  plantDark: '#2A6830', plantMid: '#3A8840', plantLight: '#58A858', plantHighlight: '#68C068',
  potBase: '#8B6548', potDark: '#705030', potHighlight: '#A07858', soil: '#483820',
  grassDark: '#508838', grassMid: '#60A048', grassLight: '#78B858', grassHighlight: '#90D068',
  // Misc
  glassBase: '#90A8B8', glassLight: '#B0C8D8', glassDark: '#708898',
  gold: '#D8B040', goldBright: '#F0D060', goldDark: '#A08020',
  bookRed: '#C83838', bookBlue: '#3858A8', bookGreen: '#38882A', bookYellow: '#D8A828',
  bookPurple: '#7838A8', bookOrange: '#D87028', bookBrown: '#886040', bookTeal: '#289888',
  whiteboardBase: '#F0E8D8', whiteboardFrame: '#887868',
  voidDeep: '#100818', voidMid: '#180C20',
  // UI
  labelBg: 'rgba(24,16,32,0.82)', labelText: '#E8D8C8', labelBorder: 'rgba(200,168,80,0.3)',
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

function shade(hex: string, amt: number): string {
  let c = hex;
  if (c.startsWith('rgb')) {
    const m = c.match(/(\d+)/g);
    if (!m) return hex;
    const r = Math.min(255, Math.max(0, +m[0] + amt));
    const g = Math.min(255, Math.max(0, +m[1] + amt));
    const b = Math.min(255, Math.max(0, +m[2] + amt));
    return `rgb(${r},${g},${b})`;
  }
  const num = parseInt(c.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// Seeded hash for deterministic per-tile variation
function tileHash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
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
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: wx * TILE_SIZE + (Math.random() - 0.5) * 8,
      y: wy * TILE_SIZE + 8 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.3 - Math.random() * 0.3,
      life: 1, maxLife: 1,
      size: 1.5 + Math.random() * 2,
      color: 'rgba(180,168,140,',
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
    const a = Math.max(0, p.life / p.maxLife) * 0.45;
    ctx.fillStyle = p.color + a + ')';
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
}

// ====================================
// SUIKODEN 2 TILE RENDERERS
// ====================================

function drawFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  const h = tileHash(gx, gy);
  const checker = (gx + gy) % 2 === 0;
  // Large stone tiles with subtle color variation
  ctx.fillStyle = checker ? PAL.stoneLight : PAL.stoneMid;
  ctx.fillRect(x, y, s, s);
  // Per-tile hue shift for natural look
  if (h > 0.7) {
    ctx.fillStyle = 'rgba(200,180,140,0.06)';
    ctx.fillRect(x, y, s, s);
  }
  // Grout lines (2px wide, recessed look)
  px(ctx, x, y, s, 1, PAL.stoneGrout);
  px(ctx, x, y, 1, s, PAL.stoneGrout);
  px(ctx, x, y + 1, s, 1, 'rgba(255,255,255,0.04)'); // top edge highlight
  // Subtle surface scratches
  if (h > 0.5) {
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    ctx.fillRect(x + (h * 12) | 0, y + 8, 8, 1);
  }
  // Tiny speckle detail
  ctx.fillStyle = 'rgba(0,0,0,0.02)';
  const sx2 = ((gx * 7 + gy * 3) % 5) * 5 + 3;
  ctx.fillRect(x + sx2, y + ((gx * 3 + gy * 7) % 4) * 6 + 2, 2, 2);
}

function drawWoodFloor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  const h = tileHash(gx, gy);
  // Plank base with alternating warm tones
  const plankVar = (gx + Math.floor(gy / 2)) % 3;
  const bases = [PAL.woodLight, PAL.woodMid, PAL.woodDark];
  ctx.fillStyle = bases[plankVar];
  ctx.fillRect(x, y, s, s);
  // Wood grain - horizontal lines with varying opacity
  for (let i = 0; i < s; i += 2) {
    const grain = tileHash(gx * 100 + i, gy) * 0.08;
    ctx.fillStyle = `rgba(0,0,0,${grain})`;
    ctx.fillRect(x, y + i, s, 1);
  }
  // Knot detail (rare)
  if (h > 0.85) {
    const kx = x + (h * 20) | 0 + 4;
    const ky = y + 10;
    ctx.fillStyle = PAL.woodGrain;
    ctx.fillRect(kx, ky, 4, 3);
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(kx + 1, ky + 1, 2, 1);
  }
  // Plank edge (bottom border)
  px(ctx, x, y + s - 1, s, 1, PAL.woodGrain);
  // Stagger offset every other row
  if (gy % 2 === 0) {
    px(ctx, x + s - 1, y, 1, s, 'rgba(0,0,0,0.06)');
  }
  // Top edge highlight
  px(ctx, x, y, s, 1, 'rgba(255,255,255,0.04)');
}

function drawCarpet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  const checker = (gx + gy) % 2 === 0;
  ctx.fillStyle = checker ? PAL.carpetBase : PAL.carpetDark;
  ctx.fillRect(x, y, s, s);
  // Woven texture pattern
  for (let i = 0; i < s; i += 3) {
    for (let j = (i % 6 < 3 ? 0 : 1); j < s; j += 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x + j, y + i, 2, 1);
    }
  }
  // Subtle border highlight at carpet edges
  ctx.fillStyle = PAL.carpetLight;
  // Check if adjacent tile is NOT carpet
}

function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  ctx.fillStyle = PAL.rugWine;
  ctx.fillRect(x, y, s, s);
  // Ornate border pattern (2px)
  px(ctx, x, y, s, 2, PAL.rugBorder);
  px(ctx, x, y, 2, s, PAL.rugBorder);
  px(ctx, x, y + s - 2, s, 2, PAL.rugBorder);
  px(ctx, x + s - 2, y, 2, s, PAL.rugBorder);
  // Gold inner border
  px(ctx, x + 2, y + 2, s - 4, 1, PAL.rugGold);
  px(ctx, x + 2, y + 2, 1, s - 4, PAL.rugGold);
  px(ctx, x + 2, y + s - 3, s - 4, 1, PAL.rugGold);
  px(ctx, x + s - 3, y + 2, 1, s - 4, PAL.rugGold);
  // Interior diamond pattern
  const cx = s / 2, cy = s / 2;
  const h = tileHash(gx, gy);
  if ((gx + gy) % 2 === 0) {
    px(ctx, x + cx - 3, y + cy - 1, 6, 2, PAL.rugPattern);
    px(ctx, x + cx - 1, y + cy - 3, 2, 6, PAL.rugPattern);
  } else {
    px(ctx, x + cx - 2, y + cy - 2, 4, 4, PAL.rugGold);
    px(ctx, x + cx - 1, y + cy - 1, 2, 2, PAL.rugWine);
  }
}

function drawOutdoor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const gx = x / s, gy = y / s;
  const h = tileHash(gx, gy);
  const h2 = tileHash(gx + 100, gy + 100);
  // Base grass with variation
  const bases = [PAL.grassDark, PAL.grassMid, PAL.grassLight];
  ctx.fillStyle = bases[Math.floor(h * 3)];
  ctx.fillRect(x, y, s, s);
  // Grass blade clusters (3-5 per tile)
  const bladeCount = 3 + Math.floor(h * 3);
  for (let i = 0; i < bladeCount; i++) {
    const bh = tileHash(gx * 10 + i, gy * 10);
    const bx = x + (bh * (s - 4)) + 2;
    const by = y + (tileHash(gx * 10 + i + 50, gy * 10) * (s - 6)) + 2;
    const bc = bh > 0.5 ? PAL.grassHighlight : PAL.grassLight;
    px(ctx, bx, by, 1, 3, bc);
    px(ctx, bx + 1, by + 1, 1, 2, PAL.grassDark);
  }
  // Occasional flower
  if (h2 > 0.9) {
    const fx = x + 10 + (h * 12) | 0;
    const fy = y + 8 + (h2 * 12) | 0;
    px(ctx, fx, fy, 2, 2, h > 0.95 ? '#E8D040' : '#E060A0');
    px(ctx, fx, fy + 2, 1, 2, PAL.grassDark);
  }
  // Occasional stone
  if (h2 > 0.82 && h2 < 0.87) {
    const sx2 = x + 6 + (h * 16) | 0;
    const sy = y + 14 + (h2 * 8) | 0;
    px(ctx, sx2, sy, 4, 3, PAL.stoneMid);
    px(ctx, sx2, sy, 4, 1, PAL.stoneLight);
  }
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, map: MapData, gx: number, gy: number) {
  const h = tileHash(gx, gy);
  // Base stone wall
  ctx.fillStyle = PAL.wallStone;
  ctx.fillRect(x, y, s, s);

  // Brick/stone pattern with mortar lines
  const brickH = 8;
  const brickW = 12;
  for (let row = 0; row < Math.ceil(s / brickH); row++) {
    const offsetX = (row % 2) * (brickW / 2);
    for (let col = -1; col < Math.ceil(s / brickW) + 1; col++) {
      const bx = x + col * brickW + offsetX;
      const by = y + row * brickH;
      if (bx + brickW < x || bx > x + s) continue;
      // Mortar
      const clampX = Math.max(x, bx);
      const clampR = Math.min(x + s, bx + brickW);
      const clampY = Math.max(y, by);
      const clampB = Math.min(y + s, by + brickH);
      if (clampR > clampX && clampB > clampY) {
        // Individual brick color variation
        const brickHash = tileHash(col + gx * 7, row + gy * 13);
        const colors = [PAL.wallStone, PAL.wallStoneDark, PAL.wallStoneMid];
        ctx.fillStyle = colors[Math.floor(brickHash * 3)];
        ctx.fillRect(clampX, clampY, clampR - clampX, clampB - clampY);
        // Mortar lines
        ctx.fillStyle = PAL.wallMortar;
        ctx.fillRect(clampX, clampY, clampR - clampX, 1);
        ctx.fillRect(clampX, clampY, 1, clampB - clampY);
      }
    }
  }

  // Top molding (decorative strip) - 4px
  px(ctx, x, y, s, 1, PAL.wallMoldingLight);
  px(ctx, x, y + 1, s, 1, PAL.wallMolding);
  px(ctx, x, y + 2, s, 2, PAL.wallStoneDark);

  // Bottom shadow edge
  px(ctx, x, y + s - 2, s, 1, PAL.wallShadow);
  px(ctx, x, y + s - 1, s, 1, 'rgba(0,0,0,0.3)');

  // Right edge shadow
  px(ctx, x + s - 1, y, 1, s, 'rgba(0,0,0,0.15)');

  // Cast shadow onto floor below
  const belowY = gy + 1;
  if (belowY < map.height && !SOLID_TILES.has(map.tiles[belowY][gx]) && map.tiles[belowY][gx] !== TILE_VOID) {
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(x, y + s, s, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, y + s + 5, s, 3);
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Floor underneath
  drawFloorTile(ctx, x, y, s);
  // Door frame (thick wooden archway)
  px(ctx, x + 2, y, 3, s, PAL.deskDark);
  px(ctx, x + s - 5, y, 3, s, PAL.deskDark);
  // Arch top
  px(ctx, x + 2, y, s - 4, 3, PAL.deskDark);
  px(ctx, x + 3, y + 1, s - 6, 1, PAL.deskHighlight);
  // Door panels (wood)
  px(ctx, x + 5, y + 3, s - 10, s - 5, PAL.deskWood);
  px(ctx, x + 6, y + 4, s - 12, s - 7, PAL.deskTop);
  // Panel detail lines
  px(ctx, x + 8, y + 6, s - 16, 1, PAL.deskDark);
  px(ctx, x + 8, y + s / 2, s - 16, 1, PAL.deskDark);
  // Handle (gold)
  px(ctx, x + s - 10, y + s / 2 - 2, 3, 4, PAL.gold);
  px(ctx, x + s - 10, y + s / 2 - 1, 2, 2, PAL.goldBright);
  // Warm glow pulsing through door gap
  const pulse = Math.sin(time * 0.003) * 0.12 + 0.12;
  ctx.fillStyle = `rgba(255,200,100,${pulse})`;
  ctx.fillRect(x + 5, y + 3, s - 10, s - 5);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, deskClaim?: DeskClaim) {
  // Desk body (rich wood)
  px(ctx, x + 1, y + 5, s - 2, s - 7, PAL.deskDark);
  // Desktop surface (lighter top)
  px(ctx, x + 1, y + 3, s - 2, 4, PAL.deskTop);
  px(ctx, x + 2, y + 3, s - 4, 1, PAL.deskHighlight); // edge highlight
  // Wood grain on desk
  px(ctx, x + 4, y + 4, 8, 1, 'rgba(0,0,0,0.04)');
  px(ctx, x + 16, y + 5, 6, 1, 'rgba(0,0,0,0.04)');
  // Drawer line
  px(ctx, x + 3, y + s / 2 + 4, s - 6, 1, 'rgba(0,0,0,0.1)');
  px(ctx, x + s / 2 - 2, y + s / 2 + 5, 4, 2, PAL.gold); // drawer pull
  // Monitor
  px(ctx, x + 7, y + 5, 18, 13, PAL.monitorFrame);
  px(ctx, x + 8, y + 6, 16, 11, PAL.monitorScreen);
  // Screen content (warm blue glow)
  px(ctx, x + 9, y + 7, 14, 2, PAL.monitorGlow);
  px(ctx, x + 9, y + 10, 10, 1, 'rgba(80,120,160,0.5)');
  px(ctx, x + 9, y + 12, 12, 1, 'rgba(60,100,140,0.4)');
  px(ctx, x + 9, y + 14, 8, 1, 'rgba(80,120,160,0.3)');
  // Monitor stand
  px(ctx, x + 14, y + 18, 4, 2, '#404040');
  px(ctx, x + 12, y + 19, 8, 2, '#383038');
  // Keyboard
  px(ctx, x + 8, y + 22, 16, 4, '#484048');
  px(ctx, x + 9, y + 23, 14, 2, '#585058');
  // Key details
  for (let k = 0; k < 6; k++) {
    px(ctx, x + 10 + k * 2, y + 23, 1, 1, '#686068');
  }
  // Mouse
  px(ctx, x + 26, y + 23, 3, 4, '#484048');
  px(ctx, x + 27, y + 23, 1, 2, '#585058');
  // Coffee mug on desk
  px(ctx, x + 3, y + 6, 4, 5, '#E8D8C0');
  px(ctx, x + 3, y + 6, 4, 1, '#F0E8D8');
  px(ctx, x + 4, y + 5, 2, 1, 'rgba(160,80,40,0.6)'); // coffee inside

  // Draw nameplate if desk is claimed
  if (deskClaim) {
    drawDeskNameplate(ctx, x, y, s, deskClaim);
  }
}

function drawDeskNameplate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, deskClaim: DeskClaim) {
  const nameplateName = deskClaim.userName;
  const nameplateY = y - 8; // Position above the desk
  const nameplateX = x + s / 2; // Center horizontally
  
  // Set font for measuring
  ctx.font = 'bold 10px monospace';
  const textWidth = ctx.measureText(nameplateName).width;
  const plateWidth = Math.max(textWidth + 8, 40);
  const plateHeight = 12;
  
  // Nameplate background
  ctx.fillStyle = PAL.labelBg;
  ctx.fillRect(nameplateX - plateWidth / 2, nameplateY - plateHeight / 2, plateWidth, plateHeight);
  
  // Nameplate border
  ctx.strokeStyle = 'rgba(200,168,80,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(nameplateX - plateWidth / 2, nameplateY - plateHeight / 2, plateWidth, plateHeight);
  
  // User color indicator (small dot)
  ctx.fillStyle = deskClaim.userColor;
  ctx.fillRect(nameplateX - plateWidth / 2 + 3, nameplateY - 2, 4, 4);
  
  // Name text
  ctx.fillStyle = PAL.labelText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nameplateName, nameplateX, nameplateY);
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Floor underneath
  drawFloorTile(ctx, x, y, s);
  // Chair shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x + 6, y + s - 4, s - 12, 4);
  // Wheels (5-star base)
  px(ctx, x + 7, y + s - 3, 2, 2, PAL.chairWheel);
  px(ctx, x + s - 9, y + s - 3, 2, 2, PAL.chairWheel);
  px(ctx, x + s / 2 - 1, y + s - 2, 2, 2, PAL.chairWheel);
  // Pole
  px(ctx, x + s / 2 - 1, y + s - 6, 2, 4, '#404040');
  // Seat (cushioned)
  px(ctx, x + 5, y + 10, s - 10, 8, PAL.chairSeat);
  px(ctx, x + 6, y + 11, s - 12, 6, PAL.chairArm); // cushion detail
  px(ctx, x + 6, y + 10, s - 12, 1, shade(PAL.chairSeat, 20)); // top highlight
  // Backrest
  px(ctx, x + 6, y + 4, s - 12, 7, PAL.chairBack);
  px(ctx, x + 7, y + 5, s - 14, 5, shade(PAL.chairBack, 15));
  px(ctx, x + 7, y + 4, s - 14, 1, shade(PAL.chairBack, 30)); // top edge
  // Armrests
  px(ctx, x + 3, y + 9, 3, 8, PAL.chairArm);
  px(ctx, x + s - 6, y + 9, 3, 8, PAL.chairArm);
  px(ctx, x + 3, y + 9, 3, 1, shade(PAL.chairArm, 20));
  px(ctx, x + s - 6, y + 9, 3, 1, shade(PAL.chairArm, 20));
}

function drawCouch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x + 2, y + s - 2, s - 4, 3);
  // Couch frame/body
  px(ctx, x + 1, y + 6, s - 2, s - 8, PAL.couchDark);
  // Back cushion
  px(ctx, x + 1, y + 3, s - 2, 6, PAL.couchBody);
  px(ctx, x + 2, y + 4, s - 4, 4, PAL.couchLight);
  px(ctx, x + 2, y + 3, s - 4, 1, shade(PAL.couchLight, 15)); // top highlight
  // Seat cushions (2 sections)
  px(ctx, x + 2, y + 9, s / 2 - 3, s - 13, PAL.couchCushion);
  px(ctx, x + s / 2, y + 9, s / 2 - 2, s - 13, PAL.couchCushion);
  // Cushion seam
  px(ctx, x + s / 2 - 1, y + 9, 2, s - 13, PAL.couchDark);
  // Armrests
  px(ctx, x, y + 6, 3, s - 9, PAL.couchDark);
  px(ctx, x + s - 3, y + 6, 3, s - 9, PAL.couchDark);
  // Armrest top highlight
  px(ctx, x, y + 6, 3, 1, PAL.couchLight);
  px(ctx, x + s - 3, y + 6, 3, 1, PAL.couchLight);
  // Throw pillow (occasional)
  const h = tileHash(x / s, y / s);
  if (h > 0.4) {
    const pc = h > 0.7 ? PAL.rugGold : PAL.rugPattern;
    px(ctx, x + 4, y + 10, 5, 4, pc);
    px(ctx, x + 5, y + 10, 3, 1, shade(pc, 20));
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  const h = tileHash(x / s, y / s);
  const sway = Math.sin(time * 0.0008 + x * 0.1) * 1.2;
  // Pot (terracotta with highlight)
  px(ctx, x + 9, y + 20, 14, 10, PAL.potBase);
  px(ctx, x + 7, y + 18, 18, 3, PAL.potBase);
  px(ctx, x + 8, y + 18, 16, 1, PAL.potHighlight);
  px(ctx, x + 10, y + 28, 12, 2, PAL.potDark);
  // Rim highlight
  px(ctx, x + 7, y + 18, 18, 1, shade(PAL.potHighlight, 15));
  // Soil
  px(ctx, x + 10, y + 18, 12, 3, PAL.soil);
  px(ctx, x + 12, y + 18, 2, 1, shade(PAL.soil, 15));

  if (h > 0.5) {
    // Bushy plant (fern-like)
    // Main stem
    px(ctx, x + 15 + sway * 0.3, y + 14, 2, 5, PAL.plantDark);
    // Leaf clusters
    const drawLeafCluster = (cx: number, cy: number, r: number, c: string) => {
      px(ctx, cx - r, cy - r / 2, r * 2, r, c);
      px(ctx, cx - r + 1, cy - r / 2 - 1, r * 2 - 2, 1, shade(c, 20));
    };
    drawLeafCluster(x + 16 + sway, y + 8, 7, PAL.plantMid);
    drawLeafCluster(x + 12 + sway * 0.6, y + 11, 5, PAL.plantDark);
    drawLeafCluster(x + 20 - sway * 0.4, y + 10, 6, PAL.plantLight);
    drawLeafCluster(x + 14 + sway * 0.8, y + 6, 5, PAL.plantHighlight);
    drawLeafCluster(x + 18 - sway * 0.6, y + 7, 4, PAL.plantMid);
  } else {
    // Tall plant (palm-like)
    px(ctx, x + 15 + sway * 0.2, y + 10, 2, 9, PAL.plantDark);
    // Drooping leaves
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + time * 0.0003;
      const lx = Math.cos(angle) * (6 + i) + sway;
      const ly = Math.sin(angle) * 3 - 2;
      const lc = i % 2 === 0 ? PAL.plantMid : PAL.plantLight;
      px(ctx, x + 15 + lx, y + 6 + ly + i, 4, 2, lc);
      px(ctx, x + 16 + lx, y + 5 + ly + i, 2, 1, PAL.plantHighlight);
    }
  }
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Frame (thick wood)
  px(ctx, x + 1, y + 1, s - 2, s - 4, PAL.whiteboardFrame);
  // Board surface
  px(ctx, x + 3, y + 3, s - 6, s - 8, PAL.whiteboardBase);
  px(ctx, x + 3, y + 3, s - 6, 1, '#F8F0E0'); // top highlight
  // Content (meeting notes look)
  px(ctx, x + 5, y + 6, 12, 1, '#C83838'); // red header
  px(ctx, x + 5, y + 9, 16, 1, '#3858A8'); // blue line
  px(ctx, x + 5, y + 12, 10, 1, '#3858A8');
  px(ctx, x + 5, y + 15, 14, 1, '#38882A'); // green line
  px(ctx, x + 5, y + 18, 8, 1, '#38882A');
  // Checkbox squares
  px(ctx, x + 5, y + 9, 2, 2, '#3858A8');
  px(ctx, x + 5, y + 12, 2, 2, '#3858A8');
  px(ctx, x + 5, y + 15, 2, 2, '#38882A');
  // Marker tray
  px(ctx, x + 3, y + s - 5, s - 6, 3, shade(PAL.whiteboardFrame, -10));
  // Markers
  px(ctx, x + 6, y + s - 5, 2, 3, '#C83838');
  px(ctx, x + 10, y + s - 5, 2, 3, '#3858A8');
  px(ctx, x + 14, y + s - 5, 2, 3, '#38882A');
  // Eraser
  px(ctx, x + s - 10, y + s - 5, 4, 3, '#888078');
}

function drawTV(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Wall mount bracket
  px(ctx, x + s / 2 - 3, y + 1, 6, 3, '#383038');
  // Bezel
  px(ctx, x + 2, y + 2, s - 4, s - 5, '#1A1018');
  // Screen
  px(ctx, x + 3, y + 3, s - 6, s - 7, PAL.monitorScreen);
  // Screen content (animated dashboard)
  const flicker = Math.sin(time * 0.01) * 0.05 + 0.3;
  ctx.fillStyle = `rgba(40,80,120,${flicker})`;
  ctx.fillRect(x + 4, y + 4, s - 8, s - 9);
  // Chart bars
  for (let i = 0; i < 4; i++) {
    const bh = 4 + Math.sin(time * 0.002 + i) * 3;
    ctx.fillStyle = `rgba(80,160,220,${0.4 + i * 0.1})`;
    ctx.fillRect(x + 6 + i * 5, y + s - 8 - bh, 3, bh);
  }
  // Title text
  px(ctx, x + 5, y + 5, 10, 1, 'rgba(100,180,255,0.5)');
  // Screen edge glow
  ctx.fillStyle = 'rgba(60,100,160,0.06)';
  ctx.fillRect(x, y, s, s);
}

function drawKitchenCounter(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Counter body (stone-look)
  px(ctx, x, y + 5, s, s - 5, PAL.counterDark);
  // Counter top surface
  px(ctx, x, y + 2, s, 5, PAL.counterTop);
  px(ctx, x, y + 2, s, 1, shade(PAL.counterTop, 15)); // edge highlight
  // Stone speckle detail
  const h = tileHash(x / s, y / s);
  px(ctx, x + 4 + (h * 10 | 0), y + 3, 2, 1, 'rgba(0,0,0,0.05)');
  px(ctx, x + 14 + (h * 8 | 0), y + 4, 3, 1, 'rgba(0,0,0,0.04)');
  // Cabinet doors
  px(ctx, x + 2, y + 8, s / 2 - 3, s - 10, shade(PAL.counterDark, 8));
  px(ctx, x + s / 2 + 1, y + 8, s / 2 - 3, s - 10, shade(PAL.counterDark, 8));
  // Cabinet line
  px(ctx, x + s / 2 - 1, y + 8, 2, s - 10, 'rgba(0,0,0,0.1)');
  // Handles (gold)
  px(ctx, x + s / 2 - 4, y + 14, 2, 4, PAL.gold);
  px(ctx, x + s / 2 + 2, y + 14, 2, 4, PAL.gold);
  // Items on counter
  px(ctx, x + 4, y + 3, 3, 3, '#E8E0D0'); // plate
  px(ctx, x + 22, y + 2, 4, 4, '#884030'); // bread
  px(ctx, x + 23, y + 2, 2, 1, '#A05040');
}

function drawFridge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Body
  px(ctx, x + 2, y + 1, s - 4, s - 2, PAL.fridgeBody);
  // Top section (freezer)
  px(ctx, x + 3, y + 2, s - 6, 10, PAL.fridgeLight);
  // Bottom section (fridge)
  px(ctx, x + 3, y + 14, s - 6, s - 17, PAL.fridgeLight);
  // Divider
  px(ctx, x + 3, y + 12, s - 6, 2, PAL.fridgeDark);
  // Handles
  px(ctx, x + s - 8, y + 5, 2, 5, PAL.fridgeHandle);
  px(ctx, x + s - 8, y + 17, 2, 7, PAL.fridgeHandle);
  // Handle highlights
  px(ctx, x + s - 8, y + 5, 1, 5, shade(PAL.fridgeHandle, 20));
  px(ctx, x + s - 8, y + 17, 1, 7, shade(PAL.fridgeHandle, 20));
  // Top highlight
  px(ctx, x + 3, y + 2, s - 6, 1, 'rgba(255,255,255,0.2)');
  // Shadow on left side
  px(ctx, x + 2, y + 1, 1, s - 2, 'rgba(0,0,0,0.05)');
  // Magnets/stickers
  px(ctx, x + 6, y + 16, 3, 3, '#D85050'); // red magnet
  px(ctx, x + 12, y + 20, 4, 3, '#5080D8'); // blue note
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Base on counter
  px(ctx, x + 6, y + 10, s - 12, s - 12, PAL.coffeeBody);
  // Main body
  px(ctx, x + 7, y + 4, s - 14, 14, shade(PAL.coffeeBody, 10));
  px(ctx, x + 8, y + 5, s - 16, 12, shade(PAL.coffeeBody, 18));
  // Water tank (translucent)
  px(ctx, x + 9, y + 5, 5, 10, PAL.coffeeTank);
  px(ctx, x + 10, y + 6, 3, 6, shade(PAL.coffeeTank, 20)); // water level
  // Drip area
  px(ctx, x + 16, y + 14, 6, 2, '#282028');
  // Cup
  px(ctx, x + 16, y + 16, 6, 7, PAL.coffeeCup);
  px(ctx, x + 17, y + 17, 4, 5, shade(PAL.coffeeCup, -10));
  px(ctx, x + 17, y + 17, 4, 1, '#A08060'); // coffee surface
  // Cup handle
  px(ctx, x + 22, y + 18, 2, 3, PAL.coffeeCup);
  // Steam animation
  const steamPhase = time * 0.004;
  for (let i = 0; i < 3; i++) {
    const sy = y + 12 - i * 3 - Math.sin(steamPhase + i) * 1.5;
    const sx2 = x + 18 + Math.sin(steamPhase * 0.7 + i * 2) * 1.5;
    const a = 0.15 - i * 0.04;
    ctx.fillStyle = `rgba(240,230,220,${a})`;
    ctx.fillRect(sx2, sy, 2, 2);
  }
  // Indicator light
  px(ctx, x + s - 10, y + 8, 2, 2, '#40C040');
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Shelf frame (dark wood)
  px(ctx, x + 1, y + 1, s - 2, s - 2, PAL.deskDark);
  px(ctx, x + 2, y + 1, s - 4, 1, PAL.deskHighlight); // top edge
  // Shelf dividers
  const shelfH = Math.floor((s - 4) / 3);
  for (let r = 0; r < 3; r++) {
    const sy = y + 2 + r * shelfH;
    // Shelf board
    px(ctx, x + 2, sy + shelfH - 2, s - 4, 2, PAL.deskWood);
    px(ctx, x + 2, sy + shelfH - 2, s - 4, 1, PAL.deskHighlight);
    // Books on this shelf
    const bookColors = [PAL.bookRed, PAL.bookBlue, PAL.bookGreen, PAL.bookYellow,
      PAL.bookPurple, PAL.bookOrange, PAL.bookBrown, PAL.bookTeal];
    let bx = x + 3;
    const maxBx = x + s - 4;
    let i = 0;
    while (bx < maxBx - 2) {
      const bw = 2 + Math.floor(tileHash(bx, r) * 2.5);
      const bh = shelfH - 4 - Math.floor(tileHash(bx + 1, r) * 3);
      const colorIdx = Math.floor(tileHash(bx * 3, r * 7 + x / s) * bookColors.length);
      const bc = bookColors[colorIdx];
      // Book body
      px(ctx, bx, sy + (shelfH - 2 - bh), bw, bh, bc);
      // Spine highlight
      px(ctx, bx, sy + (shelfH - 2 - bh), 1, bh, shade(bc, 25));
      // Title dash
      if (bw >= 3) {
        px(ctx, bx + 1, sy + (shelfH - 2 - bh) + 3, bw - 2, 1, shade(bc, 40));
      }
      bx += bw + 1;
      i++;
      if (i > 8) break;
    }
  }
  // Side edge shadow
  px(ctx, x + s - 2, y + 1, 1, s - 2, 'rgba(0,0,0,0.1)');
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Warm light pool
  const glowR = 28 + Math.sin(time * 0.002) * 3;
  const grad = ctx.createRadialGradient(x + s / 2, y + s / 2 - 4, 3, x + s / 2, y + s / 2 - 4, glowR);
  grad.addColorStop(0, 'rgba(255,210,120,0.2)');
  grad.addColorStop(0.5, 'rgba(255,200,100,0.08)');
  grad.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 12, y - 12, s + 24, s + 24);
  // Pole
  px(ctx, x + s / 2 - 1, y + 12, 2, 16, '#504848');
  px(ctx, x + s / 2, y + 12, 1, 16, '#605858'); // highlight
  // Base (circular disc)
  px(ctx, x + s / 2 - 6, y + 27, 12, 3, '#484040');
  px(ctx, x + s / 2 - 5, y + 27, 10, 1, '#585050');
  // Shade (warm fabric)
  px(ctx, x + s / 2 - 8, y + 4, 16, 9, '#F0E0C0');
  px(ctx, x + s / 2 - 7, y + 5, 14, 7, '#E8D4A8');
  // Shade edge detail
  px(ctx, x + s / 2 - 8, y + 4, 16, 1, PAL.gold);
  px(ctx, x + s / 2 - 8, y + 12, 16, 1, PAL.goldDark);
  // Bulb glow
  const bulbGlow = Math.sin(time * 0.003) * 0.1 + 0.4;
  px(ctx, x + s / 2 - 2, y + 11, 4, 2, `rgba(255,230,150,${bulbGlow})`);
}

function drawPhoneBooth(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Floor
  drawCarpet(ctx, x, y, s);
  // Glass partition walls
  px(ctx, x, y, s, 1, PAL.glassDark);
  px(ctx, x, y, 1, s, PAL.glassDark);
  px(ctx, x + s - 1, y, 1, s, PAL.glassDark);
  // Glass fill (translucent)
  ctx.fillStyle = 'rgba(160,184,200,0.15)';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  // Glass reflection streaks
  px(ctx, x + 3, y + 2, 1, s - 4, 'rgba(255,255,255,0.08)');
  px(ctx, x + s - 4, y + 4, 1, s - 8, 'rgba(255,255,255,0.05)');
  // Small desk inside
  px(ctx, x + 5, y + 12, s - 10, 4, PAL.deskWood);
  px(ctx, x + 5, y + 12, s - 10, 1, PAL.deskHighlight);
  // Monitor on desk
  px(ctx, x + 8, y + 8, 10, 6, PAL.monitorFrame);
  px(ctx, x + 9, y + 9, 8, 4, PAL.monitorScreen);
  // Privacy indicator
  px(ctx, x + s / 2 - 2, y + 1, 4, 2, '#40A040');
}

function drawArcade(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  // Cabinet body (dark with colored side art)
  px(ctx, x + 3, y + 1, s - 6, s - 2, '#282030');
  // Side art stripes
  px(ctx, x + 3, y + 1, 2, s - 2, '#7040A0');
  px(ctx, x + s - 5, y + 1, 2, s - 2, '#7040A0');
  px(ctx, x + 3, y + 5, 2, 4, '#D84080');
  px(ctx, x + s - 5, y + 5, 2, 4, '#D84080');
  // Marquee (top lit panel)
  px(ctx, x + 5, y + 2, s - 10, 4, '#D84080');
  const marqueeFlash = Math.sin(time * 0.006) * 0.15 + 0.85;
  ctx.fillStyle = `rgba(255,100,160,${marqueeFlash * 0.3})`;
  ctx.fillRect(x + 5, y + 2, s - 10, 4);
  // Marquee text
  px(ctx, x + 8, y + 3, 2, 2, '#F0E0F0');
  px(ctx, x + 12, y + 3, 4, 2, '#F0E0F0');
  px(ctx, x + 18, y + 3, 3, 2, '#F0E0F0');
  // Screen (CRT with scanlines)
  px(ctx, x + 5, y + 7, s - 10, 12, '#080810');
  // Game content (animated pixel invaders)
  const phase = Math.floor(time * 0.003) % 4;
  const invaderColors = ['#40E040', '#40C0E0', '#E0E040', '#E04080'];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const ix = x + 7 + col * 6 + (phase % 2);
      const iy = y + 9 + row * 4;
      px(ctx, ix, iy, 3, 2, invaderColors[(row * 3 + col) % 4]);
    }
  }
  // Player ship
  px(ctx, x + 12 + Math.sin(time * 0.005) * 4, y + 17, 4, 2, '#E0E0F0');
  // Controls panel
  px(ctx, x + 5, y + 20, s - 10, 6, '#383040');
  px(ctx, x + 5, y + 20, s - 10, 1, '#484050');
  // Joystick
  px(ctx, x + 8, y + 22, 2, 3, '#C0C0C0');
  px(ctx, x + 7, y + 21, 4, 2, '#E0E0E0');
  // Buttons
  px(ctx, x + 15, y + 22, 3, 3, '#E03030');
  px(ctx, x + 20, y + 22, 3, 3, '#3030E0');
  // Button highlights
  px(ctx, x + 15, y + 22, 3, 1, '#F05050');
  px(ctx, x + 20, y + 22, 3, 1, '#5050F0');
  // Coin slot
  px(ctx, x + s / 2 - 2, y + s - 4, 4, 2, PAL.gold);
}

function drawTile(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, s: number, time: number, map: MapData, gx: number, gy: number, deskClaims?: DeskClaim[]) {
  switch (tile) {
    case TILE_VOID:
      ctx.fillStyle = PAL.voidDeep;
      ctx.fillRect(x, y, s, s);
      // Subtle noise pattern in void
      if (tileHash(gx, gy) > 0.7) {
        ctx.fillStyle = PAL.voidMid;
        ctx.fillRect(x + 4, y + 4, 2, 2);
      }
      break;
    case TILE_FLOOR: drawFloorTile(ctx, x, y, s); break;
    case TILE_WALL: drawWall(ctx, x, y, s, map, gx, gy); break;
    case TILE_DOOR: drawDoor(ctx, x, y, s, time); break;
    case TILE_DESK: 
      const deskKey = `${gx}-${gy}`;
      const deskClaim = deskClaims?.find(claim => claim.tileKey === deskKey);
      drawDesk(ctx, x, y, s, deskClaim); 
      break;
    case TILE_CHAIR: drawChair(ctx, x, y, s); break;
    case TILE_COUCH: drawCouch(ctx, x, y, s); break;
    case TILE_PLANT: {
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
      ctx.fillStyle = '#2A1A2A';
      ctx.fillRect(x, y, s, s);
  }
}

// ====================================
// AMBIENT OCCLUSION (enhanced)
// ====================================
function drawAmbientOcclusion(ctx: CanvasRenderingContext2D, map: MapData, startX: number, startY: number, endX: number, endY: number) {
  for (let gy = startY; gy < endY; gy++) {
    for (let gx = startX; gx < endX; gx++) {
      const tile = map.tiles[gy]?.[gx];
      if (tile === undefined || tile === TILE_VOID || SOLID_TILES.has(tile) || tile === TILE_WALL) continue;
      const x = gx * TILE_SIZE, y = gy * TILE_SIZE;
      // Above wall
      if (gy > 0 && map.tiles[gy - 1][gx] === TILE_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y, TILE_SIZE, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(x, y + 6, TILE_SIZE, 4);
      }
      // Left wall
      if (gx > 0 && map.tiles[gy][gx - 1] === TILE_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, 5, TILE_SIZE);
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        ctx.fillRect(x + 5, y, 3, TILE_SIZE);
      }
      // Right wall
      if (gx < map.width - 1 && map.tiles[gy][gx + 1] === TILE_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(x + TILE_SIZE - 5, y, 5, TILE_SIZE);
      }
      // Corner shadows (diagonal)
      if (gy > 0 && gx > 0 && map.tiles[gy - 1][gx - 1] === TILE_WALL
        && map.tiles[gy - 1][gx] !== TILE_WALL && map.tiles[gy][gx - 1] !== TILE_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(x, y, 5, 5);
      }
    }
  }
}

// ====================================
// SPRITE AVATAR SYSTEM (Suikoden 2 style)
// ====================================

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
    st.frame = (st.frame + 0.15) % 4;
  } else {
    st.frame = 0;
    st.bobOffset = (st.bobOffset + 0.03) % (Math.PI * 2);
  }
  st.lastX = x; st.lastY = y;
  return st;
}

function drawSpriteAvatar(ctx: CanvasRenderingContext2D, user: User, pos: { x: number; y: number }, time: number) {
  const wx = pos.x * TILE_SIZE;
  const wy = pos.y * TILE_SIZE;
  const st = getSpriteState(user.id, pos.x, pos.y);

  const bob = st.moving ? 0 : Math.sin(st.bobOffset + time * 0.004) * 1.2;
  const walkBob = st.moving ? Math.sin(Math.floor(st.frame) * Math.PI) * 1.5 : 0;
  const yOff = -10 + bob + walkBob;

  // Shadow (elliptical, Suikoden style)
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(wx, wy + 7, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Speaking ring
  if (user.isSpeaking) {
    const pulse = Math.sin(time * 0.008) * 2.5 + 15;
    ctx.strokeStyle = '#58C060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, wy + yOff, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  const color = user.color;
  const dark = shade(color, -50);
  const mid = shade(color, -20);
  const light = shade(color, 30);
  const lighter = shade(color, 50);
  const skin = '#F0CC98';
  const skinDark = '#D8B080';
  const skinShadow = '#C8A070';
  const hair = dark;
  const hairLight = shade(dark, 25);

  const bx = wx - 12;
  const by = wy + yOff - 14;
  const f = Math.floor(st.frame);

  // ---- HAIR / HEAD ----
  // Hair top (fuller, more detailed)
  px(ctx, bx + 7, by - 1, 10, 3, hair);
  px(ctx, bx + 6, by + 1, 12, 3, hair);
  px(ctx, bx + 8, by - 1, 6, 1, hairLight); // highlight

  // Face
  px(ctx, bx + 7, by + 4, 10, 7, skin);
  px(ctx, bx + 6, by + 5, 12, 5, skin);
  // Chin
  px(ctx, bx + 8, by + 10, 8, 2, skin);
  // Cheek shadow
  px(ctx, bx + 6, by + 7, 1, 3, skinShadow);
  px(ctx, bx + 17, by + 7, 1, 3, skinShadow);

  if (st.dir === 'down') {
    // Side hair
    px(ctx, bx + 5, by + 3, 2, 5, hair);
    px(ctx, bx + 17, by + 3, 2, 5, hair);
    // Eyes (larger, more expressive)
    px(ctx, bx + 9, by + 6, 2, 3, '#FFF');
    px(ctx, bx + 13, by + 6, 2, 3, '#FFF');
    px(ctx, bx + 9, by + 7, 2, 2, '#2A2040');
    px(ctx, bx + 13, by + 7, 2, 2, '#2A2040');
    // Eyebrows
    px(ctx, bx + 8, by + 5, 4, 1, shade(hair, -10));
    px(ctx, bx + 12, by + 5, 4, 1, shade(hair, -10));
    // Nose shadow
    px(ctx, bx + 11, by + 8, 2, 1, skinDark);
    // Mouth
    px(ctx, bx + 10, by + 10, 4, 1, skinDark);
  } else if (st.dir === 'up') {
    // Back of head (hair covers face)
    px(ctx, bx + 6, by + 3, 12, 8, hair);
    px(ctx, bx + 7, by + 4, 10, 7, shade(hair, -8));
    // Hair detail lines
    px(ctx, bx + 9, by + 3, 1, 6, hairLight);
    px(ctx, bx + 13, by + 4, 1, 5, hairLight);
  } else if (st.dir === 'left') {
    // Side hair
    px(ctx, bx + 5, by + 2, 3, 6, hair);
    px(ctx, bx + 16, by + 3, 2, 4, hair);
    // Eye
    px(ctx, bx + 8, by + 6, 2, 3, '#FFF');
    px(ctx, bx + 8, by + 7, 2, 2, '#2A2040');
    px(ctx, bx + 7, by + 5, 3, 1, shade(hair, -10));
    // Nose
    px(ctx, bx + 7, by + 8, 1, 2, skinDark);
    px(ctx, bx + 10, by + 10, 3, 1, skinDark);
  } else {
    // Side hair
    px(ctx, bx + 15, by + 2, 3, 6, hair);
    px(ctx, bx + 6, by + 3, 2, 4, hair);
    // Eye
    px(ctx, bx + 14, by + 6, 2, 3, '#FFF');
    px(ctx, bx + 14, by + 7, 2, 2, '#2A2040');
    px(ctx, bx + 14, by + 5, 3, 1, shade(hair, -10));
    // Nose
    px(ctx, bx + 16, by + 8, 1, 2, skinDark);
    px(ctx, bx + 11, by + 10, 3, 1, skinDark);
  }

  // ---- BODY / SHIRT ----
  // Torso
  px(ctx, bx + 7, by + 12, 10, 8, color);
  // Collar/shoulder highlight
  px(ctx, bx + 8, by + 12, 8, 2, light);
  px(ctx, bx + 9, by + 12, 6, 1, lighter);
  // Shirt wrinkle detail
  px(ctx, bx + 10, by + 16, 4, 1, mid);
  // Belt
  px(ctx, bx + 7, by + 19, 10, 1, shade(dark, -20));
  px(ctx, bx + 11, by + 19, 2, 1, PAL.gold); // belt buckle

  // ---- ARMS ----
  const armSwing = st.moving ? Math.sin(f * 2.1) * 2.5 : 0;
  // Left arm
  px(ctx, bx + 4, by + 13 + armSwing, 3, 7, color);
  px(ctx, bx + 4, by + 13 + armSwing, 3, 1, light);
  px(ctx, bx + 4, by + 19 + armSwing, 3, 2, skin); // hand
  // Right arm
  px(ctx, bx + 17, by + 13 - armSwing, 3, 7, color);
  px(ctx, bx + 17, by + 13 - armSwing, 3, 1, light);
  px(ctx, bx + 17, by + 19 - armSwing, 3, 2, skin); // hand

  // ---- LEGS / PANTS ----
  const legOff = st.moving ? (f === 0 ? 0 : f === 1 ? 2 : f === 2 ? 0 : -2) : 0;
  // Left leg
  px(ctx, bx + 7, by + 20, 4, 5 + (legOff > 0 ? legOff : 0), dark);
  px(ctx, bx + 8, by + 20, 2, 1, shade(dark, 15));
  // Right leg
  px(ctx, bx + 13, by + 20, 4, 5 + (legOff < 0 ? -legOff : 0), dark);
  px(ctx, bx + 14, by + 20, 2, 1, shade(dark, 15));
  // Shoes
  px(ctx, bx + 6, by + 24 + Math.max(0, legOff), 5, 2, '#2A2028');
  px(ctx, bx + 13, by + 24 + Math.max(0, -legOff), 5, 2, '#2A2028');
  // Shoe shine
  px(ctx, bx + 7, by + 24 + Math.max(0, legOff), 3, 1, '#3A3038');
  px(ctx, bx + 14, by + 24 + Math.max(0, -legOff), 3, 1, '#3A3038');

  // ---- NAME TAG (Suikoden-style ornate pill) ----
  const name = user.name;
  ctx.font = 'bold 10px monospace';
  const nameW = ctx.measureText(name).width;
  const tagX = wx - nameW / 2 - 6;
  const tagY = wy + yOff + 20;
  const pillW = nameW + 12;
  const pillH = 15;
  const pillR = 5;

  // Ornate background
  ctx.fillStyle = PAL.labelBg;
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

  // Gold border accent
  ctx.strokeStyle = PAL.labelBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Name text (warm cream)
  ctx.fillStyle = PAL.labelText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, wx, tagY + pillH / 2);

  // Status dot
  const statusColors: Record<string, string> = {
    available: '#58C060', busy: '#D84848', away: '#D8A030', 'in-meeting': '#4888D0',
  };
  ctx.fillStyle = statusColors[user.status] || '#58C060';
  ctx.beginPath();
  ctx.arc(wx + nameW / 2 + 8, tagY + pillH / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  // Status dot border
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Muted indicator
  if (user.isMuted) {
    ctx.fillStyle = 'rgba(216,72,72,0.9)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔇', wx + 14, wy + yOff - 16);
  }
}

// ====================================
// ROOM LABELS (Suikoden 2 style signs)
// ====================================
function drawRoomLabels(ctx: CanvasRenderingContext2D, rooms: Room[]) {
  for (const room of rooms) {
    const rx = (room.bounds.x + room.bounds.width / 2) * TILE_SIZE;
    const ry = (room.bounds.y + 1) * TILE_SIZE;
    ctx.font = 'bold 10px monospace';
    const tw = ctx.measureText(room.name).width;
    const bw = tw + 16, bh = 18;
    const bx = rx - bw / 2, by = ry - bh / 2;

    // Sign background (wooden plaque)
    ctx.fillStyle = 'rgba(80,56,32,0.85)';
    ctx.beginPath();
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

    // Gold border
    ctx.strokeStyle = PAL.labelBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top edge highlight
    ctx.fillStyle = 'rgba(200,168,80,0.15)';
    ctx.fillRect(bx + 4, by + 1, bw - 8, 2);

    // Text
    ctx.fillStyle = PAL.labelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.name, rx, ry);

    // Lock icon for private
    if (room.type === 'private') {
      ctx.fillText('🔒', rx - tw / 2 - 10, ry);
    }
  }
}

// ====================================
// DAY/NIGHT CYCLE (Suikoden 2 dramatic)
// ====================================
function getDayNightTint(): { r: number; g: number; b: number; a: number } {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  if (hour >= 8 && hour <= 17) return { r: 0, g: 0, b: 0, a: 0 };
  // Golden hour (17-19)
  if (hour > 17 && hour <= 19) {
    const t = (hour - 17) / 2;
    return { r: 30, g: 15, b: 0, a: 0.06 * t };
  }
  // Dusk (19-22)
  if (hour > 19 && hour < 22) {
    const t = (hour - 19) / 3;
    return { r: 15, g: 10, b: 40, a: 0.05 + 0.12 * t };
  }
  // Night (22-5)
  if (hour >= 22 || hour <= 5) return { r: 10, g: 8, b: 35, a: 0.18 };
  // Dawn (5-8)
  if (hour > 5 && hour < 8) {
    const t = (hour - 5) / 3;
    return { r: 20, g: 12, b: 30, a: 0.16 * (1 - t) };
  }
  return { r: 0, g: 0, b: 0, a: 0 };
}

// ====================================
// OFF-SCREEN USER ARROWS
// ====================================
function drawOffscreenArrows(
  ctx: CanvasRenderingContext2D, users: User[], currentUserId: string,
  camX: number, camY: number, cw: number, ch: number
) {
  for (const user of users) {
    if (user.id === currentUserId) continue;
    const ux = user.position.x * TILE_SIZE - camX;
    const uy = user.position.y * TILE_SIZE - camY;
    if (ux >= -20 && ux <= cw + 20 && uy >= -20 && uy <= ch + 20) continue;
    const cx = cw / 2, cy = ch / 2;
    const dx = ux - cx, dy = uy - cy;
    const angle = Math.atan2(dy, dx);
    const margin = 30;
    const edgeX = Math.max(margin, Math.min(cw - margin, cx + Math.cos(angle) * (cw / 2 - margin)));
    const edgeY = Math.max(margin, Math.min(ch - margin, cy + Math.sin(angle) * (ch / 2 - margin)));

    ctx.save();
    ctx.translate(edgeX, edgeY);
    ctx.rotate(angle);
    ctx.fillStyle = user.color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-4, -6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate(-angle);
    ctx.font = '9px monospace';
    ctx.fillStyle = user.color;
    ctx.textAlign = 'center';
    ctx.fillText(user.name, 0, -10);
    ctx.restore();
  }
}

// ====================================
// MAIN COMPONENT
// ====================================

function drawReactionBubbles(ctx: CanvasRenderingContext2D, reactionBubbles: ReactionBubble[], time: number) {
  const now = time;
  
  reactionBubbles.forEach(bubble => {
    const age = now - bubble.startTime;
    const duration = 2000; // 2 seconds
    
    if (age > duration) return;
    
    const progress = age / duration;
    const alpha = 1 - progress;
    const yOffset = -progress * 40; // Rise 40 pixels
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Optional: Add a glow effect
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 4;
    
    ctx.fillText(
      bubble.emoji,
      bubble.x * TILE_SIZE,
      bubble.y * TILE_SIZE + yOffset
    );
    
    ctx.restore();
  });
}

export default function OfficeCanvas({ map, users, currentUserId, emotes, deskClaims, reactionBubbles, onMove, onCameraChange }: Props) {
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

      updateParticles(dt);

      // Camera
      const cam = cameraRef.current;
      const targetCamX = playerPosRef.current.x * TILE_SIZE - canvas.width / 2;
      const targetCamY = playerPosRef.current.y * TILE_SIZE - canvas.height / 2;
      cam.x += (targetCamX - cam.x) * 0.08;
      cam.y += (targetCamY - cam.y) * 0.08;

      if (onCameraChange) onCameraChange(cam.x, cam.y);

      // Clear with void color
      ctx.fillStyle = PAL.voidDeep;
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
          drawTile(ctx, tile, gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, time, map, gx, gy, deskClaims);
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

      // Reaction bubbles
      if (reactionBubbles) {
        drawReactionBubbles(ctx, reactionBubbles, time);
      }

      ctx.restore();

      // Day/night tint overlay
      const tint = getDayNightTint();
      if (tint.a > 0) {
        ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Off-screen user arrows
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
