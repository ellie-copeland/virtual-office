'use client';

import { MapData, User, TILE_COLORS } from '@/lib/types';

interface Props {
  map: MapData;
  users: User[];
  currentUserId: string;
}

const SCALE = 5;

export default function MiniMap({ map, users, currentUserId }: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, zIndex: 80,
      background: '#2d2d3d', borderRadius: 12, padding: 8,
      border: '1px solid #3d3d4d', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <svg width={map.width * SCALE} height={map.height * SCALE}>
        {/* Tiles */}
        {map.tiles.map((row, y) =>
          row.map((tile, x) => (
            tile !== 0 ? (
              <rect
                key={`${x}-${y}`}
                x={x * SCALE}
                y={y * SCALE}
                width={SCALE}
                height={SCALE}
                fill={TILE_COLORS[tile] || '#2D2D2D'}
              />
            ) : null
          ))
        )}
        {/* Users */}
        {users.map(user => (
          <circle
            key={user.id}
            cx={user.position.x * SCALE}
            cy={user.position.y * SCALE}
            r={user.id === currentUserId ? 3 : 2}
            fill={user.color}
            stroke={user.id === currentUserId ? '#fff' : 'none'}
            strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  );
}
