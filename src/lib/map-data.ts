import { MapData, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_DESK, TILE_CHAIR, TILE_COUCH, TILE_PLANT, TILE_WHITEBOARD, TILE_TV, TILE_CARPET } from './types';

const W = 30;
const H = 20;

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

function fillRect(grid: number[][], x: number, y: number, w: number, h: number, tile: number) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const ty = y + dy, tx = x + dx;
      if (ty >= 0 && ty < H && tx >= 0 && tx < W) grid[ty][tx] = tile;
    }
  }
}

function drawWallRect(grid: number[][], x: number, y: number, w: number, h: number) {
  for (let dx = 0; dx < w; dx++) {
    if (y < H && x + dx < W) grid[y][x + dx] = TILE_WALL;
    if (y + h - 1 < H && x + dx < W) grid[y + h - 1][x + dx] = TILE_WALL;
  }
  for (let dy = 0; dy < h; dy++) {
    if (y + dy < H && x < W) grid[y + dy][x] = TILE_WALL;
    if (y + dy < H && x + w - 1 < W) grid[y + dy][x + w - 1] = TILE_WALL;
  }
}

// Safe setter: grid[y][x]
function set(grid: number[][], x: number, y: number, tile: number) {
  if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = tile;
}

function buildDefaultMap(): MapData {
  const grid = createGrid();

  // Main office floor
  fillRect(grid, 1, 1, 28, 18, TILE_FLOOR);

  // Outer walls
  drawWallRect(grid, 0, 0, 30, 20);

  // === Conference Room (top-right, private) ===
  drawWallRect(grid, 22, 1, 7, 6);
  fillRect(grid, 23, 2, 5, 4, TILE_CARPET);
  set(grid, 22, 4, TILE_DOOR); // door on left wall
  set(grid, 24, 3, TILE_DESK); set(grid, 25, 3, TILE_DESK); set(grid, 26, 3, TILE_DESK);
  set(grid, 24, 2, TILE_CHAIR); set(grid, 26, 2, TILE_CHAIR);
  set(grid, 24, 4, TILE_CHAIR); set(grid, 26, 4, TILE_CHAIR);
  set(grid, 25, 2, TILE_TV);

  // === Lounge / Break Room (bottom-right) ===
  drawWallRect(grid, 22, 13, 7, 6);
  fillRect(grid, 23, 14, 5, 4, TILE_CARPET);
  set(grid, 22, 15, TILE_DOOR);
  set(grid, 24, 15, TILE_COUCH); set(grid, 25, 15, TILE_COUCH);
  set(grid, 24, 17, TILE_COUCH); set(grid, 25, 17, TILE_COUCH);
  set(grid, 27, 16, TILE_PLANT);

  // === Engineering Desks (top-left cluster) ===
  fillRect(grid, 2, 2, 8, 6, TILE_CARPET);
  set(grid, 3, 3, TILE_DESK); set(grid, 4, 3, TILE_DESK); set(grid, 5, 3, TILE_DESK); set(grid, 6, 3, TILE_DESK);
  set(grid, 3, 6, TILE_DESK); set(grid, 4, 6, TILE_DESK); set(grid, 5, 6, TILE_DESK); set(grid, 6, 6, TILE_DESK);
  set(grid, 3, 2, TILE_CHAIR); set(grid, 4, 2, TILE_CHAIR); set(grid, 5, 2, TILE_CHAIR); set(grid, 6, 2, TILE_CHAIR);
  set(grid, 3, 7, TILE_CHAIR); set(grid, 4, 7, TILE_CHAIR); set(grid, 5, 7, TILE_CHAIR); set(grid, 6, 7, TILE_CHAIR);

  // === Sales Desks (top-center) ===
  set(grid, 12, 3, TILE_DESK); set(grid, 13, 3, TILE_DESK); set(grid, 14, 3, TILE_DESK);
  set(grid, 12, 6, TILE_DESK); set(grid, 13, 6, TILE_DESK); set(grid, 14, 6, TILE_DESK);
  set(grid, 12, 2, TILE_CHAIR); set(grid, 13, 2, TILE_CHAIR); set(grid, 14, 2, TILE_CHAIR);
  set(grid, 12, 7, TILE_CHAIR); set(grid, 13, 7, TILE_CHAIR); set(grid, 14, 7, TILE_CHAIR);

  // === Support Desks (bottom-left) ===
  set(grid, 3, 12, TILE_DESK); set(grid, 4, 12, TILE_DESK); set(grid, 5, 12, TILE_DESK);
  set(grid, 3, 15, TILE_DESK); set(grid, 4, 15, TILE_DESK); set(grid, 5, 15, TILE_DESK);
  set(grid, 3, 11, TILE_CHAIR); set(grid, 4, 11, TILE_CHAIR); set(grid, 5, 11, TILE_CHAIR);
  set(grid, 3, 16, TILE_CHAIR); set(grid, 4, 16, TILE_CHAIR); set(grid, 5, 16, TILE_CHAIR);

  // === Design Desks (bottom-center) ===
  set(grid, 12, 12, TILE_DESK); set(grid, 13, 12, TILE_DESK); set(grid, 14, 12, TILE_DESK);
  set(grid, 12, 15, TILE_DESK); set(grid, 13, 15, TILE_DESK); set(grid, 14, 15, TILE_DESK);
  set(grid, 12, 11, TILE_CHAIR); set(grid, 13, 11, TILE_CHAIR); set(grid, 14, 11, TILE_CHAIR);
  set(grid, 12, 16, TILE_CHAIR); set(grid, 13, 16, TILE_CHAIR); set(grid, 14, 16, TILE_CHAIR);

  // === Ellie's Corner (bottom-left nook) ===
  fillRect(grid, 1, 17, 5, 2, TILE_CARPET);
  set(grid, 3, 17, TILE_DESK);
  set(grid, 2, 17, TILE_PLANT);

  // === Decorative plants ===
  set(grid, 1, 1, TILE_PLANT);
  set(grid, 28, 1, TILE_PLANT);
  set(grid, 1, 18, TILE_PLANT);
  set(grid, 10, 9, TILE_PLANT);
  set(grid, 17, 9, TILE_PLANT);

  // === Whiteboards ===
  set(grid, 8, 1, TILE_WHITEBOARD);
  set(grid, 15, 1, TILE_WHITEBOARD);
  set(grid, 8, 10, TILE_WHITEBOARD);

  // === Reception / Lobby area (center) ===
  fillRect(grid, 12, 9, 6, 2, TILE_CARPET);
  set(grid, 14, 9, TILE_DESK);

  return {
    width: W,
    height: H,
    tileSize: 32,
    tiles: grid,
    rooms: [
      { id: 'conference', name: 'Conference Room', type: 'private', bounds: { x: 22, y: 1, width: 7, height: 6 } },
      { id: 'lounge', name: 'Lounge', type: 'open', bounds: { x: 22, y: 13, width: 7, height: 6 } },
      { id: 'engineering', name: 'Engineering', type: 'open', bounds: { x: 2, y: 1, width: 8, height: 8 } },
      { id: 'sales', name: 'Sales', type: 'open', bounds: { x: 11, y: 1, width: 6, height: 8 } },
      { id: 'support', name: 'Support', type: 'open', bounds: { x: 2, y: 10, width: 6, height: 8 } },
      { id: 'design', name: 'Design', type: 'open', bounds: { x: 11, y: 10, width: 6, height: 8 } },
      { id: 'ellie', name: "Ellie's Corner", type: 'open', bounds: { x: 1, y: 17, width: 5, height: 2 } },
      { id: 'lobby', name: 'Lobby', type: 'open', bounds: { x: 12, y: 9, width: 6, height: 2 } },
    ],
    spawnPoints: [
      { x: 14, y: 10 },
      { x: 15, y: 10 },
      { x: 14, y: 11 },
      { x: 15, y: 11 },
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

export function isWalkable(map: MapData, x: number, y: number): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
  const tile = map.tiles[y][x];
  const SOLID = new Set([2, 4, 8, 9]);
  return !SOLID.has(tile);
}
