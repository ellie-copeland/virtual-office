import { Server as SocketServer, Socket } from 'socket.io';
import {
  GameSession, GameType, GamePlayer,
  SIState, SIAlien, SIBullet,
  BMState, BMCell, BMBomb, BMExplosion, BMPlayer,
  JNBState, JNBPlayer, JNBParticle, JNBPlatform,
  ZSState, ZSZombie, ZSBullet, ZSPickup, ZSObstacle, ZSParticle, ZSPlayer, ZSWeapon,
} from '../lib/game-types';

const games = new Map<string, GameSession>();
const siStates = new Map<string, SIState>();
const bmStates = new Map<string, BMState>();
const jnbStates = new Map<string, JNBState>();
const zsStates = new Map<string, ZSState>();
const zsLastShot = new Map<string, number>(); // playerId -> last shot timestamp
const zsLastMelee = new Map<string, number>(); // zombieId:playerId -> last melee timestamp
const zsPickupTimers = new Map<string, number>(); // gameId -> tick counter for pickup spawning
const gameIntervals = new Map<string, ReturnType<typeof setInterval>>();

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ════════════════════════════════════════
// SPACE INVADERS
// ════════════════════════════════════════

function createSIState(players: GamePlayer[]): SIState {
  const aliens: SIAlien[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 11; col++) {
      aliens.push({ x: 60 + col * 40, y: 40 + row * 32, type: row < 1 ? 2 : row < 3 ? 1 : 0, alive: true });
    }
  }
  const spacing = 600 / (players.length + 1);
  const pMap: Record<string, { x: number; alive: boolean; score: number }> = {};
  players.forEach((p, i) => {
    pMap[p.id] = { x: spacing * (i + 1), alive: true, score: 0 };
  });
  return { aliens, bullets: [], players: pMap, alienDir: 1, alienSpeed: 0.5, level: 1, gameOver: false };
}

function tickSI(gameId: string, io: SocketServer) {
  const st = siStates.get(gameId);
  if (!st || st.gameOver) return;

  // Move aliens
  let edgeHit = false;
  for (const a of st.aliens) {
    if (!a.alive) continue;
    a.x += st.alienDir * st.alienSpeed;
    if (a.x < 20 || a.x > 580) edgeHit = true;
  }
  if (edgeHit) {
    st.alienDir *= -1;
    for (const a of st.aliens) { if (a.alive) a.y += 16; }
  }

  // Move bullets
  st.bullets = st.bullets.filter(b => b.y > -10 && b.y < 460);
  for (const b of st.bullets) b.y += b.dy * 5;

  // Collision: player bullets → aliens
  for (const b of st.bullets) {
    if (b.dy > 0) continue; // alien bullet
    for (const a of st.aliens) {
      if (!a.alive) continue;
      if (Math.abs(b.x - a.x) < 16 && Math.abs(b.y - a.y) < 12) {
        a.alive = false;
        b.y = -100; // remove
        const pts = a.type === 2 ? 30 : a.type === 1 ? 20 : 10;
        if (st.players[b.ownerId]) st.players[b.ownerId].score += pts;
      }
    }
  }

  // Collision: alien bullets → players
  for (const b of st.bullets) {
    if (b.dy < 0) continue;
    for (const [pid, p] of Object.entries(st.players)) {
      if (!p.alive) continue;
      if (Math.abs(b.x - p.x) < 16 && Math.abs(b.y - 420) < 12) {
        p.alive = false;
        b.y = 500;
      }
    }
  }

  // Alien shooting (random)
  const aliveAliens = st.aliens.filter(a => a.alive);
  if (aliveAliens.length > 0 && Math.random() < 0.02) {
    const a = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
    st.bullets.push({ x: a.x, y: a.y + 12, ownerId: '__alien', dy: 1 });
  }

  // Check game over
  const allDead = aliveAliens.length === 0;
  const allPlayersDead = Object.values(st.players).every(p => !p.alive);
  const aliensReachedBottom = aliveAliens.some(a => a.y > 400);

  if (allDead) {
    // Next level
    st.level++;
    st.alienSpeed += 0.3;
    const newAliens: SIAlien[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 11; col++) {
        newAliens.push({ x: 60 + col * 40, y: 40 + row * 32, type: row < 1 ? 2 : row < 3 ? 1 : 0, alive: true });
      }
    }
    st.aliens = newAliens;
    st.bullets = [];
    // Revive all players
    for (const p of Object.values(st.players)) p.alive = true;
  } else if (allPlayersDead || aliensReachedBottom) {
    st.gameOver = true;
  }

  st.bullets = st.bullets.filter(b => b.y > -10 && b.y < 460);
  io.to(gameId).emit('game:state', { gameId, state: st });
}

