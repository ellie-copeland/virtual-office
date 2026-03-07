import Peer, { Instance as PeerInstance } from 'simple-peer';
import { Socket } from 'socket.io-client';

export interface PeerConnection {
  peer: PeerInstance;
  stream?: MediaStream;
  userId: string;
}

export class WebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private socket: Socket;
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onRemoteDisconnect: (userId: string) => void;

  constructor(
    socket: Socket,
    onRemoteStream: (userId: string, stream: MediaStream) => void,
    onRemoteDisconnect: (userId: string) => void
  ) {
    this.socket = socket;
    this.onRemoteStream = onRemoteStream;
    this.onRemoteDisconnect = onRemoteDisconnect;

    this.socket.on('webrtc:signal', ({ userId, signal }: { userId: string; signal: Peer.SignalData }) => {
      const pc = this.peers.get(userId);
      if (pc) {
        pc.peer.signal(signal);
      }
    });

    this.socket.on('webrtc:request', ({ userId }: { userId: string }) => {
      this.createPeer(userId, false);
    });
  }

  /** Get the effective outgoing stream (screen share takes priority for video) */
  private getOutgoingStream(): MediaStream | undefined {
    if (this.screenStream && this.localStream) {
      // Combine: screen video + local audio
      const combined = new MediaStream();
      this.screenStream.getVideoTracks().forEach(t => combined.addTrack(t));
      this.localStream.getAudioTracks().forEach(t => combined.addTrack(t));
      return combined;
    }
    return this.screenStream || this.localStream || undefined;
  }

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    this.replaceTracksOnAllPeers();
  }

  async setScreenStream(stream: MediaStream | null) {
    this.screenStream = stream;
    this.replaceTracksOnAllPeers();
  }

  private replaceTracksOnAllPeers() {
    const outgoing = this.getOutgoingStream();
    this.peers.forEach((pc) => {
      if (!outgoing) return;
      try {
        // simple-peer doesn't have great replaceTrack support,
        // so we remove old tracks and add new ones
        const sender = pc.peer as PeerInstance & { _senderMap?: Map<MediaStreamTrack, unknown> };
        outgoing.getTracks().forEach(track => {
          try {
            pc.peer.addTrack(track, outgoing);
          } catch {
            // Track may already exist; try replaceTrack via underlying RTCPeerConnection
            try {
              const rtcPc = (pc.peer as unknown as { _pc: RTCPeerConnection })._pc;
              if (rtcPc) {
                const senders = rtcPc.getSenders();
                const matchSender = senders.find(s => s.track?.kind === track.kind);
                if (matchSender) {
                  matchSender.replaceTrack(track);
                }
              }
            } catch { /* ignore */ }
          }
        });
      } catch { /* ignore */ }
    });
  }

  getLocalStream() {
    return this.localStream;
  }

  getScreenStream() {
    return this.screenStream;
  }

  connectToPeer(userId: string) {
    if (this.peers.has(userId)) return;
    this.createPeer(userId, true);
    this.socket.emit('webrtc:request', { userId });
  }

  private createPeer(userId: string, initiator: boolean) {
    if (this.peers.has(userId)) return;

    const outgoing = this.getOutgoingStream();

    const peer = new Peer({
      initiator,
      stream: outgoing,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal: Peer.SignalData) => {
      this.socket.emit('webrtc:signal', { userId, signal });
    });

    peer.on('stream', (stream: MediaStream) => {
      const pc = this.peers.get(userId);
      if (pc) pc.stream = stream;
      this.onRemoteStream(userId, stream);
    });

    peer.on('close', () => {
      this.peers.delete(userId);
      this.onRemoteDisconnect(userId);
    });

    peer.on('error', () => {
      this.peers.delete(userId);
      this.onRemoteDisconnect(userId);
    });

    this.peers.set(userId, { peer, userId });
  }

  disconnectPeer(userId: string) {
    const pc = this.peers.get(userId);
    if (pc) {
      pc.peer.destroy();
      this.peers.delete(userId);
    }
  }

  isConnected(userId: string): boolean {
    return this.peers.has(userId);
  }

  setVolume(userId: string, volume: number) {
    const pc = this.peers.get(userId);
    if (pc?.stream) {
      (pc.stream as MediaStream & { _volume?: number })._volume = volume;
    }
  }

  getRemoteStream(userId: string): MediaStream | undefined {
    return this.peers.get(userId)?.stream;
  }

  getAllPeers(): Map<string, PeerConnection> {
    return this.peers;
  }

  destroy() {
    this.peers.forEach((pc) => pc.peer.destroy());
    this.peers.clear();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.screenStream = null;
  }
}
