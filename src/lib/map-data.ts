import {
  MapData, Room, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_DESK, TILE_CHAIR,
  TILE_COUCH, TILE_PLANT, TILE_WHITEBOARD, TILE_TV, TILE_CARPET, TILE_WOOD_FLOOR,
  TILE_KITCHEN_COUNTER, TILE_FRIDGE, TILE_COFFEE, TILE_BOOKSHELF, TILE_LAMP,
  TILE_RUG, TILE_OUTDOOR, TILE_PHONE_BOOTH, TILE_ARCADE, SOLID_TILES,
} from './types';

const W = 50;
const H = 35;

function createGrid(): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < H; y++) {
    grid[y] = [];
    for (let x = 0; x < W; x++) {
      grid[y][x] = TILE_VOID;
    }
  }
  return grid;
}

function fill(grid: number[][], x: number, y: number, w: number, h: number, tile: number) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const ty = y + dy, tx = x + dx;
      if (ty >= 0 && ty < H && tx >= 0 && tx < W) grid[ty][tx] = tile;
    }
  }
}

function walls(grid: number[][], x: number, y: number, w: number, h: number) {
  for (let dx = 0; dx < w; dx++) {
    set(grid, x + dx, y, TILE_WALL);
    set(grid, x + dx, y + h - 1, TILE_WALL);
  }
  for (let dy = 0; dy < h; dy++) {
    set(grid, x, y + dy, TILE_WALL);
    set(grid, x + w - 1, y + dy, TILE_WALL);
  }
}

function set(grid: number[][], x: number, y: number, tile: number) {
  if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = tile;
}

