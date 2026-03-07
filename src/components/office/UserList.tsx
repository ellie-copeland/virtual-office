'use client';

import { User } from '@/lib/types';

interface Props {
  users: User[];
  currentUserId: string;
  onUserRightClick?: (user: User, event: React.MouseEvent) => void;
}

const STATUS_ICONS: Record<string, string> = {
  available: '🟢', busy: '🔴', away: '🟡', 'in-meeting': '🔵',
};

export default function UserList({ users, currentUserId, onUserRightClick }: Props) {
  const sorted = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, bottom: 136, width: 220,
      background: '#4A3828', borderRight: '2px solid #C8A850',
      display: 'flex', flexDirection: 'column', zIndex: 90,
    }}>
      <div style={{
        padding: '16px 16px 12px', borderBottom: '1px solid #C8A850',
        fontSize: 14, fontWeight: 600, color: '#E8D8C0',
      }}>
        Online — {users.length}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {sorted.map(user => (
          <div key={user.id} 
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 10, marginBottom: 2, transition: 'background 0.15s',
              background: user.id === currentUserId ? 'rgba(200,168,80,0.15)' : 'transparent',
              border: user.id === currentUserId ? '1px solid #C8A850' : '1px solid transparent',
              cursor: user.id !== currentUserId && onUserRightClick ? 'pointer' : 'default',
            }}
            onContextMenu={(e) => {
              if (user.id !== currentUserId && onUserRightClick) {
                e.preventDefault();
                onUserRightClick(user, e);
              }
            }}
            onMouseEnter={(e) => {
              if (user.id !== currentUserId) {
                (e.target as HTMLElement).style.background = 'rgba(107,66,38,0.3)';
                (e.target as HTMLElement).style.border = '1px solid #C8A87A';
              }
            }}
            onMouseLeave={(e) => {
              if (user.id !== currentUserId) {
                (e.target as HTMLElement).style.background = 'transparent';
                (e.target as HTMLElement).style.border = '1px solid transparent';
              } else {
                (e.target as HTMLElement).style.background = 'rgba(200,168,80,0.15)';
                (e.target as HTMLElement).style.border = '1px solid #C8A850';
              }
            }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: user.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
              border: user.isSpeaking ? '2px solid #4A7A3A' : '2px solid transparent',
            }}>
              {user.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: '#E8D8C0',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user.name} {user.id === currentUserId ? '(you)' : ''}
              </div>
              <div style={{
                fontSize: 11, color: '#D4B88A', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span>{STATUS_ICONS[user.status]}</span>
                <span>{user.roomId || 'Hallway'}</span>
              </div>
            </div>
            {user.isMuted && <span style={{ fontSize: 12 }}>🔇</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