// ════════════════════════════════════════
// BOMBERMAN
// ════════════════════════════════════════

const BM_W = 13;
const BM_H = 11;

function createBMState(players: GamePlayer[]): BMState {
  const grid: BMCell[][] = [];
  for (let y = 0; y < BM_H; y++) {
    grid[y] = [];
    for (let x = 0; x < BM_W; x++) {
      if (x === 0 || y === 0 || x === BM_W - 1 || y === BM_H - 1) grid[y][x] = 'wall';
      else if (x % 2 === 0 && y % 2 === 0) grid[y][x] = 'wall';
      else grid[y][x] = Math.random() < 0.6 ? 'brick' : 'empty';
    }
  }
  // Clear spawn corners
  const corners = [[1,1],[1,2],[2,1], [BM_W-2,1],[BM_W-3,1],[BM_W-2,2],
                   [1,BM_H-2],[2,BM_H-2],[1,BM_H-3], [BM_W-2,BM_H-2],[BM_W-3,BM_H-2],[BM_W-2,BM_H-3]];
  for (const [cx,cy] of corners) { if (grid[cy] && grid[cy][cx]) grid[cy][cx] = 'empty'; }

  const spawns = [[1,1],[BM_W-2,1],[1,BM_H-2],[BM_W-2,BM_H-2],
                   [1,Math.floor(BM_H/2)],[BM_W-2,Math.floor(BM_H/2)],
                   [Math.floor(BM_W/2),1],[Math.floor(BM_W/2),BM_H-2],
                   [3,3],[BM_W-4,BM_H-4]];
  // Clear spawn areas for extra positions
  for (const [sx,sy] of spawns) {
    if (grid[sy]?.[sx]) grid[sy][sx] = 'empty';
    if (grid[sy]?.[sx+1]) grid[sy][sx+1] = 'empty';
    if (grid[sy+1]?.[sx]) grid[sy+1][sx] = 'empty';
  }
  const pMap: Record<string, BMPlayer> = {};
  players.forEach((p, i) => {
    const sp = spawns[i % spawns.length];
    pMap[p.id] = { x: sp[0], y: sp[1], alive: true, bombs: 0, maxBombs: 1, power: 1, speed: 1, score: 0 };
  });
  return { grid, bombs: [], explosions: [], players: pMap, gridW: BM_W, gridH: BM_H, gameOver: false, winnerId: null };
}

