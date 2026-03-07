export interface Position {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  type: 'open' | 'private';
  bounds: { x: number; y: number; width: number; height: number };
}

export interface Furniture {
  type: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface MapData {
  width: number;
  height: number;
  tileSize: number;
  tiles: number[][];
  rooms: Room[];
  spawnPoints: Position[];
  furniture: Furniture[];
}

export type UserStatus = 'available' | 'busy' | 'away' | 'in-meeting';

export interface User {
  id: string;
  name: string;
  color: string;
  title?: string;
  status: UserStatus;
  statusMessage?: string;
  position: Position;
  roomId: string | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  content: string;
  timestamp: number;
  channel: 'global' | 'proximity' | 'room' | 'dm';
  roomId?: string;
  recipientId?: string;
  recipientName?: string;
}

export interface Emote {
  userId: string;
  emoji: string;
  timestamp: number;
  position: Position;
}

export const TILE_VOID = 0;
export const TILE_FLOOR = 1;
export const TILE_WALL = 2;
export const TILE_DOOR = 3;
export const TILE_DESK = 4;
export const TILE_CHAIR = 5;
export const TILE_COUCH = 6;
export const TILE_PLANT = 7;
export const TILE_WHITEBOARD = 8;
export const TILE_TV = 9;
export const TILE_CARPET = 10;

export const TILE_COLORS: Record<number, string> = {
  [TILE_VOID]: '#2D2D2D',
  [TILE_FLOOR]: '#F0EDE6',
  [TILE_WALL]: '#4A4A4A',
  [TILE_DOOR]: '#E8C872',
  [TILE_DESK]: '#8B6914',
  [TILE_CHAIR]: '#6B4F12',
  [TILE_COUCH]: '#7B68AE',
  [TILE_PLANT]: '#4CAF50',
  [TILE_WHITEBOARD]: '#E8E8E8',
  [TILE_TV]: '#333333',
  [TILE_CARPET]: '#5B7FA5',
};

export const TILE_NAMES: Record<number, string> = {
  [TILE_VOID]: 'Void',
  [TILE_FLOOR]: 'Floor',
  [TILE_WALL]: 'Wall',
  [TILE_DOOR]: 'Door',
  [TILE_DESK]: 'Desk',
  [TILE_CHAIR]: 'Chair',
  [TILE_COUCH]: 'Couch',
  [TILE_PLANT]: 'Plant',
  [TILE_WHITEBOARD]: 'Whiteboard',
  [TILE_TV]: 'TV/Screen',
  [TILE_CARPET]: 'Carpet',
};

export const SOLID_TILES = new Set([TILE_WALL, TILE_DESK, TILE_WHITEBOARD, TILE_TV]);

export const PROXIMITY_FULL_VOLUME = 3;
export const PROXIMITY_MAX_DISTANCE = 8;
export const TILE_SIZE = 32;

export interface SignalData {
  userId: string;
  signal: unknown;
}
