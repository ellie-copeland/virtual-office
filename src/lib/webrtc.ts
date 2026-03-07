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

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    // Replace tracks on existing peers
    this.peers.forEach((pc) => {
      if (stream) {
        try {
          stream.getTracks().forEach(track => {
            pc.peer.addTrack(track, stream);
          });
        } catch { /* peer may not support addTrack */ }
      }
    });
  }

  getLocalStream() {
    return this.localStream;
  }

  connectToPeer(userId: string) {
    if (this.peers.has(userId)) return;
    this.createPeer(userId, true);
    this.socket.emit('webrtc:request', { userId });
  }

  private createPeer(userId: string, initiator: boolean) {
    if (this.peers.has(userId)) return;

    const peer = new Peer({
      initiator,
      stream: this.localStream || undefined,
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

  setVolume(userId: string, volume: number) {
    // Volume is applied via the audio element in VideoOverlay
    const pc = this.peers.get(userId);
    if (pc?.stream) {
      // We emit a custom event that the UI can listen to
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
  }
}