function explodeBM(st: BMState, bx: number, by: number, power: number, ownerId: string) {
  const dirs = [[0,0],[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx, dy] of dirs) {
    const range = dx === 0 && dy === 0 ? 1 : power;
    for (let i = (dx === 0 && dy === 0 ? 0 : 1); i <= range; i++) {
      const nx = bx + dx * i;
      const ny = by + dy * i;
      if (nx < 0 || nx >= BM_W || ny < 0 || ny >= BM_H) break;
      const cell = st.grid[ny][nx];
      if (cell === 'wall') break;
      st.explosions.push({ x: nx, y: ny, timer: 8 });
      if (cell === 'brick') {
        // Random powerup
        const r = Math.random();
        st.grid[ny][nx] = r < 0.2 ? 'powerup-bomb' : r < 0.4 ? 'powerup-fire' : r < 0.55 ? 'powerup-speed' : 'empty';
        break;
      }
      // Kill players in explosion
      for (const [pid, p] of Object.entries(st.players)) {
        if (!p.alive) continue;
        if (Math.round(p.x) === nx && Math.round(p.y) === ny) {
          p.alive = false;
          if (st.players[ownerId] && ownerId !== pid) st.players[ownerId].score++;
        }
      }
      // Chain bomb explosions
      const chainIdx = st.bombs.findIndex(b => b.x === nx && b.y === ny);
      if (chainIdx >= 0) {
        const chain = st.bombs.splice(chainIdx, 1)[0];
        explodeBM(st, chain.x, chain.y, chain.power, chain.ownerId);
      }
    }
  }
}

function tickBM(gameId: string, io: SocketServer) {
  const st = bmStates.get(gameId);
  if (!st || st.gameOver) return;

  // Tick bombs
  for (let i = st.bombs.length - 1; i >= 0; i--) {
    st.bombs[i].timer--;
    if (st.bombs[i].timer <= 0) {
      const b = st.bombs.splice(i, 1)[0];
      if (st.players[b.ownerId]) st.players[b.ownerId].bombs--;
      explodeBM(st, b.x, b.y, b.power, b.ownerId);
    }
  }

  // Tick explosions
  st.explosions = st.explosions.filter(e => { e.timer--; return e.timer > 0; });

  // Check powerup pickups
  for (const [pid, p] of Object.entries(st.players)) {
    if (!p.alive) continue;
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    if (cx >= 0 && cx < BM_W && cy >= 0 && cy < BM_H) {
      const cell = st.grid[cy][cx];
      if (cell === 'powerup-bomb') { p.maxBombs++; st.grid[cy][cx] = 'empty'; }
      else if (cell === 'powerup-fire') { p.power++; st.grid[cy][cx] = 'empty'; }
      else if (cell === 'powerup-speed') { p.speed = Math.min(p.speed + 0.5, 3); st.grid[cy][cx] = 'empty'; }
    }
  }

  // Check winner
  const alivePlayers = Object.entries(st.players).filter(([, p]) => p.alive);
  if (alivePlayers.length <= 1 && Object.keys(st.players).length > 1) {
    st.gameOver = true;
    st.winnerId = alivePlayers.length === 1 ? alivePlayers[0][0] : null;
  }

  io.to(gameId).emit('game:state', { gameId, state: st });
}

// ════════════════════════════════════════
// JUMP 'N BUMP
// ════════════════════════════════════════

const JNB_W = 600;
const JNB_H = 450;
const JNB_GRAVITY = 0.4;
const JNB_JUMP = -9;
const JNB_SPEED = 3;
const JNB_TIME = 120; // 2 minutes

function createJNBState(players: GamePlayer[]): JNBState {
  const platforms: JNBPlatform[] = [
    // Ground
    { x: 0, y: 420, w: 600, h: 30 },
    // Platforms
    { x: 50, y: 340, w: 120, h: 12 },
    { x: 230, y: 280, w: 140, h: 12 },
    { x: 430, y: 340, w: 120, h: 12 },
    { x: 100, y: 200, w: 100, h: 12 },
    { x: 350, y: 200, w: 100, h: 12 },
    { x: 200, y: 130, w: 200, h: 12 },
    { x: 50, y: 70, w: 80, h: 12 },
    { x: 470, y: 70, w: 80, h: 12 },
  ];

  const spawns = [[100, 380], [500, 380], [300, 240], [200, 90]];
  const pMap: Record<string, JNBPlayer> = {};
  players.forEach((p, i) => {
    const sp = spawns[i % spawns.length];
    pMap[p.id] = {
      x: sp[0], y: sp[1], vx: 0, vy: 0,
      alive: true, score: 0, facing: 1, grounded: false, respawnTimer: 0,
    };
  });
  return { players: pMap, particles: [], platforms, gameOver: false, winnerId: null, timeLeft: JNB_TIME };
}

