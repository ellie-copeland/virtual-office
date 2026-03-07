'use client';

import { TILE_COLORS, TILE_NAMES } from '@/lib/types';

interface Props {
  selectedTile: number;
  onSelect: (tile: number) => void;
}

export default function TilePalette({ selectedTile, onSelect }: Props) {
  const tiles = Object.entries(TILE_NAMES).map(([k, name]) => ({
    id: parseInt(k),
    name,
    color: TILE_COLORS[parseInt(k)] || '#333',
  }));

  return (
    <div style={{
      width: 200, background: '#2d2d3d', borderRight: '1px solid #3d3d4d',
      padding: 16, overflowY: 'auto',
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#fff' }}>Tiles</h3>
      {tiles.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '8px 10px', marginBottom: 4, borderRadius: 8, border: 'none',
            background: selectedTile === t.id ? '#6C5CE7' : 'transparent',
            color: '#fff', cursor: 'pointer', fontSize: 13, textAlign: 'left',
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: 4, background: t.color,
            border: '1px solid #555', flexShrink: 0,
          }} />
          {t.name}
        </button>
      ))}
    </div>
  );
}
