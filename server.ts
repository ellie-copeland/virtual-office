import { createServer } from 'http';
import next from 'next';
import { Server as SocketServer } from 'socket.io';
import { User, ChatMessage, Position, UserStatus } from './src/lib/types';
import { defaultMap, getRoomAt } from './src/lib/map-data';
import { setupGameServer } from './src/server/game-server';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT || '3333', 10);

const users = new Map<string, User>();
const chatHistory: ChatMessage[] = [];
const MAX_CHAT_HISTORY = 200;

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
      });

      // Broadcast new user
      socket.broadcast.emit('user:joined', user);
    });

    socket.on('move', (pos: Position) => {
      const user = users.get(socket.id);
      if (!user) return;
      user.position = pos;
      user.roomId = getRoomAt(defaultMap, Math.round(pos.x), Math.round(pos.y));
      socket.broadcast.emit('user:moved', { id: socket.id, position: pos, roomId: user.roomId });
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
