'use client';

import { useEffect, useState } from 'react';
import { MapData, User, TILE_SIZE, TILE_WHITEBOARD, TILE_TV, TILE_ARCADE, TILE_COFFEE } from '@/lib/types';
import { getSocket } from '@/lib/socket';

interface Props {
  map: MapData;
  users: User[];
  currentUserId: string;
}

interface InteractableObject {
  type: 'whiteboard' | 'tv' | 'arcade' | 'coffee';
  x: number;
  y: number;
  action: string;
  key: string;
}

interface InteractionState {
  showWhiteboard: boolean;
  showTVInput: boolean;
  showGameLauncher: boolean;
  tvUrl: string;
  whiteboardData: string;
}

export default function InteractionOverlay({ map, users, currentUserId }: Props) {
  const [nearbyObjects, setNearbyObjects] = useState<InteractableObject[]>([]);
  const [interactionState, setInteractionState] = useState<InteractionState>({
    showWhiteboard: false,
    showTVInput: false,
    showGameLauncher: false,
    tvUrl: '',
    whiteboardData: ''
  });

  const currentUser = users.find(u => u.id === currentUserId);

  useEffect(() => {
    if (!currentUser || !map) return;

    const objects: InteractableObject[] = [];
    const userTileX = Math.floor(currentUser.position.x);
    const userTileY = Math.floor(currentUser.position.y);

    // Check for nearby interactable tiles within 2 tile radius
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tileX = userTileX + dx;
        const tileY = userTileY + dy;
        
        if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) continue;
        
        const tileType = map.tiles[tileY][tileX];
        let objectType: InteractableObject['type'] | null = null;
        let action = '';

        switch (tileType) {
          case TILE_WHITEBOARD:
            objectType = 'whiteboard';
            action = 'Press X to open whiteboard';
            break;
          case TILE_TV:
            objectType = 'tv';
            action = 'Press X to control TV';
            break;
          case TILE_ARCADE:
            objectType = 'arcade';
            action = 'Press X to play games';
            break;
          case TILE_COFFEE:
            objectType = 'coffee';
            action = 'Press X to get coffee';
            break;
        }

        if (objectType) {
          objects.push({
            type: objectType,
            x: tileX,
            y: tileY,
            action,
            key: `${tileX}-${tileY}`
          });
        }
      }
    }

    setNearbyObjects(objects);
  }, [currentUser, map]);

  // Handle keyboard interactions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'x' && nearbyObjects.length > 0) {
        const obj = nearbyObjects[0]; // Interact with closest object
        handleInteraction(obj);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearbyObjects]);

  const handleInteraction = (obj: InteractableObject) => {
    const socket = getSocket();
    
    switch (obj.type) {
      case 'whiteboard':
        setInteractionState(prev => ({ ...prev, showWhiteboard: true }));
        socket.emit('object:interact', { 
          objectId: obj.key, 
          action: 'open', 
          data: { type: 'whiteboard' } 
        });
        break;
      
      case 'tv':
        setInteractionState(prev => ({ ...prev, showTVInput: true }));
        break;
      
      case 'arcade':
        setInteractionState(prev => ({ ...prev, showGameLauncher: true }));
        socket.emit('object:interact', { 
          objectId: obj.key, 
          action: 'open', 
          data: { type: 'arcade' } 
        });
        break;
      
      case 'coffee':
        socket.emit('statusMessage:set', { message: '☕ Getting coffee' });
        socket.emit('object:interact', { 
          objectId: obj.key, 
          action: 'use', 
          data: { type: 'coffee' } 
        });
        break;
    }
  };

  const handleTVSubmit = () => {
    if (interactionState.tvUrl.trim()) {
      const socket = getSocket();
      socket.emit('object:interact', { 
        objectId: 'tv', 
        action: 'play', 
        data: { url: interactionState.tvUrl } 
      });
    }
    setInteractionState(prev => ({ ...prev, showTVInput: false, tvUrl: '' }));
  };

  const closeModals = () => {
    setInteractionState({
      showWhiteboard: false,
      showTVInput: false,
      showGameLauncher: false,
      tvUrl: '',
      whiteboardData: ''
    });
  };

  if (!currentUser) return null;

  return (
    <>
      {/* Proximity tooltips */}
      {nearbyObjects.map(obj => (
        <div
          key={obj.key}
          style={{
            position: 'fixed',
            left: obj.x * TILE_SIZE + 16,
            top: obj.y * TILE_SIZE - 10,
            background: 'rgba(24,16,32,0.9)',
            color: '#E8D8C8',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            zIndex: 85,
            border: '1px solid rgba(200,168,80,0.4)',
            pointerEvents: 'none',
            transform: 'translateX(-50%)',
          }}
        >
          {obj.action}
        </div>
      ))}

      {/* Whiteboard Modal */}
      {interactionState.showWhiteboard && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#2d2d3d', borderRadius: 12, padding: 20,
            width: '80%', height: '80%', maxWidth: 1000, maxHeight: 700,
            border: '2px solid #4d4d5d'
          }}>
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', 
              alignItems: 'center', marginBottom: 16 
            }}>
              <h3 style={{ color: '#fff', margin: 0 }}>📝 Shared Whiteboard</h3>
              <button
                onClick={closeModals}
                style={{
                  background: '#d63384', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '8px 12px', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
            
            <div style={{
              background: '#f8f9fa', width: '100%', height: 'calc(100% - 60px)',
              borderRadius: 8, border: '2px solid #ddd',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#666'
            }}>
              Collaborative whiteboard canvas would go here
              <br />
              <small>(Integration with drawing library needed)</small>
            </div>
          </div>
        </div>
      )}

      {/* TV Input Modal */}
      {interactionState.showTVInput && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#2d2d3d', borderRadius: 12, padding: 24,
            width: 400, border: '2px solid #4d4d5d'
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px 0' }}>📺 TV Control</h3>
            
            <input
              type="text"
              placeholder="Enter YouTube URL or video link..."
              value={interactionState.tvUrl}
              onChange={e => setInteractionState(prev => ({ ...prev, tvUrl: e.target.value }))}
              style={{
                width: '100%', padding: 12, marginBottom: 16,
                background: '#1a1a2e', color: '#fff', border: '1px solid #3d3d4d',
                borderRadius: 8, fontSize: 14, outline: 'none'
              }}
              onKeyDown={e => e.key === 'Enter' && handleTVSubmit()}
            />
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={closeModals}
                style={{
                  background: '#6c757d', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '10px 16px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTVSubmit}
                style={{
                  background: '#6C5CE7', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '10px 16px', cursor: 'pointer'
                }}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Launcher Modal */}
      {interactionState.showGameLauncher && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#2d2d3d', borderRadius: 12, padding: 24,
            width: 500, border: '2px solid #4d4d5d'
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 20px 0' }}>🕹️ Arcade Games</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['Bomberman', 'Space Invaders', 'Jump N Bump', 'Pong'].map(game => (
                <button
                  key={game}
                  onClick={() => {
                    // This would integrate with existing game launcher
                    closeModals();
                  }}
                  style={{
                    background: '#3d3d4d', color: '#fff', border: '1px solid #5d5d6d',
                    borderRadius: 8, padding: 16, cursor: 'pointer',
                    textAlign: 'center', fontSize: 14, fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => (e.target as HTMLButtonElement).style.background = '#4d4d5d'}
                  onMouseLeave={e => (e.target as HTMLButtonElement).style.background = '#3d3d4d'}
                >
                  {game}
                </button>
              ))}
            </div>
            
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                onClick={closeModals}
                style={{
                  background: '#6c757d', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '10px 20px', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}