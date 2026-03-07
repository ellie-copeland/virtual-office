'use client';

import { useState, useCallback } from 'react';
import MapEditor from '@/components/editor/MapEditor';
import TilePalette from '@/components/editor/TilePalette';
import { defaultMap } from '@/lib/map-data';
import { MapData } from '@/lib/types';

export default function EditorPage() {
  const [map, setMap] = useState<MapData>(() => JSON.parse(JSON.stringify(defaultMap)));
  const [selectedTile, setSelectedTile] = useState(1);

  const handleUpdateTile = useCallback((x: number, y: number, tile: number) => {
    setMap(prev => {
      const next = { ...prev, tiles: prev.tiles.map(row => [...row]) };
      next.tiles[y][x] = tile;
      return next;
    });
  }, []);

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'map.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          setMap(data);
        } catch { alert('Invalid map file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    setMap(JSON.parse(JSON.stringify(defaultMap)));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1a1a2e' }}>
      <TilePalette selectedTile={selectedTile} onSelect={setSelectedTile} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
          background: '#2d2d3d', borderBottom: '1px solid #3d3d4d',
        }}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#fff', marginRight: 'auto' }}>🗺️ Map Editor</h2>
          <button onClick={handleSave} style={btnStyle}>💾 Save</button>
          <button onClick={handleLoad} style={btnStyle}>📂 Load</button>
          <button onClick={handleReset} style={{ ...btnStyle, background: '#e74c3c' }}>🔄 Reset</button>
          <a href="/office" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-block' }}>← Back</a>
        </div>
        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <MapEditor map={map} selectedTile={selectedTile} onUpdateTile={handleUpdateTile} />
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: '#6C5CE7', color: '#fff', cursor: 'pointer',
  fontSize: 13, fontWeight: 500,
};
