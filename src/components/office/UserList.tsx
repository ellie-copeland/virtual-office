'use client';

import { User } from '@/lib/types';

interface Props {
  users: User[];
  currentUserId: string;
}

const STATUS_ICONS: Record<string, string> = {
  available: '🟢', busy: '🔴', away: '🟡', 'in-meeting': '🔵',
};

export default function UserList({ users, currentUserId }: Props) {
  const sorted = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, bottom: 72, width: 220,
      background: '#2d2d3d', borderRight: '1px solid #3d3d4d',
      display: 'flex', flexDirection: 'column', zIndex: 90,
    }}>
      <div style={{
        padding: '16px 16px 12px', borderBottom: '1px solid #3d3d4d',
        fontSize: 14, fontWeight: 600, color: '#fff',
      }}>
        Online — {users.length}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {sorted.map(user => (
          <div key={user.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 10, marginBottom: 2, transition: 'background 0.15s',
            background: user.id === currentUserId ? 'rgba(108,92,231,0.15)' : 'transparent',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: user.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
              border: user.isSpeaking ? '2px solid #4CAF50' : '2px solid transparent',
            }}>
              {user.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: '#fff',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user.name} {user.id === currentUserId ? '(you)' : ''}
              </div>
              <div style={{
                fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4,
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
