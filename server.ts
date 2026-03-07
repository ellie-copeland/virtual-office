import { createServer } from 'http';
import next from 'next';
import { Server as SocketServer, Socket } from 'socket.io';
import type { User, ChatMessage, Position, UserStatus, MeetingRoomState, ScheduledMeeting } from './src/lib/types';
import { defaultMap, getRoomAt } from './src/lib/map-data';
import { setupGameServer } from './src/server/game-server';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT || '3333', 10);

const users = new Map<string, User>();
const chatHistory: ChatMessage[] = [];
const MAX_CHAT_HISTORY = 200;

// Meeting room state tracking
const meetingRoomStates = new Map<string, MeetingRoomState>();
const scheduledMeetings: ScheduledMeeting[] = [];

// Initialize meeting room states
for (const room of defaultMap.rooms) {
  if (room.type === 'meeting') {
    meetingRoomStates.set(room.id, {
      roomId: room.id,
      occupants: [],
      meetingStartedAt: null,
    });
  }
}

function handleMeetingRoomChange(io: SocketServer, userId: string, oldRoomId: string | null, newRoomId: string | null) {
  // Leave old meeting room
  if (oldRoomId) {
    const state = meetingRoomStates.get(oldRoomId);
    if (state) {
      state.occupants = state.occupants.filter(id => id !== userId);
      if (state.occupants.length === 0) {
        state.meetingStartedAt = null;
      }
      io.emit('meeting:room-updated', state);
    }
  }

  // Join new meeting room
  if (newRoomId) {
    const state = meetingRoomStates.get(newRoomId);
    if (state) {
      if (!state.occupants.includes(userId)) {
        state.occupants.push(userId);
      }
      if (state.occupants.length === 1 && !state.meetingStartedAt) {
        state.meetingStartedAt = Date.now();
      }
      io.emit('meeting:room-updated', state);
    }
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketServer(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('join', (data: { name: string; color: string; title?: string }) => {
      const spawn = defaultMap.spawnPoints[Math.floor(Math.random() * defaultMap.spawnPoints.length)];
      const user: User = {
        id: socket.id,
        name: data.name,
        color: data.color,
        title: data.title,
        status: 'available',
        position: { ...spawn },
        roomId: getRoomAt(defaultMap, spawn.x, spawn.y),
        isMuted: true,
        isCameraOn: false,
        isSpeaking: false,
        isScreenSharing: false,
      };
      users.set(socket.id, user);

      // Send current state to joining user
      socket.emit('init', {
        userId: socket.id,
        users: Array.from(users.values()),
        chatHistory: chatHistory.slice(-50),
        map: defaultMap,
        meetingRoomStates: Object.fromEntries(meetingRoomStates),
        scheduledMeetings,
      });

      // Broadcast new user
      socket.broadcast.emit('user:joined', user);
    });

    socket.on('move', (pos: Position) => {
      const user = users.get(socket.id);
      if (!user) return;
      const oldRoomId = user.roomId;
      user.position = pos;
      user.roomId = getRoomAt(defaultMap, Math.round(pos.x), Math.round(pos.y));
      socket.broadcast.emit('user:moved', { id: socket.id, position: pos, roomId: user.roomId });

      // Handle meeting room enter/leave
      if (oldRoomId !== user.roomId) {
        handleMeetingRoomChange(io, socket.id, oldRoomId, user.roomId);
      }
    });

    // Request current meeting room states
    socket.on('meeting:states', () => {
      socket.emit('meeting:states', Object.fromEntries(meetingRoomStates));
    });

    // Request scheduled meetings
    socket.on('meeting:scheduled', () => {
      socket.emit('meeting:scheduled', scheduledMeetings);
    });

    // Schedule a meeting
    socket.on('meeting:schedule', (meeting: Omit<ScheduledMeeting, 'id'>) => {
      const scheduled: ScheduledMeeting = {
        ...meeting,
        id: `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      scheduledMeetings.push(scheduled);
      io.emit('meeting:scheduled', scheduledMeetings);
    });

    socket.on('status', (status: UserStatus) => {
      const user = users.get(socket.id);
      if (!user) return;
      user.status = status;
      io.emit('user:status', { id: socket.id, status });
    });

    socket.on('media', (data: { isMuted?: boolean; isCameraOn?: boolean; isScreenSharing?: boolean; isSpeaking?: boolean }) => {
      const user = users.get(socket.id);
      if (!user) return;
      if (data.isMuted !== undefined) user.isMuted = data.isMuted;
      if (data.isCameraOn !== undefined) user.isCameraOn = data.isCameraOn;
      if (data.isScreenSharing !== undefined) user.isScreenSharing = data.isScreenSharing;
      if (data.isSpeaking !== undefined) user.isSpeaking = data.isSpeaking;
      io.emit('user:media', { id: socket.id, ...data });
    });

    socket.on('chat', (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'senderId' | 'senderName' | 'senderColor'>) => {
      const user = users.get(socket.id);
      if (!user) return;
      const chatMsg: ChatMessage = {
        ...msg,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        senderId: socket.id,
        senderName: user.name,
        senderColor: user.color,
        timestamp: Date.now(),
      };
      chatHistory.push(chatMsg);
      if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();

      if (msg.channel === 'dm' && msg.recipientId) {
        socket.emit('chat:message', chatMsg);
        io.to(msg.recipientId).emit('chat:message', chatMsg);
      } else {
        io.emit('chat:message', chatMsg);
      }
    });

    socket.on('emote', (emoji: string) => {
      const user = users.get(socket.id);
      if (!user) return;
      io.emit('emote', { userId: socket.id, emoji, timestamp: Date.now(), position: user.position });
    });

    // WebRTC signaling
    socket.on('webrtc:signal', ({ userId, signal }: { userId: string; signal: unknown }) => {
      io.to(userId).emit('webrtc:signal', { userId: socket.id, signal });
    });

    socket.on('webrtc:request', ({ userId }: { userId: string }) => {
      io.to(userId).emit('webrtc:request', { userId: socket.id });
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      const user = users.get(socket.id);
      if (user?.roomId) {
        handleMeetingRoomChange(io, socket.id, user.roomId, null);
      }
      users.delete(socket.id);
      io.emit('user:left', socket.id);
    });
  });

  // Mini games
  setupGameServer(io);

  server.listen(PORT, () => {
    console.log(`> Virtual Office running on http://localhost:${PORT}`);
  });
});