let jnbTickCount = 0;

function tickJNB(gameId: string, io: SocketServer) {
  const st = jnbStates.get(gameId);
  if (!st || st.gameOver) return;

  jnbTickCount++;
  // Decrement timer every 30 ticks (~1 second at 30fps)
  if (jnbTickCount % 30 === 0) {
    st.timeLeft--;
    if (st.timeLeft <= 0) {
      st.gameOver = true;
      let maxScore = -1;
      for (const [pid, p] of Object.entries(st.players)) {
        if (p.score > maxScore) { maxScore = p.score; st.winnerId = pid; }
      }
    }
  }

  for (const [pid, p] of Object.entries(st.players)) {
    if (p.respawnTimer > 0) {
      p.respawnTimer--;
      if (p.respawnTimer === 0) {
        p.alive = true;
        p.x = 100 + Math.random() * 400;
        p.y = 50;
        p.vx = 0;
        p.vy = 0;
      }
      continue;
    }
    if (!p.alive) continue;

    // Apply gravity
    p.vy += JNB_GRAVITY;
    p.x += p.vx;
    p.y += p.vy;

    // Friction
    p.vx *= 0.85;

    // Platform collision
    p.grounded = false;
    for (const plat of st.platforms) {
      // Only collide from above
      if (p.vy >= 0 && p.x + 8 > plat.x && p.x - 8 < plat.x + plat.w) {
        if (p.y >= plat.y - 16 && p.y <= plat.y + plat.h) {
          p.y = plat.y - 16;
          p.vy = 0;
          p.grounded = true;
        }
      }
    }

    // World bounds
    if (p.x < 8) { p.x = 8; p.vx = 0; }
    if (p.x > JNB_W - 8) { p.x = JNB_W - 8; p.vx = 0; }
    if (p.y > JNB_H + 50) {
      // Fell off — respawn
      p.alive = false;
      p.respawnTimer = 60;
    }
  }

  // Head stomp detection
  const entries = Object.entries(st.players);
  for (let i = 0; i < entries.length; i++) {
    const [aid, a] = entries[i];
    if (!a.alive || a.respawnTimer > 0) continue;
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const [bid, b] = entries[j];
      if (!b.alive || b.respawnTimer > 0) continue;

      const dx = Math.abs(a.x - b.x);
      const dy = a.y - b.y;
      // A is above B and falling
      if (dx < 14 && dy < -8 && dy > -24 && a.vy > 0) {
        // A stomps B
        b.alive = false;
        b.respawnTimer = 90;
        a.vy = JNB_JUMP * 0.6; // bounce
        a.score++;

        // Spawn particles (gibs)
        const game = games.get(gameId);
        const victim = game?.players.find(p => p.id === bid);
        const color = victim?.color || '#ff0000';
        for (let k = 0; k < 12; k++) {
          st.particles.push({
            x: b.x, y: b.y,
            vx: (Math.random() - 0.5) * 8,
            vy: -Math.random() * 8 - 2,
            color,
            life: 30 + Math.random() * 20,
          });
        }
      }
    }
  }

  // Tick particles
  st.particles = st.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life--;
    return p.life > 0;
  });

  io.to(gameId).emit('game:state', { gameId, state: st });
}

// ════════════════════════════════════════
// ZOMBIE SURVIVAL
// ════════════════════════════════════════

const ZS_W = 800;
const ZS_H = 600;

