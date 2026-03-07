'use client';

import { MapData, User, TILE_VOID, TILE_WALL, TILE_OUTDOOR, TILE_CARPET, TILE_WOOD_FLOOR, TILE_RUG, TILE_PHONE_BOOTH } from '@/lib/types';

interface Props {
  map: MapData;
  users: User[];
  currentUserId: string;
}

const SCALE = 4;

function tileColor(tile: number): string | null {
  if (tile === TILE_VOID) return null;
  if (tile === TILE_WALL) return '#4A4A5A';
  if (tile === TILE_OUTDOOR) return '#5A8A3A';
  if (tile === TILE_CARPET) return '#4A6A8A';
  if (tile === TILE_WOOD_FLOOR) return '#A08050';
  if (tile === TILE_RUG) return '#7A5A9A';
  if (tile === TILE_PHONE_BOOTH) return '#7A8A9A';
  return '#D0CCC0';
}

export default function MiniMap({ map, users, currentUserId }: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, zIndex: 80,
      background: 'rgba(30,20,10,0.85)', borderRadius: 12, padding: 8,
      border: '2px solid #C8A850', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)',
    }}>
      <svg width={map.width * SCALE} height={map.height * SCALE}>
        {/* Tiles */}
        {map.tiles.map((row, y) =>
          row.map((tile, x) => {
            const c = tileColor(tile);
            return c ? (
              <rect
                key={`${x}-${y}`}
                x={x * SCALE} y={y * SCALE}
                width={SCALE} height={SCALE}
                fill={c}
              />
            ) : null;
          })
        )}
        {/* Room labels */}
        {map.rooms.map(room => (
          <text
            key={room.id}
            x={(room.bounds.x + room.bounds.width / 2) * SCALE}
            y={(room.bounds.y + room.bounds.height / 2) * SCALE + 1}
            fill="rgba(232,216,192,0.7)"
            fontSize={7}
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {room.name.length > 8 ? room.name.slice(0, 6) + '..' : room.name}
          </text>
        ))}
        {/* Users */}
        {users.map(user => (
          <circle
            key={user.id}
            cx={user.position.x * SCALE}
            cy={user.position.y * SCALE}
            r={user.id === currentUserId ? 3 : 2}
            fill={user.color}
            stroke={user.id === currentUserId ? '#E8D8C0' : 'none'}
            strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  );
}
