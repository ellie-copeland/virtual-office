'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Room, User, ScheduledMeeting, TILE_SIZE } from '@/lib/types';

interface Props {
  rooms: Room[];
  users: User[];
  scheduledMeetings?: ScheduledMeeting[];
  cameraOffset: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
}

function getNextMeeting(roomId: string, meetings: ScheduledMeeting[]): ScheduledMeeting | null {
  const now = Date.now();
  const upcoming = meetings
    .filter(m => m.roomId === roomId && new Date(m.startTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return upcoming[0] ?? null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RoomStatusOverlay({
  rooms,
  users,
  scheduledMeetings = [],
  cameraOffset,
  canvasWidth,
  canvasHeight,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const room of rooms) {
      const b = room.bounds;
      const capacity = room.meetingRoom?.capacity ?? Math.max(4, Math.floor((b.width * b.height) / 4));
      const occupants = users.filter(u => u.roomId === room.id);
      const count = occupants.length;
      const next = getNextMeeting(room.id, scheduledMeetings);

      // Status color
      let statusColor: string;
      if (count === 0) {
        statusColor = '#4CAF50'; // green - empty
      } else if (count >= capacity) {
        statusColor = '#F44336'; // red - full
      } else {
        statusColor = '#FFC107'; // yellow - in use
      }

      // Badge position: centered above the room
      const centerX = (b.x + b.width / 2) * TILE_SIZE - cameraOffset.x;
      const centerY = b.y * TILE_SIZE - cameraOffset.y - 12;

      // Skip if offscreen
      if (centerX < -120 || centerX > canvas.width + 120 || centerY < -40 || centerY > canvas.height + 40) {
        continue;
      }

      // Measure text for dynamic badge width
      const label = room.name;
      const countText = `${count}/${capacity}`;
      const timeText = next ? formatTime(next.startTime) : null;

      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const nameWidth = ctx.measureText(label).width;
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      const countWidth = ctx.measureText(countText).width;
      const timeWidth = timeText ? ctx.measureText(`Next: ${timeText}`).width : 0;

      const contentWidth = Math.max(nameWidth + countWidth + 30, timeText ? timeWidth + 16 : 0);
      const badgeHeight = timeText ? 36 : 22;
      const badgeX = centerX - contentWidth / 2;
      const badgeY = centerY - badgeHeight;

      // Background
      ctx.fillStyle = 'rgba(24, 24, 30, 0.88)';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, contentWidth, badgeHeight, 6);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, contentWidth, badgeHeight, 6);
      ctx.stroke();

      // Status indicator dot
      const dotX = badgeX + 10;
      const dotY = badgeY + 11;
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect on dot
      ctx.shadowColor = statusColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Room name
      ctx.fillStyle = '#E0E0E0';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, dotX + 8, dotY);

      // Count
      ctx.fillStyle = statusColor;
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(countText, badgeX + contentWidth - 8, dotY);
      ctx.textAlign = 'left';

      // Next meeting time
      if (timeText) {
        ctx.fillStyle = '#9E9E9E';
        ctx.font = '9px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Next: ${timeText}`, badgeX + 8, badgeY + badgeHeight - 8);
      }

      // Small triangle pointer below badge
      ctx.fillStyle = 'rgba(24, 24, 30, 0.88)';
      ctx.beginPath();
      ctx.moveTo(centerX - 4, badgeY + badgeHeight);
      ctx.lineTo(centerX + 4, badgeY + badgeHeight);
      ctx.lineTo(centerX, badgeY + badgeHeight + 5);
      ctx.closePath();
      ctx.fill();
    }
  }, [rooms, users, scheduledMeetings, cameraOffset, canvasWidth, canvasHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    draw();
  }, [draw, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    />
  );
}
