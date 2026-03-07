import { createServer } from 'http';
import next from 'next';
import { Server as SocketServer, Socket } from 'socket.io';
import type { 
  User, ChatMessage, Position, UserStatus, MeetingRoomState, ScheduledMeeting,
  InteractiveObjectState, WhiteboardState, TVState, ArcadeState,
  DMTypingEvent, DMReadReceipt, DMUnreadCount,
  DeskAssignment, SpotlightState, FollowState,
  RoomLockState, Reaction, StatusMessageEvent, PersistentUser
} from './src/lib/types';
import { TILE_WHITEBOARD, TILE_TV, TILE_ARCADE, TILE_DESK } from './src/lib/types';
import { defaultMap, getRoomAt } from './src/lib/map-data';
import { setupGameServer } from './src/server/game-server';
import { extractTokenFromSocket, verifyToken } from './src/lib/auth';
import { findUserById, assignUserToDesk, getUsersWithDesks } from './src/lib/user-store';

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

// Interactive Objects state tracking
const interactiveObjects = new Map<string, InteractiveObjectState>(); // tileKey -> state

// DM/Direct Messaging state tracking
const dmTypingStates = new Map<string, DMTypingEvent>(); // senderId-recipientId -> typing event
const dmReadReceipts = new Map<string, DMReadReceipt[]>(); // messageId -> read receipts
const dmUnreadCounts = new Map<string, Record<string, number>>(); // userId -> { otherUserId: count }

// Desk Assignments state tracking
const deskAssignments = new Map<string, DeskAssignment>(); // tileKey -> assignment

// Spotlight/Follow Mode state tracking
let currentSpotlight: SpotlightState | null = null;
const followStates = new Map<string, FollowState>(); // followerId -> follow state

// Admin Controls state tracking
const roomLockStates = new Map<string, RoomLockState>(); // roomId -> lock state
const mutedUsers = new Set<string>(); // userId set for global mute

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

// Initialize interactive objects for whiteboards, TVs, and arcade machines
for (let y = 0; y < defaultMap.tiles.length; y++) {
  for (let x = 0; x < defaultMap.tiles[y].length; x++) {
    const tileType = defaultMap.tiles[y][x];
    if (tileType === TILE_WHITEBOARD || tileType === TILE_TV || tileType === TILE_ARCADE) {
      const tileKey = `${x}-${y}`;
      let state: WhiteboardState | TVState | ArcadeState | {} = {};
      
      if (tileType === TILE_WHITEBOARD) {
        state = { strokes: [], lastModified: Date.now() } as WhiteboardState;
      } else if (tileType === TILE_TV) {
        state = { lastModified: Date.now() } as TVState;
      } else if (tileType === TILE_ARCADE) {
        state = { players: [], lastModified: Date.now() } as ArcadeState;
      }
      
      interactiveObjects.set(tileKey, {
        tileKey,
        tileType,
        state
      });
    }
  }
}