function initZombieGame(gameId: string, players: Map<string, { name: string; color: string }>): ZSState {
  // Generate 10 random obstacles avoiding edges (40px margin) and player spawn center area (300-500 x 200-400)
  const obstacles: ZSObstacle[] = [];
  while (obstacles.length < 10) {
    const x = 40 + Math.random() * (ZS_W - 120); // avoid edges
    const y = 40 + Math.random() * (ZS_H - 120);
    // Skip if overlapping center spawn area
    if (x + 40 > 250 && x < 550 && y + 40 > 150 && y < 450) continue;
    // Skip if overlapping existing obstacle
    const overlap = obstacles.some(o =>
      x < o.x + o.w && x + 40 > o.x && y < o.y + o.h && y + 40 > o.y
    );
    if (overlap) continue;
    obstacles.push({ x, y, w: 40, h: 40 });
  }

  const state: ZSState = {
    players: {},
    zombies: [],
    pickups: [],
    obstacles,
    bullets: [],
    particles: [],
    wave: 0,
    waveTimer: 100, // 5s at 20fps
    gameOver: false,
    winnerId: null,
  };

  // Add players with random spawn positions in center area
  players.forEach((_, playerId) => {
    state.players[playerId] = {
      x: 300 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      health: 100,
      maxHealth: 100,
      weapon: 'pistol',
      ammo: 999,
      kills: 0,
      alive: true,
      angle: 0,
    };
  });

  zsStates.set(gameId, state);
  return state;
}

function spawnZombieWave(state: ZSState) {
  state.wave++;
  const count = 5 + state.wave * 3;

  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    const type: ZSZombie['type'] = roll < 0.7 ? 'normal' : roll < 0.9 ? 'fast' : 'tank';
    const stats = type === 'normal' ? { health: 3, speed: 1.5 }
      : type === 'fast' ? { health: 1, speed: 3 }
      : { health: 10, speed: 0.8 };

    // Random edge spawn
    const edge = Math.floor(Math.random() * 4);
    let x: number, y: number;
    switch (edge) {
      case 0: x = Math.random() * ZS_W; y = 0; break;          // top
      case 1: x = Math.random() * ZS_W; y = ZS_H; break;       // bottom
      case 2: x = 0; y = Math.random() * ZS_H; break;           // left
      default: x = ZS_W; y = Math.random() * ZS_H; break;       // right
    }

    state.zombies.push({ id: genId(), x, y, health: stats.health, speed: stats.speed, type });
  }

  state.waveTimer = 0;
}

const WEAPON_STATS: Record<ZSWeapon, { damage: number; rate: number; bullets: number; spread: number }> = {
  pistol: { damage: 1, rate: 6, bullets: 1, spread: 0 },
  shotgun: { damage: 1, rate: 16, bullets: 5, spread: 0.3 },
  rifle: { damage: 2, rate: 3, bullets: 1, spread: 0 },
};

const zsTickCount = new Map<string, number>();

