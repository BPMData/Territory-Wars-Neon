
import React, { useRef, useEffect } from 'react';
import { Grid, Player, PowerUpType } from '../types';
import { 
    CELL_SIZE, GRID_COLS, GRID_ROWS, CELL_HEIGHT, GRID_COLOR, 
    PLAYER_1_COLOR, PLAYER_2_COLOR, PLAYER_1_GLOW, PLAYER_2_GLOW,
    PLAYER_3_COLOR, PLAYER_4_COLOR, PLAYER_3_GLOW, PLAYER_4_GLOW, BACKGROUND_COLOR,
    COLOR_LIGHTNING, COLOR_BOMB, COLOR_SPEED
} from '../constants';

interface GameBoardProps {
  grid: Grid;
  players: Player[];
}

const getPlayerStyle = (id: number, isStunned: boolean) => {
    if (isStunned) return { color: "#64748b", glow: "#94a3b8" }; // Gray if stunned
    switch(id) {
        case 1: return { color: PLAYER_1_COLOR, glow: PLAYER_1_GLOW };
        case 2: return { color: PLAYER_2_COLOR, glow: PLAYER_2_GLOW };
        case 3: return { color: PLAYER_3_COLOR, glow: PLAYER_3_GLOW };
        case 4: return { color: PLAYER_4_COLOR, glow: PLAYER_4_GLOW };
        default: return { color: "#ffffff", glow: "#ffffff" };
    }
}

const GameBoard: React.FC<GameBoardProps> = ({ grid, players }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Safety check
    if (!grid || grid.length === 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Clear with background color
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Base Lines (The floor)
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    
    // Verticals
    for (let x = 0; x <= GRID_COLS; x++) {
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, GRID_ROWS * CELL_SIZE);
    }
    // Horizontals
    for (let y = 0; y <= GRID_ROWS; y++) {
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(GRID_COLS * CELL_SIZE, y * CELL_SIZE);
    }
    ctx.stroke();

    // Function to draw a 2.5D block
    const drawBlock = (x: number, y: number, color: string, glowColor: string, height: number, isHead: boolean) => {
        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;
        
        // 1. Shadow/Glow
        if (isHead) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = glowColor;
        } else {
             ctx.shadowBlur = 0;
        }

        // 2. Side Face (Darker)
        ctx.fillStyle = adjustColorBrightness(color, -40);
        ctx.fillRect(px, py + CELL_SIZE - height, CELL_SIZE, height); // Front face strip
        
        // 3. Top Face (Main Color) - Shifted UP by height
        ctx.fillStyle = color;
        ctx.fillRect(px, py - height, CELL_SIZE, CELL_SIZE);
        
        // Reset shadow
        ctx.shadowBlur = 0;
    };

    const drawPowerUp = (x: number, y: number, type: PowerUpType) => {
        // Draw at the intersection of the 2x2 block
        // px, py is top-left of the 2x2 block
        const px = x * CELL_SIZE + CELL_SIZE; 
        const py = y * CELL_SIZE + CELL_SIZE;
        
        ctx.shadowBlur = 30;

        // Scale graphics up for 2x2 size
        switch(type) {
            case PowerUpType.LIGHTNING: // Tall Yellow Spike
                ctx.fillStyle = COLOR_LIGHTNING;
                ctx.shadowColor = COLOR_LIGHTNING;
                // Make it much thicker and taller
                ctx.fillRect(px - 10, py - 35, 20, 50); 
                break;
            case PowerUpType.BOMB: // Red Box
                ctx.fillStyle = COLOR_BOMB;
                ctx.shadowColor = COLOR_BOMB;
                // Much bigger box
                ctx.fillRect(px - 16, py - 16, 32, 32);
                break;
            case PowerUpType.SPEED: // Green Diamond
                ctx.fillStyle = COLOR_SPEED;
                ctx.shadowColor = COLOR_SPEED;
                // Bigger diamond
                ctx.beginPath();
                ctx.moveTo(px, py - 30);
                ctx.lineTo(px + 20, py - 8);
                ctx.lineTo(px, py + 14);
                ctx.lineTo(px - 20, py - 8);
                ctx.fill();
                break;
        }
        ctx.shadowBlur = 0;
    };

    // Render Territory (The Trail)
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            const cell = grid[y]?.[x];
            if (cell) {
                // Draw Territory
                if (cell.ownerId !== null) {
                    const style = getPlayerStyle(cell.ownerId, false);
                    const height = cell.isFresh ? CELL_HEIGHT : CELL_HEIGHT * 0.6;
                    drawBlock(x, y, style.color, style.glow, height, false);
                }

                // Draw PowerUp
                if (cell.powerUp !== undefined) {
                    const pId = cell.powerUpId;
                    // Only draw if we are the "anchor" (top-left) of this powerup cluster
                    let isAnchor = true;
                    
                    if (pId) {
                        // If neighbors share ID, and are Up or Left, we are not anchor
                        if (x > 0 && grid[y][x-1]?.powerUpId === pId) isAnchor = false;
                        if (y > 0 && grid[y-1][x]?.powerUpId === pId) isAnchor = false;
                    }

                    if (isAnchor) {
                        drawPowerUp(x, y, cell.powerUp);
                    }
                }
            }
        }
    }

    // Draw Players (Heads)
    players.forEach(p => {
        const style = getPlayerStyle(p.id, p.isStunned);
        // If stunned, flickering effect handled by color change in helper
        drawBlock(p.position.x, p.position.y, "#ffffff", style.glow, CELL_HEIGHT * 1.5, true);
        
        // Draw indicator
        ctx.fillStyle = style.color;
        ctx.fillRect(
            p.position.x * CELL_SIZE + CELL_SIZE * 0.25,
            p.position.y * CELL_SIZE - CELL_HEIGHT * 1.5 + CELL_SIZE * 0.25,
            CELL_SIZE * 0.5,
            CELL_SIZE * 0.5
        );
    });

  }, [grid, players]);

  return (
    <canvas
      ref={canvasRef}
      width={GRID_COLS * CELL_SIZE}
      height={GRID_ROWS * CELL_SIZE}
      className="rounded-lg border-2 border-violet-900 shadow-[0_0_50px_rgba(124,58,237,0.3)] bg-opacity-50 backdrop-blur-sm"
      style={{
          transform: "perspective(1000px) rotateX(20deg) scale(0.95)",
          transformOrigin: "center center"
      }}
    />
  );
};

// Helper for darkening side faces
function adjustColorBrightness(hex: string, percent: number) {
    let num = parseInt(hex.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        B = ((num >> 8) & 0x00ff) + amt,
        G = (num & 0x0000ff) + amt;
    return "#" + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 + (G < 255 ? (G < 1 ? 0 : G) : 255)).toString(16).slice(1);
}

export default GameBoard;
