export interface Position {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  type: 'open' | 'private' | 'meeting';
  bounds: { x: number; y: number; width: number; height: number };
  meetingRoom?: MeetingRoomConfig;
}

export interface MeetingRoomConfig {
  slug: string;
  capacity: number;
  description?: string;
}

export interface MeetingRoomState {
  roomId: string;
  occupants: string[];
  meetingStartedAt: number | null;
}

export interface ScheduledMeeting {
  id: string;
  title: string;
  roomId: string;
  startTime: string;
  endTime: string;
  organizer: string;
  calendarEventId?: string;
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

// --- Tile constants ---
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
export const TILE_WOOD_FLOOR = 11;
export const TILE_KITCHEN_COUNTER = 12;
export const TILE_FRIDGE = 13;
export const TILE_COFFEE = 14;
export const TILE_BOOKSHELF = 15;
export const TILE_LAMP = 16;
export const TILE_RUG = 17;
export const TILE_OUTDOOR = 18;
export const TILE_PHONE_BOOTH = 19;
export const TILE_ARCADE = 20;

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
  [TILE_WOOD_FLOOR]: '#C4A265',
  [TILE_KITCHEN_COUNTER]: '#8D8D8D',
  [TILE_FRIDGE]: '#D0D8E0',
  [TILE_COFFEE]: '#6F4E37',
  [TILE_BOOKSHELF]: '#5D4037',
  [TILE_LAMP]: '#FFF8E1',
  [TILE_RUG]: '#8E6BAA',
  [TILE_OUTDOOR]: '#7CB342',
  [TILE_PHONE_BOOTH]: '#90A4AE',
  [TILE_ARCADE]: '#7C4DFF',
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
  [TILE_WOOD_FLOOR]: 'Wood Floor',
  [TILE_KITCHEN_COUNTER]: 'Kitchen Counter',
  [TILE_FRIDGE]: 'Fridge',
  [TILE_COFFEE]: 'Coffee Machine',
  [TILE_BOOKSHELF]: 'Bookshelf',
  [TILE_LAMP]: 'Lamp',
  [TILE_RUG]: 'Rug',
  [TILE_OUTDOOR]: 'Outdoor',
  [TILE_PHONE_BOOTH]: 'Phone Booth',
  [TILE_ARCADE]: 'Arcade',
};

export const SOLID_TILES = new Set([
  TILE_WALL, TILE_DESK, TILE_WHITEBOARD, TILE_TV,
  TILE_KITCHEN_COUNTER, TILE_FRIDGE, TILE_COFFEE, TILE_BOOKSHELF, TILE_ARCADE,
]);

export const PROXIMITY_FULL_VOLUME = 3;
export const PROXIMITY_MAX_DISTANCE = 8;
export const TILE_SIZE = 32;

export interface MeetingRoom {
  id: string;
  name: string;
  capacity: number;
  currentUsers: string[];
  scheduledMeetings: {
    title: string;
    startTime: number;
    endTime: number;
    calendarLink?: string;
  }[];
}

export interface SignalData {
  userId: string;
  signal: unknown;
}