function tickZombie(gameId: string, io: SocketServer) {
  const state = zsStates.get(gameId);
  const game = games.get(gameId);
  if (!state || !game) return;
  if (state.gameOver) {
    game.state = 'ended';
    const interval = gameIntervals.get(gameId);
    if (interval) clearInterval(interval);
    return;
  }

  const tick = (zsTickCount.get(gameId) || 0) + 1;
  zsTickCount.set(gameId, tick);
  const alivePlayers = Object.entries(state.players).filter(([, p]) => p.alive);

  // Wave logic
  if (state.zombies.length === 0) {
    state.waveTimer++;
    if (state.wave === 0 || state.waveTimer >= 100) {
      if (state.wave >= 10) {
        state.gameOver = true;
        const best = alivePlayers.sort(([, a], [, b]) => b.kills - a.kills)[0];
        state.winnerId = best ? best[0] : null;
        io.to(gameId).emit('game:zombie-state', state);
        return;
      }
      spawnZombieWave(state);
    }
  }

  // Move zombies toward nearest player
  for (const z of state.zombies) {
    if (alivePlayers.length === 0) break;
    let nearest = alivePlayers[0];
    let minDist = Infinity;
    for (const entry of alivePlayers) {
      const d = Math.hypot(entry[1].x - z.x, entry[1].y - z.y);
      if (d < minDist) { minDist = d; nearest = entry; }
    }
    const dx = nearest[1].x - z.x;
    const dy = nearest[1].y - z.y;
    const dist = Math.hypot(dx, dy) || 1;
    z.x += (dx / dist) * z.speed;
    z.y += (dy / dist) * z.speed;
    z.x = Math.max(5, Math.min(ZS_W - 5, z.x));
    z.y = Math.max(5, Math.min(ZS_H - 5, z.y));
  }

  // Zombie melee damage
  for (const z of state.zombies) {
    for (const [pid, p] of Object.entries(state.players)) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - z.x, p.y - z.y) < 20) {
        const key = `${z.id}:${pid}`;
        const last = zsLastMelee.get(key) || 0;
        if (tick - last >= 10) {
          p.health -= 10;
          zsLastMelee.set(key, tick);
          state.particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, color: '#ff0000', life: 15 });
          if (p.health <= 0) { p.health = 0; p.alive = false; }
        }
      }
    }
  }

  // Move bullets
  state.bullets = state.bullets.filter(b => {
    b.x += b.dx * 8; b.y += b.dy * 8;
    return b.x >= 0 && b.x <= ZS_W && b.y >= 0 && b.y <= ZS_H;
  });

  // Bullet-zombie collision
  const deadBullets = new Set<string>();
  const deadZombies = new Set<string>();
  for (const b of state.bullets) {
    if (deadBullets.has(b.id)) continue;
    for (const z of state.zombies) {
      if (deadZombies.has(z.id)) continue;
      if (Math.hypot(z.x - b.x, z.y - b.y) < 18) {
        z.health -= b.damage;
        deadBullets.add(b.id);
        state.particles.push({ x: z.x, y: z.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, color: '#00ff00', life: 10 });
        if (z.health <= 0) { deadZombies.add(z.id); const shooter = state.players[b.ownerId]; if (shooter) shooter.kills++; }
        break;
      }
    }
  }

  // Bullet-player collision (50% friendly fire)
  for (const b of state.bullets) {
    if (deadBullets.has(b.id)) continue;
    for (const [pid, p] of Object.entries(state.players)) {
      if (!p.alive || pid === b.ownerId) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 15) {
        p.health -= b.damage * 0.5;
        deadBullets.add(b.id);
        state.particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, color: '#ff4444', life: 12 });
        if (p.health <= 0) { p.health = 0; p.alive = false; }
        break;
      }
    }
  }

  state.bullets = state.bullets.filter(b => !deadBullets.has(b.id));
  state.zombies = state.zombies.filter(z => !deadZombies.has(z.id));

  // Pickup collection
  state.pickups = state.pickups.filter(pk => {
    for (const [, p] of Object.entries(state.players)) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 25) {
        if (pk.type === 'health') p.health = Math.min(p.maxHealth, p.health + 30);
        else if (pk.type === 'ammo') p.ammo += 20;
        else if (pk.type === 'shotgun') { p.weapon = 'shotgun'; p.ammo = Math.max(p.ammo, 30); }
        else if (pk.type === 'rifle') { p.weapon = 'rifle'; p.ammo = Math.max(p.ammo, 30); }
        return false;
      }
    }
    return true;
  });

  // Spawn pickups every 200 ticks
  if (tick % 200 === 0 && state.pickups.length < 8) {
    const roll = Math.random();
    const type: ZSPickup['type'] = roll < 0.4 ? 'health' : roll < 0.7 ? 'ammo' : roll < 0.85 ? 'shotgun' : 'rifle';
    state.pickups.push({ id: genId(), x: 50 + Math.random() * (ZS_W - 100), y: 50 + Math.random() * (ZS_H - 100), type });
  }

  // All players dead
  if (alivePlayers.length === 0) { state.gameOver = true; state.winnerId = null; }

  // Decay particles
  state.particles = state.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.life--; return p.life > 0; });

  io.to(gameId).emit('game:zombie-state', state);
}

// ════════════════════════════════════════
// MAIN SETUP
// ════════════════════════════════════════

