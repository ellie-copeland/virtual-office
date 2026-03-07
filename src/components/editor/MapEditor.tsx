'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, TILE_COLORS, TILE_SIZE } from '@/lib/types';

interface Props {
  map: MapData;
  selectedTile: number;
  onUpdateTile: (x: number, y: number, tile: number) => void;
}

export default function MapEditor({ map, selectedTile, onUpdateTile }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

  const getTilePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    if (x >= 0 && x < map.width && y >= 0 && y < map.height) return { x, y };
    return null;
  }, [map]);

  const paint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getTilePos(e);
    if (pos) onUpdateTile(pos.x, pos.y, selectedTile);
  }, [getTilePos, onUpdateTile, selectedTile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = map.width * TILE_SIZE;
    canvas.height = map.height * TILE_SIZE;

    // Draw tiles
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x];
        ctx.fillStyle = TILE_COLORS[tile] || '#2D2D2D';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Room boundaries
    for (const room of map.rooms) {
      const b = room.bounds;
      ctx.strokeStyle = room.type === 'private' ? '#e74c3c' : '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(b.x * TILE_SIZE, b.y * TILE_SIZE, b.width * TILE_SIZE, b.height * TILE_SIZE);
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(room.name, b.x * TILE_SIZE + 4, b.y * TILE_SIZE + 12);
    }

    // Hover highlight
    if (hoverTile) {
      ctx.fillStyle = 'rgba(108,92,231,0.3)';
      ctx.fillRect(hoverTile.x * TILE_SIZE, hoverTile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }, [map, hoverTile]);

  return (
    <canvas
      ref={canvasRef}
      style={{ cursor: 'crosshair' }}
      onMouseDown={(e) => { setIsPainting(true); paint(e); }}
      onMouseMove={(e) => {
        setHoverTile(getTilePos(e));
        if (isPainting) paint(e);
      }}
      onMouseUp={() => setIsPainting(false)}
      onMouseLeave={() => { setIsPainting(false); setHoverTile(null); }}
    />
  );
}