function buildDefaultMap(): MapData {
  const g = createGrid();

  // ==========================================
  // MAIN BUILDING - fill entire interior
  // ==========================================
  // Outer walls enclose rows 0..27, cols 0..42
  fill(g, 1, 1, 41, 26, TILE_FLOOR);
  walls(g, 0, 0, 43, 28);

  // ==========================================
  // HALLWAYS (wood floor) — central cross
  // ==========================================
  // Horizontal hallway y=13..14
  fill(g, 1, 13, 41, 2, TILE_WOOD_FLOOR);
  // Vertical hallway x=20..21
  fill(g, 20, 1, 2, 26, TILE_WOOD_FLOOR);

  // ==========================================
  // ENGINEERING (top-left) — 1,1 to 19,12
  // ==========================================
  fill(g, 1, 1, 19, 12, TILE_CARPET);
  // internal walls along bottom (y=12) and right (x=19)
  for (let x = 1; x < 20; x++) set(g, x, 12, TILE_WALL);
  set(g, 10, 12, TILE_DOOR);
  for (let y = 1; y < 12; y++) set(g, 19, y, TILE_WALL);
  set(g, 19, 6, TILE_DOOR);

  // Desks (4 pods of 2)
  for (const bx of [3, 10]) {
    for (const by of [3, 8]) {
      set(g, bx, by, TILE_DESK); set(g, bx + 1, by, TILE_DESK);
      set(g, bx + 3, by, TILE_DESK); set(g, bx + 4, by, TILE_DESK);
      set(g, bx, by - 1, TILE_CHAIR); set(g, bx + 1, by - 1, TILE_CHAIR);
      set(g, bx + 3, by - 1, TILE_CHAIR); set(g, bx + 4, by - 1, TILE_CHAIR);
      set(g, bx, by + 1, TILE_CHAIR); set(g, bx + 1, by + 1, TILE_CHAIR);
      set(g, bx + 3, by + 1, TILE_CHAIR); set(g, bx + 4, by + 1, TILE_CHAIR);
    }
  }
  set(g, 1, 1, TILE_PLANT); set(g, 18, 1, TILE_PLANT);
  set(g, 9, 1, TILE_WHITEBOARD);
  set(g, 1, 6, TILE_LAMP); set(g, 18, 6, TILE_LAMP);

  // ==========================================
  // CONFERENCE ROOM A (top-right large) — 22,1 to 33,12
  // ==========================================
  fill(g, 22, 1, 12, 12, TILE_CARPET);
  for (let x = 22; x <= 33; x++) set(g, x, 12, TILE_WALL);
  for (let y = 1; y < 12; y++) set(g, 22, y, TILE_WALL);
  for (let y = 1; y < 12; y++) set(g, 33, y, TILE_WALL);
  set(g, 22, 6, TILE_DOOR);
  // Big table
  fill(g, 25, 4, 5, 1, TILE_DESK); fill(g, 25, 7, 5, 1, TILE_DESK);
  for (let x = 25; x <= 29; x++) { set(g, x, 3, TILE_CHAIR); set(g, x, 8, TILE_CHAIR); }
  set(g, 24, 5, TILE_CHAIR); set(g, 24, 6, TILE_CHAIR);
  set(g, 30, 5, TILE_CHAIR); set(g, 30, 6, TILE_CHAIR);
  set(g, 27, 1, TILE_TV);
  set(g, 23, 1, TILE_PLANT); set(g, 32, 1, TILE_PLANT);

  // ==========================================
  // CONFERENCE ROOM B (small, far right) — 35,1 to 41,8
  // ==========================================
  fill(g, 35, 1, 7, 8, TILE_RUG);
  for (let x = 34; x <= 41; x++) set(g, x, 8, TILE_WALL);
  for (let y = 1; y <= 8; y++) set(g, 34, y, TILE_WALL);
  set(g, 34, 4, TILE_DOOR);
  set(g, 37, 3, TILE_DESK); set(g, 38, 3, TILE_DESK);
  set(g, 37, 5, TILE_DESK); set(g, 38, 5, TILE_DESK);
  set(g, 37, 2, TILE_CHAIR); set(g, 38, 2, TILE_CHAIR);
  set(g, 37, 6, TILE_CHAIR); set(g, 38, 6, TILE_CHAIR);
  set(g, 39, 1, TILE_WHITEBOARD);

  // ==========================================
  // PHONE BOOTHS (far right, below conf B) — 35,10 to 41,12
  // ==========================================
  for (let bx = 35; bx <= 39; bx += 2) {
    fill(g, bx, 10, 2, 2, TILE_PHONE_BOOTH);
    walls(g, bx, 9, 2, 4);
    fill(g, bx, 10, 2, 2, TILE_PHONE_BOOTH);
    set(g, bx, 12, TILE_DOOR);
  }
  // Fill floor around phone booths
  fill(g, 35, 9, 7, 1, TILE_FLOOR);

  // ==========================================
  // SALES / BIZ (bottom-left) — 1,15 to 12,27
  // ==========================================
  fill(g, 1, 15, 12, 12, TILE_WOOD_FLOOR);
  for (let x = 1; x <= 12; x++) set(g, x, 15, TILE_WALL);
  for (let y = 15; y < 27; y++) set(g, 12, y, TILE_WALL);
  set(g, 6, 15, TILE_DOOR); set(g, 12, 20, TILE_DOOR);

  set(g, 3, 17, TILE_DESK); set(g, 4, 17, TILE_DESK); set(g, 5, 17, TILE_DESK);
  set(g, 3, 20, TILE_DESK); set(g, 4, 20, TILE_DESK); set(g, 5, 20, TILE_DESK);
  set(g, 8, 17, TILE_DESK); set(g, 9, 17, TILE_DESK); set(g, 10, 17, TILE_DESK);
  set(g, 8, 20, TILE_DESK); set(g, 9, 20, TILE_DESK); set(g, 10, 20, TILE_DESK);
  for (const x of [3, 4, 5, 8, 9, 10]) {
    set(g, x, 16, TILE_CHAIR); set(g, x, 18, TILE_CHAIR);
    set(g, x, 19, TILE_CHAIR); set(g, x, 21, TILE_CHAIR);
  }
  set(g, 1, 15, TILE_PLANT); set(g, 1, 26, TILE_PLANT);
  set(g, 6, 23, TILE_BOOKSHELF); set(g, 7, 23, TILE_BOOKSHELF);
  set(g, 1, 23, TILE_LAMP);

  // ==========================================
  // DESIGN AREA (bottom-center) — 13,15 to 19,27
  // ==========================================
  fill(g, 13, 15, 7, 12, TILE_CARPET);
  for (let x = 13; x <= 19; x++) set(g, x, 15, TILE_WALL);
  for (let y = 15; y < 27; y++) set(g, 19, y, TILE_WALL);
  set(g, 16, 15, TILE_DOOR); set(g, 19, 20, TILE_DOOR);

  set(g, 14, 17, TILE_DESK); set(g, 15, 17, TILE_DESK); set(g, 17, 17, TILE_DESK);
  set(g, 14, 22, TILE_DESK); set(g, 15, 22, TILE_DESK); set(g, 17, 22, TILE_DESK);
  set(g, 14, 16, TILE_CHAIR); set(g, 15, 16, TILE_CHAIR); set(g, 17, 16, TILE_CHAIR);
  set(g, 14, 23, TILE_CHAIR); set(g, 15, 23, TILE_CHAIR); set(g, 17, 23, TILE_CHAIR);
  set(g, 13, 19, TILE_WHITEBOARD);
  set(g, 13, 25, TILE_PLANT); set(g, 18, 25, TILE_PLANT);
  set(g, 18, 19, TILE_LAMP);

  // ==========================================
  // KITCHEN / BREAK ROOM (right-center) — 22,15 to 33,27
  // ==========================================
  fill(g, 22, 15, 12, 12, TILE_WOOD_FLOOR);
  for (let x = 22; x <= 33; x++) set(g, x, 15, TILE_WALL);
  for (let y = 15; y < 27; y++) set(g, 22, y, TILE_WALL);
  for (let y = 15; y < 27; y++) set(g, 33, y, TILE_WALL);
  set(g, 22, 20, TILE_DOOR); set(g, 33, 20, TILE_DOOR);

  // Counter along top wall
  for (let x = 24; x <= 31; x++) set(g, x, 16, TILE_KITCHEN_COUNTER);
  set(g, 24, 16, TILE_COFFEE); set(g, 31, 16, TILE_FRIDGE);
  // Eating area
  set(g, 26, 20, TILE_DESK); set(g, 27, 20, TILE_DESK);
  set(g, 26, 19, TILE_CHAIR); set(g, 27, 19, TILE_CHAIR);
  set(g, 26, 21, TILE_CHAIR); set(g, 27, 21, TILE_CHAIR);
  set(g, 29, 20, TILE_DESK); set(g, 30, 20, TILE_DESK);
  set(g, 29, 19, TILE_CHAIR); set(g, 30, 19, TILE_CHAIR);
  set(g, 29, 21, TILE_CHAIR); set(g, 30, 21, TILE_CHAIR);
  // Couches
  set(g, 24, 24, TILE_COUCH); set(g, 25, 24, TILE_COUCH); set(g, 26, 24, TILE_COUCH);
  set(g, 24, 25, TILE_RUG); set(g, 25, 25, TILE_RUG); set(g, 26, 25, TILE_RUG);
  set(g, 30, 24, TILE_PLANT); set(g, 32, 16, TILE_PLANT);
  set(g, 23, 26, TILE_LAMP); set(g, 32, 26, TILE_LAMP);

  // ==========================================
  // GAME ROOM (far right bottom) — 35,15 to 41,27
  // ==========================================
  fill(g, 35, 15, 7, 12, TILE_CARPET);
  for (let x = 34; x <= 41; x++) set(g, x, 15, TILE_WALL);
  for (let y = 15; y <= 27; y++) set(g, 34, y, TILE_WALL);
  for (let x = 34; x <= 41; x++) set(g, x, 27, TILE_WALL);
  set(g, 34, 20, TILE_DOOR);
  fill(g, 35, 13, 7, 2, TILE_FLOOR); // hallway approach

  set(g, 36, 16, TILE_ARCADE); set(g, 38, 16, TILE_ARCADE); set(g, 40, 16, TILE_ARCADE);
  set(g, 36, 19, TILE_COUCH); set(g, 37, 19, TILE_COUCH); set(g, 38, 19, TILE_COUCH);
  set(g, 36, 22, TILE_TV);
  set(g, 36, 24, TILE_COUCH); set(g, 37, 24, TILE_COUCH);
  set(g, 40, 22, TILE_PLANT);
  set(g, 35, 26, TILE_LAMP); set(g, 40, 26, TILE_LAMP);

  // ==========================================
  // LOBBY (center hallway intersection)
  // ==========================================
  fill(g, 15, 13, 10, 2, TILE_RUG);
  set(g, 17, 13, TILE_PLANT); set(g, 22, 13, TILE_PLANT);

  // ==========================================
  // OUTDOOR PATIO — 0,29 to 42,34
  // ==========================================
  fill(g, 0, 28, 43, 7, TILE_OUTDOOR);
  // Doorways from building
  set(g, 10, 27, TILE_DOOR); set(g, 20, 27, TILE_DOOR); set(g, 30, 27, TILE_DOOR);
  // Patio furniture
  set(g, 5, 30, TILE_DESK); set(g, 6, 30, TILE_DESK);
  set(g, 5, 31, TILE_CHAIR); set(g, 6, 31, TILE_CHAIR);
  set(g, 15, 30, TILE_DESK); set(g, 16, 30, TILE_DESK);
  set(g, 15, 31, TILE_CHAIR); set(g, 16, 31, TILE_CHAIR);
  set(g, 25, 30, TILE_COUCH); set(g, 26, 30, TILE_COUCH); set(g, 27, 30, TILE_COUCH);
  set(g, 35, 30, TILE_PLANT); set(g, 38, 30, TILE_PLANT);
  set(g, 10, 32, TILE_PLANT); set(g, 20, 32, TILE_PLANT); set(g, 30, 32, TILE_PLANT);
  // edge patio walls (low walls / fence)
  for (let x = 0; x < 43; x++) set(g, x, 34, TILE_WALL);
  for (let y = 28; y < 35; y++) { set(g, 0, y, TILE_WALL); set(g, 42, y, TILE_WALL); }
  // re-open doors
  set(g, 10, 27, TILE_DOOR); set(g, 20, 27, TILE_DOOR); set(g, 30, 27, TILE_DOOR);

  // ==========================================
  // Far-right column walls fix
  // ==========================================
  for (let y = 0; y < 28; y++) set(g, 42, y, TILE_WALL);

  return {
    width: W,
    height: H,
    tileSize: 32,
    tiles: g,
    rooms: [
      { id: 'engineering', name: 'Engineering', type: 'open', bounds: { x: 1, y: 1, width: 18, height: 11 } },
      { id: 'conference-a', name: 'Board Room', type: 'meeting', bounds: { x: 23, y: 1, width: 10, height: 11 },
        meetingRoom: { slug: 'board-room', capacity: 10, description: 'Large meetings & presentations' } },
      { id: 'conference-b', name: 'Standup Room', type: 'meeting', bounds: { x: 35, y: 1, width: 6, height: 7 },
        meetingRoom: { slug: 'standup', capacity: 6, description: 'Quick daily standups' } },
      { id: 'phone-1', name: '1:1 Room', type: 'meeting', bounds: { x: 35, y: 10, width: 2, height: 2 },
        meetingRoom: { slug: '1-on-1', capacity: 2, description: 'Private 1:1 conversations' } },
      { id: 'phone-2', name: 'Focus Room', type: 'meeting', bounds: { x: 37, y: 10, width: 2, height: 2 },
        meetingRoom: { slug: 'focus', capacity: 2, description: 'Focused work sessions' } },
      { id: 'phone-3', name: 'Phone Booth', type: 'private', bounds: { x: 39, y: 10, width: 2, height: 2 } },
      { id: 'sales', name: 'Sales', type: 'open', bounds: { x: 1, y: 16, width: 11, height: 10 } },
      { id: 'design', name: 'Design', type: 'open', bounds: { x: 13, y: 16, width: 6, height: 10 } },
      { id: 'kitchen', name: 'Kitchen', type: 'open', bounds: { x: 23, y: 16, width: 10, height: 10 } },
      { id: 'game-room', name: 'All Hands', type: 'meeting', bounds: { x: 35, y: 16, width: 6, height: 10 },
        meetingRoom: { slug: 'all-hands', capacity: 20, description: 'Company-wide meetings' } },
      { id: 'lobby', name: 'Lobby', type: 'open', bounds: { x: 15, y: 13, width: 10, height: 2 } },
      { id: 'patio', name: 'Patio', type: 'open', bounds: { x: 1, y: 28, width: 41, height: 6 } },
    ],
    spawnPoints: [
      { x: 20, y: 13 },
      { x: 21, y: 13 },
      { x: 20, y: 14 },
      { x: 21, y: 14 },
    ],
    furniture: [],
  };
}

export const defaultMap = buildDefaultMap();

export function getRoomAt(map: MapData, x: number, y: number): string | null {
  for (const room of map.rooms) {
    const b = room.bounds;
    if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
      return room.id;
    }
  }
  return null;
}

export function getMeetingRoomBySlug(map: MapData, slug: string): Room | undefined {
  return map.rooms.find(r => r.meetingRoom?.slug === slug);
}

export function isWalkable(map: MapData, x: number, y: number): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
  const tile = map.tiles[y][x];
  return !SOLID_TILES.has(tile);
}