export function setupGameServer(io: SocketServer) {
  io.on('connection', (socket: Socket) => {

    socket.on('game:list', (callback: (sessions: GameSession[]) => void) => {
      callback(Array.from(games.values()).filter(g => g.state !== 'ended'));
    });

    socket.on('game:create', ({ type, name, color }: { type: GameType; name: string; color: string }) => {
      const id = genId();
      const player: GamePlayer = { id: socket.id, name, color, score: 0, alive: true };
      const session: GameSession = {
        id, type, hostId: socket.id, players: [player], state: 'lobby', createdAt: Date.now(),
      };
      games.set(id, session);
      socket.join(id);
      socket.emit('game:created', session);
      io.emit('game:lobby-update', Array.from(games.values()).filter(g => g.state !== 'ended'));
    });

    socket.on('game:join', ({ gameId, name, color }: { gameId: string; name: string; color: string }) => {
      const game = games.get(gameId);
      if (!game || game.state === 'ended') return;
      if (game.players.find(p => p.id === socket.id)) return;
      if (game.players.length >= 10) return;

      const player: GamePlayer = { id: socket.id, name, color, score: 0, alive: true };
      game.players.push(player);
      socket.join(gameId);
      io.to(gameId).emit('game:player-joined', { gameId, player, players: game.players });
      io.emit('game:lobby-update', Array.from(games.values()).filter(g => g.state !== 'ended'));
    });

    socket.on('game:start', ({ gameId }: { gameId: string }) => {
      const game = games.get(gameId);
      if (!game || game.hostId !== socket.id || game.state !== 'lobby') return;
      game.state = 'playing';

      if (game.type === 'space-invaders') {
        const st = createSIState(game.players);
        siStates.set(gameId, st);
        const interval = setInterval(() => tickSI(gameId, io), 33);
        gameIntervals.set(gameId, interval);
      } else if (game.type === 'bomberman') {
        const st = createBMState(game.players);
        bmStates.set(gameId, st);
        const interval = setInterval(() => tickBM(gameId, io), 100);
        gameIntervals.set(gameId, interval);
      } else if (game.type === 'jump-n-bump') {
        const st = createJNBState(game.players);
        jnbStates.set(gameId, st);
        const interval = setInterval(() => tickJNB(gameId, io), 33);
        gameIntervals.set(gameId, interval);
      } else if (game.type === 'zombie-survival') {
        const playerMap = new Map<string, { name: string; color: string }>();
        game.players.forEach(p => playerMap.set(p.id, { name: p.name, color: p.color }));
        initZombieGame(gameId, playerMap);
        const interval = setInterval(() => tickZombie(gameId, io), 50); // 20fps
        gameIntervals.set(gameId, interval);
      }

      io.to(gameId).emit('game:started', { gameId, type: game.type });
      io.emit('game:lobby-update', Array.from(games.values()).filter(g => g.state !== 'ended'));
    });

    socket.on('game:input', ({ gameId, input }: { gameId: string; input: any }) => {
      const game = games.get(gameId);
      if (!game || game.state !== 'playing') return;

      if (game.type === 'space-invaders') {
        const st = siStates.get(gameId);
        if (!st || !st.players[socket.id]?.alive) return;
        const p = st.players[socket.id];
        if (input.left) p.x = Math.max(20, p.x - 4);
        if (input.right) p.x = Math.min(580, p.x + 4);
        if (input.shoot) {
          const existing = st.bullets.filter(b => b.ownerId === socket.id && b.dy < 0);
          if (existing.length < 2) {
            st.bullets.push({ x: p.x, y: 415, ownerId: socket.id, dy: -1 });
          }
        }
      } else if (game.type === 'bomberman') {
        const st = bmStates.get(gameId);
        if (!st || !st.players[socket.id]?.alive) return;
        const p = st.players[socket.id];
        const step = 0.25 * p.speed;
        let nx = p.x, ny = p.y;
        if (input.left) nx -= step;
        if (input.right) nx += step;
        if (input.up) ny -= step;
        if (input.down) ny += step;
        // Collision check
        const cx = Math.round(nx), cy = Math.round(ny);
        if (cx >= 0 && cx < BM_W && cy >= 0 && cy < BM_H) {
          const cell = st.grid[cy][cx];
          if (cell !== 'wall' && cell !== 'brick' && !st.bombs.some(b => b.x === cx && b.y === cy)) {
            p.x = nx; p.y = ny;
          }
        }
        if (input.bomb && p.bombs < p.maxBombs) {
          const bx = Math.round(p.x), by = Math.round(p.y);
          if (!st.bombs.some(b => b.x === bx && b.y === by)) {
            st.bombs.push({ x: bx, y: by, ownerId: socket.id, timer: 30, power: p.power });
            p.bombs++;
          }
        }
      } else if (game.type === 'jump-n-bump') {
        const st = jnbStates.get(gameId);
        if (!st || !st.players[socket.id]?.alive) return;
        const p = st.players[socket.id];
        if (input.left) { p.vx -= JNB_SPEED * 0.3; p.facing = -1; }
        if (input.right) { p.vx += JNB_SPEED * 0.3; p.facing = 1; }
        if (input.jump && p.grounded) { p.vy = JNB_JUMP; p.grounded = false; }
      } else if (game.type === 'zombie-survival') {
        const st = zsStates.get(gameId);
        if (!st || !st.players[socket.id]?.alive) return;
        const p = st.players[socket.id];
        // Movement
        if (input.dx !== undefined) p.x += input.dx * 3;
        if (input.dy !== undefined) p.y += input.dy * 3;
        p.x = Math.max(10, Math.min(ZS_W - 10, p.x));
        p.y = Math.max(10, Math.min(ZS_H - 10, p.y));
        if (input.angle !== undefined) p.angle = input.angle;
        // Shooting
        if (input.shooting && p.ammo > 0) {
          const wep = WEAPON_STATS[p.weapon];
          const tick = zsTickCount.get(gameId) || 0;
          const lastShot = zsLastShot.get(socket.id) || 0;
          if (tick - lastShot >= wep.rate) {
            zsLastShot.set(socket.id, tick);
            for (let i = 0; i < wep.bullets; i++) {
              const spread = (Math.random() - 0.5) * wep.spread * 2;
              const angle = p.angle + spread;
              st.bullets.push({
                id: genId(), x: p.x, y: p.y,
                dx: Math.cos(angle), dy: Math.sin(angle),
                ownerId: socket.id, damage: wep.damage,
              });
            }
            if (p.weapon !== 'pistol') p.ammo--;
          }
        }
      }
    });

    socket.on('game:leave', ({ gameId }: { gameId: string }) => {
      leaveGame(socket, gameId, io);
    });

    socket.on('disconnect', () => {
      // Clean up all games this player was in
      for (const [gameId, game] of Array.from(games.entries())) {
        if (game.players.some((p: GamePlayer) => p.id === socket.id)) {
          leaveGame(socket, gameId, io);
        }
      }
    });
  });
}

function leaveGame(socket: Socket, gameId: string, io: SocketServer) {
  const game = games.get(gameId);
  if (!game) return;
  game.players = game.players.filter(p => p.id !== socket.id);
  socket.leave(gameId);

  if (game.players.length === 0) {
    // Cleanup
    const interval = gameIntervals.get(gameId);
    if (interval) clearInterval(interval);
    gameIntervals.delete(gameId);
    siStates.delete(gameId);
    bmStates.delete(gameId);
    jnbStates.delete(gameId);
    zsStates.delete(gameId);
    zsTickCount.delete(gameId);
    games.delete(gameId);
  } else {
    if (game.hostId === socket.id) game.hostId = game.players[0].id;
    io.to(gameId).emit('game:player-left', { gameId, playerId: socket.id, players: game.players });
  }
  io.emit('game:lobby-update', Array.from(games.values()).filter(g => g.state !== 'ended'));
}