// Helper function to get nearby users for proximity features
function getNearbyUsers(position: Position, maxDistance: number = 5): User[] {
  return Array.from(users.values()).filter(user => {
    const distance = Math.sqrt(
      Math.pow(user.position.x - position.x, 2) + 
      Math.pow(user.position.y - position.y, 2)
    );
    return distance <= maxDistance;
  });
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

    socket.on('join', (data: { name?: string; color?: string; title?: string }) => {
      // Try to authenticate with JWT token first
      const token = extractTokenFromSocket(socket);
      let persistentUser: PersistentUser | null = null;
      
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          persistentUser = findUserById(decoded.userId);
        }
      }

      // If no valid auth, fall back to legacy mode (but only if data provided)
      if (!persistentUser && (!data.name || !data.color)) {
        socket.emit('auth:required');
        socket.disconnect();
        return;
      }

      // Determine spawn position - check for assigned desk first
      let spawn = defaultMap.spawnPoints[Math.floor(Math.random() * defaultMap.spawnPoints.length)];
      
      if (persistentUser?.deskId) {
        // Try to spawn at assigned desk
        const [x, y] = persistentUser.deskId.split('-').map(Number);
        if (!isNaN(x) && !isNaN(y)) {
          spawn = { x: x + 0.5, y: y + 0.5 }; // Center of tile
        }
      }

      const user: User = {
        id: socket.id,
        name: persistentUser ? persistentUser.name : data.name!,
        color: persistentUser ? persistentUser.color : data.color!,
        title: persistentUser ? persistentUser.title : data.title,
        status: 'available',
        position: { ...spawn },
        roomId: getRoomAt(defaultMap, spawn.x, spawn.y),
        isMuted: persistentUser ? persistentUser.settings.defaultMuted : true,
        isCameraOn: persistentUser ? persistentUser.settings.defaultCamera : false,
        isSpeaking: false,
        isScreenSharing: false,
      };
      users.set(socket.id, user);

      // Store persistent user ID for admin functions
      if (persistentUser) {
        (socket as any).persistentUserId = persistentUser.id;
        (socket as any).userRole = persistentUser.role;
      }

      // Send current state to joining user
      socket.emit('init', {
        userId: socket.id,
        users: Array.from(users.values()).filter(u => u.status !== 'ghost'), // Hide ghost users
        chatHistory: chatHistory.slice(-50),
        map: defaultMap,
        meetingRoomStates: Object.fromEntries(Array.from(meetingRoomStates.entries())),
        scheduledMeetings,
        interactiveObjects: Object.fromEntries(Array.from(interactiveObjects.entries())),
        deskAssignments: Object.fromEntries(Array.from(deskAssignments.entries())),
        currentSpotlight,
        roomLockStates: Object.fromEntries(Array.from(roomLockStates.entries())),
        dmUnreadCount: dmUnreadCounts.get(socket.id) || {},
        persistentDesks: getUsersWithDesks().map(u => ({ deskId: u.deskId, userName: u.name, userColor: u.color })),
        userRole: persistentUser?.role,
      });

      // Broadcast new user (only if not ghost)
      if (user.status !== 'ghost') {
        socket.broadcast.emit('user:joined', user);
      }
    });

    socket.on('move', (pos: Position) => {
      const user = users.get(socket.id);
      if (!user) return;
      const oldRoomId = user.roomId;
      user.position = pos;
      user.roomId = getRoomAt(defaultMap, Math.round(pos.x), Math.round(pos.y));
      
      // Only broadcast movement if user is not ghost
      if (user.status !== 'ghost') {
        socket.broadcast.emit('user:moved', { id: socket.id, position: pos, roomId: user.roomId });
      }

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
      const oldStatus = user.status;
      user.status = status;

      // Handle ghost mode transitions
      if (oldStatus !== 'ghost' && status === 'ghost') {
        // User became ghost - hide from others
        socket.broadcast.emit('user:left', socket.id);
      } else if (oldStatus === 'ghost' && status !== 'ghost') {
        // User left ghost mode - show to others
        socket.broadcast.emit('user:joined', user);
      } else if (status !== 'ghost') {
        // Normal status change for visible user
        io.emit('user:status', { id: socket.id, status });
      }
      
      // Always send status update to the user themselves
      socket.emit('user:status', { id: socket.id, status });
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
        const recipient = users.get(msg.recipientId);
        
        // Don't send DMs to users in DND mode
        if (recipient && recipient.status === 'dnd') {
          socket.emit('chat:error', { message: 'User is in Do Not Disturb mode and cannot receive messages.' });
          return;
        }
        
        // Update unread count for recipient
        if (!dmUnreadCounts.has(msg.recipientId)) {
          dmUnreadCounts.set(msg.recipientId, {});
        }
        const recipientUnreads = dmUnreadCounts.get(msg.recipientId)!;
        recipientUnreads[socket.id] = (recipientUnreads[socket.id] || 0) + 1;
        
        socket.emit('chat:message', chatMsg);
        io.to(msg.recipientId).emit('chat:message', chatMsg);
        io.to(msg.recipientId).emit('dm:unread-count', recipientUnreads);
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

    // ===== INTERACTIVE OBJECTS =====
    socket.on('object:interact', ({ x, y, interaction }: { x: number; y: number; interaction: any }) => {
      const tileKey = `${x}-${y}`;
      const objectState = interactiveObjects.get(tileKey);
      const user = users.get(socket.id);
      
      if (!objectState || !user) return;
      
      const tileType = defaultMap.tiles[y]?.[x];
      const nearbyUsers = getNearbyUsers(user.position, 3);
      
      if (tileType === TILE_WHITEBOARD) {
        const whiteboardState = objectState.state as WhiteboardState;
        if (interaction.type === 'draw' && interaction.stroke) {
          whiteboardState.strokes.push({
            ...interaction.stroke,
            id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId: socket.id,
            timestamp: Date.now()
          });
          whiteboardState.lastModified = Date.now();
        } else if (interaction.type === 'clear') {
          whiteboardState.strokes = [];
          whiteboardState.lastModified = Date.now();
        }
        
        // Broadcast to nearby users
        nearbyUsers.forEach(nearbyUser => {
          io.to(nearbyUser.id).emit('object:state-updated', { tileKey, state: objectState });
        });
        
      } else if (tileType === TILE_TV) {
        const tvState = objectState.state as TVState;
        if (interaction.type === 'change-url' && interaction.url) {
          tvState.currentUrl = interaction.url;
          tvState.controlledBy = socket.id;
          tvState.lastModified = Date.now();
          
          // Broadcast to nearby users
          nearbyUsers.forEach(nearbyUser => {
            io.to(nearbyUser.id).emit('object:state-updated', { tileKey, state: objectState });
          });
        }
        
      } else if (tileType === TILE_ARCADE) {
        const arcadeState = objectState.state as ArcadeState;
        if (interaction.type === 'join-game') {
          if (!arcadeState.players.includes(socket.id)) {
            arcadeState.players.push(socket.id);
          }
          arcadeState.currentGame = interaction.game || 'default';
          arcadeState.lastModified = Date.now();
          
          // Broadcast to nearby users
          nearbyUsers.forEach(nearbyUser => {
            io.to(nearbyUser.id).emit('object:state-updated', { tileKey, state: objectState });
          });
        } else if (interaction.type === 'leave-game') {
          arcadeState.players = arcadeState.players.filter(id => id !== socket.id);
          if (arcadeState.players.length === 0) {
            arcadeState.currentGame = undefined;
          }
          arcadeState.lastModified = Date.now();
          
          // Broadcast to nearby users
          nearbyUsers.forEach(nearbyUser => {
            io.to(nearbyUser.id).emit('object:state-updated', { tileKey, state: objectState });
          });
        }
      }
    });

    // ===== DM/DIRECT MESSAGING =====
    socket.on('dm:typing', ({ recipientId, isTyping }: { recipientId: string; isTyping: boolean }) => {
      const typingKey = `${socket.id}-${recipientId}`;
      
      if (isTyping) {
        dmTypingStates.set(typingKey, {
          senderId: socket.id,
          recipientId,
          isTyping: true
        });
        io.to(recipientId).emit('dm:typing', { senderId: socket.id, isTyping: true });
      } else {
        dmTypingStates.delete(typingKey);
        io.to(recipientId).emit('dm:typing', { senderId: socket.id, isTyping: false });
      }
    });

    socket.on('dm:read', ({ messageId }: { messageId: string }) => {
      const message = chatHistory.find(msg => msg.id === messageId);
      if (!message || message.recipientId !== socket.id) return;
      
      const receipt: DMReadReceipt = {
        messageId,
        senderId: message.senderId,
        recipientId: socket.id,
        readAt: Date.now()
      };
      
      if (!dmReadReceipts.has(messageId)) {
        dmReadReceipts.set(messageId, []);
      }
      dmReadReceipts.get(messageId)!.push(receipt);
      
      // Clear unread count for this sender
      const unreadCounts = dmUnreadCounts.get(socket.id) || {};
      if (unreadCounts[message.senderId]) {
        unreadCounts[message.senderId] = Math.max(0, unreadCounts[message.senderId] - 1);
        dmUnreadCounts.set(socket.id, unreadCounts);
        socket.emit('dm:unread-count', unreadCounts);
      }
      
      io.to(message.senderId).emit('dm:read-receipt', receipt);
    });

    // ===== DESK ASSIGNMENTS =====
    socket.on('desk:claim', ({ x, y }: { x: number; y: number }) => {
      const tileKey = `${x}-${y}`;
      const tileType = defaultMap.tiles[y]?.[x];
      
      if (tileType !== TILE_DESK) return;
      
      // Check if desk is already claimed
      if (deskAssignments.has(tileKey)) {
        socket.emit('desk:claim-error', { message: 'Desk is already claimed by another user.' });
        return;
      }
      
      // Release any previous desk assignment for this user
      for (const [key, assignment] of Array.from(deskAssignments.entries())) {
        if (assignment.userId === socket.id) {
          deskAssignments.delete(key);
          io.emit('desk:released', { tileKey: key });
        }
      }
      
      // Claim the new desk
      const assignment: DeskAssignment = {
        tileKey,
        userId: socket.id,
        assignedAt: Date.now()
      };
      deskAssignments.set(tileKey, assignment);
      io.emit('desk:claimed', assignment);
    });

    socket.on('desk:release', ({ x, y }: { x: number; y: number }) => {
      const tileKey = `${x}-${y}`;
      const assignment = deskAssignments.get(tileKey);
      
      if (assignment && assignment.userId === socket.id) {
        deskAssignments.delete(tileKey);
        io.emit('desk:released', { tileKey });
      }
    });

    // ===== SPOTLIGHT/FOLLOW MODE =====
    socket.on('spotlight:start', () => {
      const user = users.get(socket.id);
      if (!user) return;
      
      currentSpotlight = {
        userId: socket.id,
        startedAt: Date.now()
      };
      io.emit('spotlight:started', currentSpotlight);
    });

    socket.on('spotlight:stop', () => {
      if (currentSpotlight && currentSpotlight.userId === socket.id) {
        currentSpotlight = null;
        io.emit('spotlight:stopped');
      }
    });

    socket.on('follow:start', ({ targetId }: { targetId: string }) => {
      const user = users.get(socket.id);
      const target = users.get(targetId);
      if (!user || !target) return;
      
      followStates.set(socket.id, {
        followerId: socket.id,
        targetId,
        startedAt: Date.now()
      });
      
      socket.emit('follow:started', { targetId });
      io.to(targetId).emit('follow:being-followed', { followerId: socket.id });
    });

    socket.on('follow:stop', () => {
      const followState = followStates.get(socket.id);
      if (followState) {
        followStates.delete(socket.id);
        socket.emit('follow:stopped');
        io.to(followState.targetId).emit('follow:stopped-following', { followerId: socket.id });
      }
    });

    // ===== DESK ASSIGNMENTS =====
    socket.on('desk:claim', ({ x, y }: { x: number; y: number }) => {
      const user = users.get(socket.id);
      const persistentUserId = (socket as any).persistentUserId;
      
      if (!user || !persistentUserId) {
        socket.emit('desk:error', { message: 'Authentication required to claim desk' });
        return;
      }

      // Check if it's actually a desk tile
      const tileType = defaultMap.tiles[y]?.[x];
      if (tileType !== TILE_DESK) {
        socket.emit('desk:error', { message: 'This is not a desk tile' });
        return;
      }

      const tileKey = `${x}-${y}`;
      
      // Assign desk persistently
      const success = assignUserToDesk(persistentUserId, tileKey);
      if (success) {
        // Update the local desk assignments map
        deskAssignments.set(tileKey, {
          tileKey,
          userId: socket.id,
          assignedAt: Date.now()
        });
        
        // Broadcast the assignment
        io.emit('desk:assigned', {
          tileKey,
          userId: socket.id,
          userName: user.name,
          userColor: user.color,
          persistent: true
        });
      } else {
        socket.emit('desk:error', { message: 'Failed to assign desk' });
      }
    });

    socket.on('desk:release', ({ x, y }: { x: number; y: number }) => {
      const persistentUserId = (socket as any).persistentUserId;
      
      if (!persistentUserId) {
        socket.emit('desk:error', { message: 'Authentication required' });
        return;
      }

      const tileKey = `${x}-${y}`;
      
      // Release desk persistently
      const success = assignUserToDesk(persistentUserId, undefined);
      if (success) {
        // Update local desk assignments map
        deskAssignments.delete(tileKey);
        
        // Broadcast the release
        io.emit('desk:released', { tileKey });
      } else {
        socket.emit('desk:error', { message: 'Failed to release desk' });
      }
    });

    // ===== ADMIN CONTROLS =====
    socket.on('admin:kick', ({ userId }: { userId: string }) => {
      const userRole = (socket as any).userRole;
      if (userRole !== 'admin') {
        socket.emit('admin:error', { message: 'Admin permissions required' });
        return;
      }
      
      const targetSocket = io.sockets.sockets.get(userId);
      if (targetSocket) {
        targetSocket.emit('admin:kicked', { reason: 'You have been removed from the office.' });
        targetSocket.disconnect();
      }
    });

    socket.on('admin:mute-all', () => {
      const userRole = (socket as any).userRole;
      if (userRole !== 'admin') {
        socket.emit('admin:error', { message: 'Admin permissions required' });
        return;
      }
      
      io.emit('admin:mute-all');
    });

    socket.on('admin:lock-room', ({ roomId }: { roomId: string }) => {
      const userRole = (socket as any).userRole;
      if (userRole !== 'admin') {
        socket.emit('admin:error', { message: 'Admin permissions required' });
        return;
      }
      if (!roomLockStates.has(roomId)) {
        const lockState: RoomLockState = {
          roomId,
          isLocked: true,
          lockedBy: socket.id,
          lockedAt: Date.now()
        };
        roomLockStates.set(roomId, lockState);
        io.emit('admin:room-locked', lockState);
      }
    });

    socket.on('admin:unlock-room', ({ roomId }: { roomId: string }) => {
      // TODO: Add admin permission check
      if (roomLockStates.has(roomId)) {
        roomLockStates.delete(roomId);
        io.emit('admin:room-unlocked', { roomId });
      }
    });

    // ===== REACTIONS =====
    socket.on('reaction', (emoji: string) => {
      const user = users.get(socket.id);
      if (!user) return;
      
      const reaction: Reaction = {
        userId: socket.id,
        emoji,
        timestamp: Date.now(),
        position: user.position
      };
      
      // Broadcast to nearby users
      const nearbyUsers = getNearbyUsers(user.position, 8);
      nearbyUsers.forEach(nearbyUser => {
        io.to(nearbyUser.id).emit('reaction', reaction);
      });
    });

    // ===== STATUS MESSAGES =====
    socket.on('statusMessage:set', (message: string) => {
      const user = users.get(socket.id);
      if (!user) return;
      
      user.statusMessage = message;
      const statusEvent: StatusMessageEvent = {
        userId: socket.id,
        message
      };
      
      io.emit('statusMessage:updated', statusEvent);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      const user = users.get(socket.id);
      
      // Handle meeting room cleanup
      if (user?.roomId) {
        handleMeetingRoomChange(io, socket.id, user.roomId, null);
      }
      
      // Clean up desk assignments
      for (const [tileKey, assignment] of Array.from(deskAssignments.entries())) {
        if (assignment.userId === socket.id) {
          deskAssignments.delete(tileKey);
          io.emit('desk:released', { tileKey });
        }
      }
      
      // Clean up interactive object states
      for (const [tileKey, objectState] of Array.from(interactiveObjects.entries())) {
        if (objectState.tileType === TILE_ARCADE) {
          const arcadeState = objectState.state as ArcadeState;
          if (arcadeState.players.includes(socket.id)) {
            arcadeState.players = arcadeState.players.filter(id => id !== socket.id);
            if (arcadeState.players.length === 0) {
              arcadeState.currentGame = undefined;
            }
            arcadeState.lastModified = Date.now();
            io.emit('object:state-updated', { tileKey, state: objectState });
          }
        }
        if (objectState.tileType === TILE_TV) {
          const tvState = objectState.state as TVState;
          if (tvState.controlledBy === socket.id) {
            tvState.controlledBy = undefined;
            tvState.lastModified = Date.now();
            io.emit('object:state-updated', { tileKey, state: objectState });
          }
        }
      }
      
      // Clean up DM typing states
      for (const [key, typingState] of Array.from(dmTypingStates.entries())) {
        if (typingState.senderId === socket.id) {
          dmTypingStates.delete(key);
          io.to(typingState.recipientId).emit('dm:typing', { senderId: socket.id, isTyping: false });
        } else if (typingState.recipientId === socket.id) {
          dmTypingStates.delete(key);
        }
      }
      
      // Clean up spotlight state
      if (currentSpotlight && currentSpotlight.userId === socket.id) {
        currentSpotlight = null;
        io.emit('spotlight:stopped');
      }
      
      // Clean up follow states
      followStates.delete(socket.id);
      for (const [followerId, followState] of Array.from(followStates.entries())) {
        if (followState.targetId === socket.id) {
          followStates.delete(followerId);
          io.to(followerId).emit('follow:stopped');
        }
      }
      
      // Clean up user and broadcast departure
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
