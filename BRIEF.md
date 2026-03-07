# Virtual Office — Build Brief

## Overview
Build a Gather Town-style virtual office app. 2D spatial environment with proximity-based voice/video, real-time movement, rooms, chat, and AI agent (Ellie) integration.

## Tech Stack
- **Next.js 14** App Router, TypeScript
- **Socket.io** for real-time movement/presence
- **WebRTC** via simple-peer for voice/video (peer-to-peer)
- **HTML5 Canvas** for 2D map rendering (no heavy game engines)
- **Inline styles** (no Tailwind)

## Core Features

### 1. 2D Map & Movement
- Top-down pixel-art style office map (draw with Canvas)
- WASD/Arrow key movement, smooth interpolation
- Collision detection with walls/furniture
- Map is a grid (32x32 px tiles)
- Default map: Open office with:
  - Reception/lobby area
  - 4 desk clusters (Engineering, Sales, Support, Design)
  - Conference room (enclosed, private audio zone)
  - Lounge/break room
  - Ellie's corner (AI agent zone)
- Avatar: colored circle with name label + optional profile pic
- Show other users moving in real-time

### 2. Proximity Voice & Video
- WebRTC peer-to-peer connections via simple-peer
- **Spatial audio**: Volume scales with distance (full volume < 3 tiles, fades to 0 at 8 tiles)
- **Private zones**: Conference room = only hear people in the same room
- Video shows as small floating bubble above avatar when enabled
- Mute/unmute mic, toggle camera buttons in bottom toolbar
- Speaker indicator (green ring) on avatar when talking

### 3. Rooms & Zones
- Rooms defined in map data (rectangular regions)
- Private rooms: audio isolated (conference room, 1-on-1 rooms)
- Open areas: proximity-based audio
- Room labels displayed on map
- Door tiles to enter/exit rooms

### 4. Real-time Presence
- Socket.io server handles:
  - User join/leave events
  - Position updates (throttled to 15fps)
  - Chat messages
  - Status updates (available, busy, away, in-meeting)
- Show online users list in sidebar
- Show user count per room

### 5. Chat
- Global chat + proximity chat (only people nearby)
- Room-specific chat when in a private room
- DM support
- Chat sidebar, collapsible
- Message format: timestamp, avatar, name, message

### 6. Screen Sharing
- Share screen to nearby users or entire room
- Shows as a floating window that others can see
- Click to expand fullscreen

### 7. Bottom Toolbar
- Mic toggle (with level indicator)
- Camera toggle
- Screen share toggle
- Status dropdown (Available, Busy, Away, In Meeting)
- Settings gear (audio/video device selection)
- Chat toggle
- Minimap toggle
- Emote/reaction buttons (👋 ❤️ 😂 👍 🎉)

### 8. User Profiles
- Name, avatar color, profile picture (optional)
- Status message
- Role/title display under name

### 9. Map Editor (Admin)
- `/editor` route
- Grid-based tile editor
- Paint tools: wall, floor, furniture, zone boundaries
- Define rooms (name, type: open/private)
- Define spawn points
- Save/load maps as JSON
- Preview mode

### 10. Ellie AI Agent Integration
- Ellie appears as a special avatar in "Ellie's Corner"
- When users walk near Ellie, she can hear them (Whisper STT)
- Ellie responds via ElevenLabs TTS (spatial audio)
- Routes through OpenClaw gateway for full agent capabilities
- Uses same pipeline as gather-voice-bot: WebRTC audio → Whisper → OpenClaw → ElevenLabs → WebRTC audio back

## Architecture

```
┌─────────────────────────────────────────┐
│  Next.js Frontend (Vercel)              │
│  - Canvas renderer                       │
│  - WebRTC peer connections               │
│  - Socket.io client                      │
│  - Audio processing (spatial)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Socket.io Server (same process or ext)  │
│  - Room management                       │
│  - Position sync                         │
│  - Chat relay                            │
│  - Presence tracking                     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Ellie Voice Pipeline                    │
│  - Whisper STT                           │
│  - OpenClaw /v1/chat/completions         │
│  - ElevenLabs TTS                        │
└─────────────────────────────────────────┘
```

## File Structure
```
src/
  app/
    page.tsx              — Landing/login page
    office/page.tsx       — Main virtual office
    editor/page.tsx       — Map editor (admin)
    api/
      socket/route.ts     — Socket.io upgrade handler (or separate server)
  components/
    office/
      Canvas.tsx          — 2D map renderer
      Avatar.tsx          — User avatar component
      Toolbar.tsx         — Bottom toolbar
      ChatPanel.tsx       — Chat sidebar
      UserList.tsx        — Online users sidebar
      VideoOverlay.tsx    — Floating video bubbles
      MiniMap.tsx         — Small overview map
      RoomLabel.tsx       — Room name overlay
      EmotePopup.tsx      — Floating emoji reactions
    editor/
      MapEditor.tsx       — Tile painting editor
      TilePalette.tsx     — Tile type selector
      RoomDefiner.tsx     — Room boundary tool
  lib/
    socket.ts             — Socket.io client singleton
    webrtc.ts             — WebRTC peer management
    spatial-audio.ts      — Distance-based volume calculation
    map-data.ts           — Default map definition
    types.ts              — Shared types
  server/
    socket-server.ts      — Socket.io server logic
    ellie-bridge.ts       — Ellie voice bot integration
```

## Map Data Format
```typescript
interface MapData {
  width: number;      // tiles
  height: number;     // tiles
  tileSize: number;   // px (32)
  tiles: number[][];  // 2D grid of tile types
  rooms: Room[];
  spawnPoints: Position[];
  furniture: Furniture[];
}

interface Room {
  id: string;
  name: string;
  type: 'open' | 'private';
  bounds: { x: number; y: number; width: number; height: number };
}
```

## Tile Types
0 = void (nothing), 1 = floor, 2 = wall, 3 = door, 4 = desk, 5 = chair, 6 = couch, 7 = plant, 8 = whiteboard, 9 = tv/screen, 10 = carpet/rug

## Color Scheme
- Floor: #F0EDE6 (warm beige)
- Walls: #4A4A4A (dark gray)
- Desks: #8B6914 (wood brown)
- Carpet: #5B7FA5 (muted blue)
- Plants: #4CAF50 (green)
- Doors: #E8C872 (golden)
- Background: #2D2D2D (dark)

## Auth
Simple — enter name + pick avatar color on landing page. No password needed for now. Store in localStorage.

## Socket.io Server
For development: custom server.ts that wraps Next.js + Socket.io
For production: can deploy Socket.io separately or use Vercel + external WS service

Create a `server.ts` at root that:
1. Creates HTTP server
2. Attaches Socket.io
3. Attaches Next.js request handler
4. Runs on port 3000

## DO NOT
- Use Tailwind
- Use heavy game engines (Phaser, Pixi) — vanilla Canvas API is fine
- Make it ugly — this should feel polished and fun
- Skip the spatial audio — it's the core feature
- Make placeholder components — everything functional

## npm dependencies needed
```
socket.io socket.io-client simple-peer @types/simple-peer
```
