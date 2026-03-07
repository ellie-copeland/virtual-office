'use client';

import { UserStatus } from '@/lib/types';

interface Props {
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  status: UserStatus;
  isChatOpen: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onStatusChange: (status: UserStatus) => void;
  onToggleChat: () => void;
  onEmote: (emoji: string) => void;
  onOpenGames?: () => void;
}

const EMOTES = ['👋', '❤️', '😂', '👍', '🎉'];
const STATUSES: { value: UserStatus; label: string; icon: string }[] = [
  { value: 'available', label: 'Available', icon: '🟢' },
  { value: 'busy', label: 'Busy', icon: '🔴' },
  { value: 'away', label: 'Away', icon: '🟡' },
  { value: 'in-meeting', label: 'In Meeting', icon: '🔵' },
];

const btnBase: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12, border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, transition: 'all 0.15s', color: '#E8D8C0',
};

export default function Toolbar(props: Props) {
  const { isMuted, isCameraOn, isScreenSharing, status, isChatOpen } = props;

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#5C4A38', borderRadius: 16, padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 100,
      backdropFilter: 'blur(12px)', border: '2px solid #C8A850',
    }}>
      {/* Mic */}
      <button
        onClick={props.onToggleMic}
        style={{ ...btnBase, background: isMuted ? '#8B2020' : '#6B4226' }}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>

      {/* Camera */}
      <button
        onClick={props.onToggleCamera}
        style={{ ...btnBase, background: isCameraOn ? '#4A7A3A' : '#6B4226' }}
        title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCameraOn ? '📹' : '📷'}
      </button>

      {/* Screen Share */}
      <button
        onClick={props.onToggleScreenShare}
        style={{ ...btnBase, background: isScreenSharing ? '#C8A850' : '#6B4226' }}
        title="Screen share"
      >
        🖥️
      </button>

      <div style={{ width: 1, height: 28, background: '#C8A850', margin: '0 4px' }} />

      {/* Status */}
      <select
        value={status}
        onChange={e => props.onStatusChange(e.target.value as UserStatus)}
        style={{
          background: '#6B4226', color: '#E8D8C0', border: '1px solid #C8A850', borderRadius: 10,
          padding: '8px 12px', fontSize: 13, cursor: 'pointer', outline: 'none',
        }}
      >
        {STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
        ))}
      </select>

      <div style={{ width: 1, height: 28, background: '#C8A850', margin: '0 4px' }} />

      {/* Emotes */}
      {EMOTES.map(e => (
        <button
          key={e}
          onClick={() => props.onEmote(e)}
          style={{ ...btnBase, background: 'transparent', width: 36, height: 36, fontSize: 20 }}
        >
          {e}
        </button>
      ))}

      <div style={{ width: 1, height: 28, background: '#C8A850', margin: '0 4px' }} />

      {/* Games */}
      {props.onOpenGames && (
        <button
          onClick={props.onOpenGames}
          style={{ ...btnBase, background: '#6B4226' }}
          title="Mini Games"
        >
          🎮
        </button>
      )}

      <div style={{ width: 1, height: 28, background: '#C8A850', margin: '0 4px' }} />

      {/* Chat Toggle */}
      <button
        onClick={props.onToggleChat}
        style={{ ...btnBase, background: isChatOpen ? '#C8A850' : '#6B4226' }}
        title="Toggle chat"
      >
        💬
      </button>
    </div>
  );
}
