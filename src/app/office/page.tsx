'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OfficeCanvas from '@/components/office/Canvas';
import Toolbar from '@/components/office/Toolbar';
import ChatPanel from '@/components/office/ChatPanel';
import UserList from '@/components/office/UserList';
import VideoOverlay from '@/components/office/VideoOverlay';
import MiniMap from '@/components/office/MiniMap';
import MeetingBar from '@/components/office/MeetingBar';
import MeetingScheduler from '@/components/office/MeetingScheduler';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { WebRTCManager } from '@/lib/webrtc';
import { calculateVolume } from '@/lib/spatial-audio';
import { getRoomAt, getMeetingRoomBySlug } from '@/lib/map-data';
import { User, MapData, ChatMessage, Emote, UserStatus, MeetingRoomState, ScheduledMeeting, Room, PROXIMITY_MAX_DISTANCE } from '@/lib/types';
import { GameSession, GameType } from '@/lib/game-types';
import GameLauncher from '@/components/games/GameLauncher';
import GameLobby from '@/components/games/GameLobby';
import GameOverlay from '@/components/games/GameOverlay';
import MeetingRoomView from '@/components/office/MeetingRoomView';
import InteractionOverlay from '@/components/office/InteractionOverlay';
import UserContextMenu from '@/components/office/UserContextMenu';
import StatusBar from '@/components/office/StatusBar';
import NotificationToast from '@/components/office/NotificationToast';

export default function OfficePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏢</div>Loading office...
        </div>
      </div>
    }>
      <OfficeInner />
    </Suspense>
  );
}

function OfficeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [status, setStatus] = useState<UserStatus>('available');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });

  const [showGameLauncher, setShowGameLauncher] = useState(false);
  const [currentGameSession, setCurrentGameSession] = useState<GameSession | null>(null);
  const [activeGame, setActiveGame] = useState<{ id: string; type: GameType } | null>(null);

  // Meeting room state
  const [meetingRoomStates, setMeetingRoomStates] = useState<Record<string, MeetingRoomState>>({});
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeeting[]>([]);
  const [showScheduler, setShowScheduler] = useState(false);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);

  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const rtcRef = useRef<WebRTCManager | null>(null);
  const teleportedRef = useRef(false);

  // New UI state
  const [deskClaims, setDeskClaims] = useState<Array<{
    tileKey: string;
    userId: string;
    userName: string;
    userColor: string;
  }>>([]);
  const [reactionBubbles, setReactionBubbles] = useState<Array<{
    id: string;
    userId: string;
    emoji: string;
    x: number;
    y: number;
    startTime: number;
  }>>([]);
  const [contextMenuState, setContextMenuState] = useState<{
    user: User | null;
    position: { x: number; y: number } | null;
  }>({ user: null, position: null });

  // Check calendar connection on mount
  useEffect(() => {
    if (searchParams.get('calendar') === 'connected') {
      setIsCalendarConnected(true);
    }
  }, [searchParams]);

  useEffect(() => {
    // Determine auth method
    const token = localStorage.getItem('vo-token');
    const saved = localStorage.getItem('vo-user');

    if (!token && !saved) {
      router.push('/');
      return;
    }

    const socket = connectSocket(token || undefined);
    socketRef.current = socket;

    socket.on('init', (data: {
      userId: string;
      users: User[];
      chatHistory: ChatMessage[];
      map: MapData;
      meetingRoomStates: Record<string, MeetingRoomState>;
      scheduledMeetings: ScheduledMeeting[];
    }) => {
      setUserId(data.userId);
      setUsers(data.users);
      setMessages(data.chatHistory);
      setMapData(data.map);
      if (data.meetingRoomStates) setMeetingRoomStates(data.meetingRoomStates);
      if (data.scheduledMeetings) setScheduledMeetings(data.scheduledMeetings);

      // Handle room link teleportation
      const roomSlug = searchParams.get('room');
      if (roomSlug && !teleportedRef.current && data.map) {
        teleportedRef.current = true;
        const targetRoom = getMeetingRoomBySlug(data.map, roomSlug);
        if (targetRoom) {
          const tx = targetRoom.bounds.x + Math.floor(targetRoom.bounds.width / 2);
          const ty = targetRoom.bounds.y + Math.floor(targetRoom.bounds.height / 2);
          socket.emit('move', { x: tx, y: ty });
        }
      }

      // Setup WebRTC
      rtcRef.current = new WebRTCManager(
        socket,
        (uid, stream) => {
          setRemoteStreams(prev => {
            const n = new Map(prev);
            n.set(uid, stream);
            return n;
          });
        },
        (uid) => {
          setRemoteStreams(prev => {
            const n = new Map(prev);
            n.delete(uid);
            return n;
          });
        }
      );
    });

    socket.on('user:joined', (user: User) => {
      setUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
    });

    socket.on('user:left', (id: string) => {
      setUsers(prev => prev.filter(u => u.id !== id));
      setRemoteStreams(prev => { const n = new Map(prev); n.delete(id); return n; });
    });

    socket.on('user:moved', (data: { id: string; position: { x: number; y: number }; roomId: string | null }) => {
      setUsers(prev => prev.map(u => u.id === data.id ? { ...u, position: data.position, roomId: data.roomId } : u));
    });

    socket.on('user:status', (data: { id: string; status: UserStatus }) => {
      setUsers(prev => prev.map(u => u.id === data.id ? { ...u, status: data.status } : u));
    });

    socket.on('user:media', (data: { id: string; isMuted?: boolean; isCameraOn?: boolean; isScreenSharing?: boolean; isSpeaking?: boolean }) => {
      setUsers(prev => prev.map(u => u.id === data.id ? { ...u, ...data } : u));
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-199), msg]);
    });

    socket.on('emote', (emote: Emote) => {
      setEmotes(prev => [...prev, emote]);
      setTimeout(() => setEmotes(prev => prev.filter(e => e !== emote)), 3500);
    });

    socket.on('meeting:room-updated', (state: MeetingRoomState) => {
      setMeetingRoomStates(prev => ({ ...prev, [state.roomId]: state }));
    });

    socket.on('meeting:scheduled', (meetings: ScheduledMeeting[]) => {
      setScheduledMeetings(meetings);
    });

    socket.on('game:started', ({ gameId, type }: { gameId: string; type: GameType }) => {
      setCurrentGameSession(null);
      setShowGameLauncher(false);
      setActiveGame({ id: gameId, type });
    });

    socket.on('desk:claimed', (data: { tileKey: string; userId: string; userName: string; userColor: string }) => {
      setDeskClaims(prev => [...prev.filter(d => d.tileKey !== data.tileKey), data]);
    });

    socket.on('desk:released', (data: { tileKey: string }) => {
      setDeskClaims(prev => prev.filter(d => d.tileKey !== data.tileKey));
    });

    socket.on('reaction', (data: { userId: string; emoji: string; position: { x: number; y: number } }) => {
      const bubble = {
        id: `${data.userId}-${Date.now()}`,
        userId: data.userId,
        emoji: data.emoji,
        x: data.position.x,
        y: data.position.y,
        startTime: Date.now(),
      };
      setReactionBubbles(prev => [...prev, bubble]);
      setTimeout(() => {
        setReactionBubbles(prev => prev.filter(b => b.id !== bubble.id));
      }, 2000);
    });

    socket.on('auth:required', () => {
      localStorage.removeItem('vo-token');
      localStorage.removeItem('vo-user-data');
      router.push('/');
    });

    // Join with appropriate data based on auth method
    if (token) {
      socket.emit('join', {});
    } else {
      const userData = JSON.parse(saved!);
      socket.emit('join', { name: userData.name, color: userData.color, title: userData.title });
    }

    return () => {
      rtcRef.current?.destroy();
      disconnectSocket();
    };
  }, []); // eslint-disable-line

  // Proximity-based WebRTC auto-connect
  useEffect(() => {
    if (!userId || !rtcRef.current) return;
    const connectedPeers = new Set<string>();

    const interval = setInterval(() => {
      const me = users.find(u => u.id === userId);
      if (!me || !rtcRef.current) return;

      users.forEach(u => {
        if (u.id === userId) return;
        const dx = u.position.x - me.position.x;
        const dy = u.position.y - me.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PROXIMITY_MAX_DISTANCE) {
          if (!connectedPeers.has(u.id)) {
            rtcRef.current!.connectToPeer(u.id);
            connectedPeers.add(u.id);
          }
        } else {
          if (connectedPeers.has(u.id)) {
            rtcRef.current!.disconnectPeer(u.id);
            connectedPeers.delete(u.id);
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [userId, users]);

  // Spatial audio: update volume for remote streams
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!userId || !mapData) return;
    const me = users.find(u => u.id === userId);
    if (!me) return;

    const vols: Record<string, number> = {};
    remoteStreams.forEach((stream, peerId) => {
      const peer = users.find(u => u.id === peerId);
      if (!peer) return;
      const vol = calculateVolume(me.position, me.roomId, peer.position, peer.roomId, mapData.rooms);
      vols[peerId] = vol;
    });
    setPeerVolumes(vols);
  }, [users, userId, mapData, remoteStreams]);

  const handleMove = useCallback((x: number, y: number) => {
    socketRef.current?.emit('move', { x, y });
  }, []);

  const handleToggleMic = useCallback(async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    socketRef.current?.emit('media', { isMuted: newMuted });

    if (!newMuted && !localStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        rtcRef.current?.setLocalStream(stream);
      } catch (err) { console.error('Mic error:', err); setIsMuted(true); }
    }
  }, [isMuted, localStream]);

  const handleToggleCamera = useCallback(async () => {
    const newCam = !isCameraOn;
    setIsCameraOn(newCam);
    socketRef.current?.emit('media', { isCameraOn: newCam });

    if (newCam) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isMuted });
        setLocalStream(stream);
        rtcRef.current?.setLocalStream(stream);
      } catch (err) { console.error('Camera error:', err); setIsCameraOn(false); }
    } else {
      localStream?.getVideoTracks().forEach(t => t.stop());
    }
  }, [isCameraOn, isMuted, localStream]);

  const handleToggleScreenShare = useCallback(async () => {
    const newSS = !isScreenSharing;
    setIsScreenSharing(newSS);
    socketRef.current?.emit('media', { isScreenSharing: newSS });

    if (newSS) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        rtcRef.current?.setLocalStream(stream);
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          socketRef.current?.emit('media', { isScreenSharing: false });
        };
      } catch { setIsScreenSharing(false); }
    }
  }, [isScreenSharing]);

  const handleStatusChange = useCallback((s: UserStatus) => {
    setStatus(s);
    socketRef.current?.emit('status', s);
  }, []);

  const handleEmote = useCallback((emoji: string) => {
    socketRef.current?.emit('emote', emoji);
  }, []);

  const handleSendChat = useCallback((content: string, channel: string, recipientId?: string) => {
    const me = users.find(u => u.id === userId);
    socketRef.current?.emit('chat', {
      content,
      channel,
      roomId: me?.roomId,
      recipientId,
      recipientName: recipientId ? users.find(u => u.id === recipientId)?.name : undefined,
    });
  }, [users, userId]);

  const handleLeaveRoom = useCallback(() => {
    if (!mapData) return;
    // Teleport to lobby/spawn
    const spawn = mapData.spawnPoints[0];
    if (spawn) {
      socketRef.current?.emit('move', { x: spawn.x, y: spawn.y });
      // Force local position update
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, position: spawn, roomId: getRoomAt(mapData, spawn.x, spawn.y) } : u
      ));
    }
  }, [mapData, userId]);

  const handleScheduleMeeting = useCallback((meeting: Omit<ScheduledMeeting, 'id'>) => {
    socketRef.current?.emit('meeting:schedule', meeting);
  }, []);

  const handleConnectCalendar = useCallback(() => {
    window.location.href = '/api/calendar';
  }, []);

  // New handlers
  const handleUserContextMenu = useCallback((user: User, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuState({
      user,
      position: { x: event.clientX, y: event.clientY }
    });
  }, []);

  const handleStartDM = useCallback((userId: string) => {
    setIsChatOpen(true);
    // The ChatPanel will handle switching to DM tab and selecting the user
  }, []);

  const handleStatusMessageChange = useCallback((message: string) => {
    socketRef.current?.emit('statusMessage:set', { message });
  }, []);

  const handleNavigateToUser = useCallback((roomId?: string, userId?: string) => {
    if (roomId && mapData) {
      const room = mapData.rooms.find(r => r.id === roomId);
      if (room) {
        const centerX = room.bounds.x + Math.floor(room.bounds.width / 2);
        const centerY = room.bounds.y + Math.floor(room.bounds.height / 2);
        socketRef.current?.emit('move', { x: centerX, y: centerY });
      }
    }
  }, [mapData]);

  if (!mapData || !userId) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#1a1a2e', color: '#fff', fontSize: 18,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏢</div>
          Connecting to office...
        </div>
      </div>
    );
  }

  const me = users.find(u => u.id === userId);
  const currentRoom = me?.roomId ? mapData.rooms.find(r => r.id === me.roomId) : null;
  const isInMeetingRoom = currentRoom?.type === 'meeting';

  // Show meeting room view when in a meeting room (games overlay on top)
  if (isInMeetingRoom && currentRoom) {
    return (
      <>
        <MeetingRoomView
          room={currentRoom}
          roomState={meetingRoomStates[currentRoom.id] || null}
          users={users}
          currentUserId={userId}
          remoteStreams={remoteStreams}
          localStream={localStream}
          isMuted={isMuted}
          isCameraOn={isCameraOn}
          isScreenSharing={isScreenSharing}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onLeaveRoom={handleLeaveRoom}
          onCopyLink={() => {}}
          onOpenGames={() => setShowGameLauncher(true)}
        />

        {/* Game UI overlays on top of meeting */}
        {showGameLauncher && socketRef.current && (
          <GameLauncher
            socket={socketRef.current}
            userName={me?.name || 'Player'}
            userColor={me?.color || '#fff'}
            onJoinGame={(session) => { setShowGameLauncher(false); setCurrentGameSession(session); }}
            onClose={() => setShowGameLauncher(false)}
          />
        )}

        {currentGameSession && socketRef.current && !activeGame && (
          <GameLobby
            socket={socketRef.current}
            session={currentGameSession}
            onStart={() => {}}
            onLeave={() => {
              socketRef.current?.emit('game:leave', { gameId: currentGameSession.id });
              setCurrentGameSession(null);
            }}
          />
        )}

        {activeGame && socketRef.current && (
          <GameOverlay
            socket={socketRef.current}
            gameId={activeGame.id}
            gameType={activeGame.type}
            onClose={() => setActiveGame(null)}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1a1a2e' }}>
      {/* Meeting bar when in a meeting room */}
      {isInMeetingRoom && currentRoom && (
        <MeetingBar
          room={currentRoom}
          users={users}
          currentUserId={userId}
          meetingState={meetingRoomStates[currentRoom.id] || null}
          scheduledMeetings={scheduledMeetings}
          onLeaveRoom={handleLeaveRoom}
          onSchedule={() => setShowScheduler(true)}
        />
      )}

      <OfficeCanvas
        map={mapData}
        users={users}
        currentUserId={userId}
        emotes={emotes}
        meetingRoomStates={meetingRoomStates}
        scheduledMeetings={scheduledMeetings}
        deskClaims={deskClaims}
        reactionBubbles={reactionBubbles}
        onMove={handleMove}
        onCameraChange={(x, y) => setCameraOffset({ x, y })}
      />
      <UserList users={users} currentUserId={userId} onUserRightClick={handleUserContextMenu} />
      <MiniMap map={mapData} users={users} currentUserId={userId} />
      <VideoOverlay
        users={users}
        currentUserId={userId}
        remoteStreams={remoteStreams}
        localStream={localStream}
        cameraOffset={cameraOffset}
        volumes={peerVolumes}
      />
      <ChatPanel
        isOpen={isChatOpen}
        messages={messages}
        currentUserId={userId}
        currentRoomId={me?.roomId ?? null}
        users={users}
        onSend={handleSendChat}
      />
      <Toolbar
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        status={status}
        isChatOpen={isChatOpen}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onStatusChange={handleStatusChange}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onEmote={handleEmote}
        onOpenGames={() => setShowGameLauncher(true)}
      />

      {/* Meeting Scheduler */}
      {showScheduler && (
        <MeetingScheduler
          rooms={mapData.rooms}
          currentRoomId={me?.roomId ?? null}
          scheduledMeetings={scheduledMeetings}
          onSchedule={handleScheduleMeeting}
          onClose={() => setShowScheduler(false)}
          isCalendarConnected={isCalendarConnected}
          onConnectCalendar={handleConnectCalendar}
        />
      )}

      {/* Game UI */}
      {showGameLauncher && socketRef.current && (
        <GameLauncher
          socket={socketRef.current}
          userName={me?.name || 'Player'}
          userColor={me?.color || '#fff'}
          onJoinGame={(session) => { setShowGameLauncher(false); setCurrentGameSession(session); }}
          onClose={() => setShowGameLauncher(false)}
        />
      )}

      {currentGameSession && socketRef.current && !activeGame && (
        <GameLobby
          socket={socketRef.current}
          session={currentGameSession}
          onStart={() => {}}
          onLeave={() => {
            socketRef.current?.emit('game:leave', { gameId: currentGameSession.id });
            setCurrentGameSession(null);
          }}
        />
      )}

      {activeGame && socketRef.current && (
        <GameOverlay
          socket={socketRef.current}
          gameId={activeGame.id}
          gameType={activeGame.type}
          onClose={() => setActiveGame(null)}
        />
      )}

      {/* New UI Components */}
      <InteractionOverlay
        map={mapData}
        users={users}
        currentUserId={userId}
      />

      <UserContextMenu
        user={contextMenuState.user}
        currentUserId={userId}
        currentUser={me || null}
        position={contextMenuState.position}
        onClose={() => setContextMenuState({ user: null, position: null })}
        onStartDM={handleStartDM}
      />

      <StatusBar
        users={users}
        currentUserId={userId}
        currentRoom={currentRoom || null}
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        onStatusMessageChange={handleStatusMessageChange}
      />

      <NotificationToast
        users={users}
        currentUserId={userId}
        messages={messages}
        meetings={scheduledMeetings}
        rooms={mapData.rooms}
        onNavigate={handleNavigateToUser}
      />
    </div>
  );
}
