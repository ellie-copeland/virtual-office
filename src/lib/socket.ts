import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socket) {
    const options: any = {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    };

    // Add authentication if token provided
    if (token) {
      options.auth = { token };
      // Also try query params as fallback
      options.query = { token };
    }

    socket = io(typeof window !== 'undefined' ? window.location.origin : '', options);
  }
  return socket;
}

export function connectSocket(token?: string): Socket {
  // If we have a different auth context, reset the socket
  if (socket && ((token && !(socket.auth as any)?.token) || (!token && (socket.auth as any)?.token))) {
    socket.disconnect();
    socket = null;
  }
  
  const s = getSocket(token);
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
