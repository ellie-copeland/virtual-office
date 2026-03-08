// ── Shared Game Types ──

export type GameType = 'space-invaders' | 'bomberman' | 'jump-n-bump' | 'zombie-survival';

export interface GameSession {
  id: string;
  type: GameType;
  hostId: string;
  players: GamePlayer[];
  state: 'lobby' | 'playing' | 'ended';
  createdAt: number;
}

export interface GamePlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  alive: boolean;
}

// ── Space Invaders ──

export interface SIAlien {
  x: number;
  y: number;
  type: number; // 0-2
  alive: boolean;
}

export interface SIBullet {
  x: number;
  y: number;
  ownerId: string;
  dy: number; // -1 player, +1 alien
}

export interface SIState {
  aliens: SIAlien[];
  bullets: SIBullet[];
  players: Record<string, { x: number; alive: boolean; score: number }>;
  alienDir: number;
  alienSpeed: number;
  level: number;
  gameOver: boolean;
}

// ── Bomberman ──

export type BMCell = 'empty' | 'wall' | 'brick' | 'powerup-bomb' | 'powerup-fire' | 'powerup-speed';

export interface BMBomb {
  x: number;
  y: number;
  ownerId: string;
  timer: number;
  power: number;
}

export interface BMExplosion {
  x: number;
  y: number;
  timer: number;
}

export interface BMPlayer {
  x: number;
  y: number;
  alive: boolean;
  bombs: number;
  maxBombs: number;
  power: number;
  speed: number;
  score: number;
}

export interface BMState {
  grid: BMCell[][];
  bombs: BMBomb[];
  explosions: BMExplosion[];
  players: Record<string, BMPlayer>;
  gridW: number;
  gridH: number;
  gameOver: boolean;
  winnerId: string | null;
}

// ── Jump 'n Bump ──

export interface JNBPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  score: number;
  facing: number; // -1 left, 1 right
  grounded: boolean;
  respawnTimer: number;
}

export interface JNBParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export interface JNBPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface JNBState {
  players: Record<string, JNBPlayer>;
  particles: JNBParticle[];
  platforms: JNBPlatform[];
  gameOver: boolean;
  winnerId: string | null;
  timeLeft: number; // seconds
}

// ── Zombie Survival ──

export type ZSWeapon = 'pistol' | 'shotgun' | 'rifle';

export interface ZSPlayer {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  weapon: ZSWeapon;
  ammo: number;
  kills: number;
  alive: boolean;
  angle: number;
}

export interface ZSZombie {
  id: string;
  x: number;
  y: number;
  health: number;
  speed: number;
  type: 'normal' | 'fast' | 'tank';
}

export interface ZSPickup {
  id: string;
  x: number;
  y: number;
  type: 'health' | 'ammo' | 'shotgun' | 'rifle';
}

export interface ZSObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ZSBullet {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ownerId: string;
  damage: number;
}

export interface ZSParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export interface ZSState {
  players: Record<string, ZSPlayer>;
  zombies: ZSZombie[];
  pickups: ZSPickup[];
  obstacles: ZSObstacle[];
  bullets: ZSBullet[];
  particles: ZSParticle[];
  wave: number;
  waveTimer: number;
  gameOver: boolean;
  winnerId: string | null;
}

// ── Socket Events ──

export interface GameCreateEvent {
  type: GameType;
}

export interface GameJoinEvent {
  gameId: string;
}

export interface GameInputEvent {
  gameId: string;
  input: any;
}
