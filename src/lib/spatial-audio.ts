import { Position, Room, PROXIMITY_FULL_VOLUME, PROXIMITY_MAX_DISTANCE } from './types';

export function getDistance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function calculateVolume(
  listenerPos: Position,
  listenerRoom: string | null,
  speakerPos: Position,
  speakerRoom: string | null,
  rooms: Room[]
): number {
  // Private room isolation
  const listenerRoomData = rooms.find(r => r.id === listenerRoom);
  const speakerRoomData = rooms.find(r => r.id === speakerRoom);

  if (listenerRoomData?.type === 'private' || speakerRoomData?.type === 'private') {
    if (listenerRoom !== speakerRoom) return 0;
  }

  const dist = getDistance(listenerPos, speakerPos);
  if (dist <= PROXIMITY_FULL_VOLUME) return 1;
  if (dist >= PROXIMITY_MAX_DISTANCE) return 0;
  return 1 - (dist - PROXIMITY_FULL_VOLUME) / (PROXIMITY_MAX_DISTANCE - PROXIMITY_FULL_VOLUME);
}

export function calculatePan(listenerPos: Position, speakerPos: Position): number {
  const dx = speakerPos.x - listenerPos.x;
  return Math.max(-1, Math.min(1, dx / PROXIMITY_MAX_DISTANCE));
}
