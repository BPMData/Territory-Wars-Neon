
import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameBoard from './components/GameBoard';
import { 
  Direction, GameStatus, Player, Grid, Point, PowerUpType 
} from './types';
import { 
  GRID_COLS, GRID_ROWS, MOVE_DELAY_FRAMES, ROUND_TIME_SECONDS, 
  SCORE_FRESH, SCORE_STEAL, SCORE_LOSS_PENALTY, ROUNDS_TO_WIN, 
  PLAYER_1_COLOR, PLAYER_2_COLOR, PLAYER_3_COLOR, PLAYER_4_COLOR,
  PLAYER_1_GLOW, PLAYER_2_GLOW, PLAYER_3_GLOW, PLAYER_4_GLOW,
  P1_CONTROLS, P2_CONTROLS, P3_CONTROLS, P4_CONTROLS, OPPOSITE_DIRS,
  POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS, POWERUP_LIGHTNING_DURATION_FRAMES,
  POWERUP_SPEED_DURATION_FRAMES, POWERUP_BOMB_RADIUS
} from './constants';
import { soundEngine } from './services/soundEngine';

// Helper to create an empty grid structure
const createEmptyGrid = (): Grid => {
  return Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
};

const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const App: React.FC = () => {
  // -- State --
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [players, setPlayers] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_SECONDS);
  const [winner, setWinner] = useState<string | null>(null);

  // -- Refs --
  const frameRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastPowerUpTime = useRef<number>(0);
  const nextPowerUpInterval = useRef<number>(randomRange(POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS));
  
  const gameState = useRef({
    grid: createEmptyGrid(),
    players: [] as Player[],
    playing: false
  });

  // -- Initialization --

  const initPlayers = useCallback((existingPlayers?: Player[]): Player[] => {
    const cols = GRID_COLS;
    const rows = GRID_ROWS;

    // Starting positions for 4 players (Corners)
    const startPositions = [
        { x: 3, y: 3 },                   // P1
        { x: cols - 4, y: 3 },            // P2
        { x: 3, y: rows - 4 },            // P3
        { x: cols - 4, y: rows - 4 }      // P4
    ];
    
    const startDirs = [
        Direction.RIGHT, // P1
        Direction.LEFT,  // P2
        Direction.RIGHT, // P3
        Direction.LEFT   // P4
    ];

    const configs = [
        { id: 1, name: "CYAN", color: PLAYER_1_COLOR, glowColor: PLAYER_1_GLOW },
        { id: 2, name: "MAGENTA", color: PLAYER_2_COLOR, glowColor: PLAYER_2_GLOW },
        { id: 3, name: "LIME", color: PLAYER_3_COLOR, glowColor: PLAYER_3_GLOW },
        { id: 4, name: "AMBER", color: PLAYER_4_COLOR, glowColor: PLAYER_4_GLOW }
    ];

    return configs.map((cfg, index) => {
        const prev = existingPlayers ? existingPlayers.find(p => p.id === cfg.id) : null;
        const roundsWon = prev ? prev.roundsWon : 0;
        
        return {
            ...cfg,
            position: { ...startPositions[index] },
            direction: startDirs[index],
            nextDirection: startDirs[index],
            trail: [{ ...startPositions[index] }],
            score: 0,
            roundsWon: roundsWon,
            isStunned: false,
            stunTimer: 0,
            moveCooldown: 0,
            speedBuffTimer: 0
        };
    });
  }, []);

  const startGame = async () => {
    await soundEngine.initialize();
    soundEngine.startMusic();
    
    const initialPlayers = initPlayers();
    const initialGrid = createEmptyGrid();
    
    // Pre-occupy start positions
    initialPlayers.forEach(p => {
        initialGrid[p.position.y][p.position.x] = { ownerId: p.id, isFresh: true, timestamp: Date.now() };
    });

    gameState.current = {
      grid: initialGrid,
      players: initialPlayers,
      playing: true
    };

    // Reset Powerup Timer
    lastPowerUpTime.current = Date.now();
    nextPowerUpInterval.current = randomRange(POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS);

    setGrid(initialGrid);
    setPlayers(initialPlayers);
    setTimeLeft(ROUND_TIME_SECONDS);
    setStatus(GameStatus.PLAYING);
    setWinner(null);
    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const startNextRound = () => {
    const currentPlayers = players; 
    const nextRoundPlayers = initPlayers(currentPlayers);
    const nextGrid = createEmptyGrid();

    nextRoundPlayers.forEach(p => {
        nextGrid[p.position.y][p.position.x] = { ownerId: p.id, isFresh: true, timestamp: Date.now() };
    });

    gameState.current = {
      grid: nextGrid,
      players: nextRoundPlayers,
      playing: true
    };

    lastPowerUpTime.current = Date.now();

    setGrid(nextGrid);
    setPlayers(nextRoundPlayers);
    setTimeLeft(ROUND_TIME_SECONDS);
    setStatus(GameStatus.PLAYING);
    soundEngine.startMusic();
    
    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const resetMatch = () => {
    startGame();
  };

  // -- Logic --

  const spawnPowerUp = (currentGrid: Grid) => {
      const types = [PowerUpType.LIGHTNING, PowerUpType.BOMB, PowerUpType.SPEED];
      const type = types[Math.floor(Math.random() * types.length)];
      const pId = Date.now() + Math.random(); // Unique ID for this 2x2 block
      
      // Try to find an empty 2x2 spot
      for (let i = 0; i < 20; i++) {
          const r = randomRange(1, GRID_ROWS - 3);
          const c = randomRange(1, GRID_COLS - 3);
          
          // Check 2x2 area for existing powerups
          let clear = true;
          for(let y=0; y<2; y++){
             for(let x=0; x<2; x++){
                const cell = currentGrid[r+y][c+x];
                // Don't spawn on top of another powerup
                if (cell && cell.powerUp !== undefined) {
                    clear = false;
                }
             }
          }

          if (clear) {
              // Spawn 2x2
               for(let y=0; y<2; y++){
                 for(let x=0; x<2; x++){
                    const cell = currentGrid[r+y][c+x];
                    if (!cell) {
                         currentGrid[r+y][c+x] = { 
                             ownerId: null, 
                             isFresh: true, 
                             timestamp: Date.now(), 
                             powerUp: type,
                             powerUpId: pId
                         };
                    } else {
                         cell.powerUp = type;
                         cell.powerUpId = pId;
                    }
                 }
              }
              soundEngine.playPowerUpSpawn();
              break;
          }
      }
  };

  // -- Game Loop --

  const gameLoop = (time: number) => {
    if (!gameState.current.playing) return;

    const now = Date.now();

    // Update Timer
    if (Math.floor(time / 1000) > Math.floor(lastTimeRef.current / 1000)) {
      setTimeLeft(prev => {
        if (prev <= 1) {
            endRound();
            return 0;
        }
        return prev - 1;
      });
    }

    lastTimeRef.current = time;
    frameRef.current++;

    // PowerUp Spawner
    if (now - lastPowerUpTime.current > nextPowerUpInterval.current) {
        spawnPowerUp(gameState.current.grid);
        lastPowerUpTime.current = now;
        nextPowerUpInterval.current = randomRange(POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS);
    }

    updatePhysics();

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const updatePhysics = () => {
    const { grid, players } = gameState.current;
    
    const newPlayers = players.map(p => ({ ...p }));
    // We mutate grid in place for performance in this frame, but trigger React update with shallow copy
    const newGrid = grid.map(row => [...row]);

    newPlayers.forEach(player => {
        // 1. Handle Timers
        if (player.stunTimer > 0) {
            player.stunTimer--;
            if (player.stunTimer <= 0) player.isStunned = false;
        }
        if (player.speedBuffTimer > 0) {
            player.speedBuffTimer--;
        }

        // 2. Handle Movement Cooldown
        // Stunned players don't reduce cooldowns or move
        if (player.isStunned) return;

        if (player.moveCooldown > 0) {
            player.moveCooldown--;
        }

        // 3. Move
        if (player.moveCooldown <= 0) {
            // Calculate Move
            player.direction = player.nextDirection;

            let dx = 0; let dy = 0;
            if (player.direction === Direction.UP) dy = -1;
            if (player.direction === Direction.DOWN) dy = 1;
            if (player.direction === Direction.LEFT) dx = -1;
            if (player.direction === Direction.RIGHT) dx = -1; // Bug fix: Right is +1

            if (player.direction === Direction.RIGHT) dx = 1; // Corrected locally here, previous code had it right but let's be safe

            let nx = player.position.x + dx;
            let ny = player.position.y + dy;

            // Pacman Logic
            if (nx < 0) nx = GRID_COLS - 1;
            else if (nx >= GRID_COLS) nx = 0;
            if (ny < 0) ny = GRID_ROWS - 1;
            else if (ny >= GRID_ROWS) ny = 0;

            player.position = { x: nx, y: ny };
            player.trail.push({ x: nx, y: ny });

            // -- CELL INTERACTION --
            const cell = newGrid[ny][nx];

            // Claim Logic
            if (!cell || cell.ownerId === null) {
                // Fresh
                newGrid[ny][nx] = { 
                    ownerId: player.id, 
                    isFresh: true, 
                    timestamp: Date.now(), 
                    powerUp: cell?.powerUp,
                    powerUpId: cell?.powerUpId
                };
                player.score += SCORE_FRESH;
                soundEngine.playClaimSound(true);
            } else if (cell.ownerId !== player.id) {
                // Steal
                const victimId = cell.ownerId;
                const victim = newPlayers.find(p => p.id === victimId);
                if (victim) victim.score -= SCORE_LOSS_PENALTY;

                newGrid[ny][nx] = { 
                    ownerId: player.id, 
                    isFresh: false, 
                    timestamp: Date.now(), 
                    powerUp: cell.powerUp,
                    powerUpId: cell.powerUpId
                };
                player.score += SCORE_STEAL;
                soundEngine.playClaimSound(false);
            }

            // PowerUp Logic
            if (newGrid[ny][nx]?.powerUp !== undefined) {
                const cell = newGrid[ny][nx]!;
                const type = cell.powerUp!;
                const pId = cell.powerUpId;

                soundEngine.playPowerUpCollect(type);
                
                // Clear the powerup from the grid
                // If it's a 2x2 block (has pId), clear all matching cells
                if (pId) {
                     for(let y=0; y<GRID_ROWS; y++){
                        for(let x=0; x<GRID_COLS; x++){
                            if (newGrid[y][x]?.powerUpId === pId) {
                                newGrid[y][x]!.powerUp = undefined;
                                newGrid[y][x]!.powerUpId = undefined;
                            }
                        }
                    }
                } else {
                    newGrid[ny][nx]!.powerUp = undefined;
                }

                if (type === PowerUpType.LIGHTNING) {
                    // Stun all others
                    newPlayers.forEach(p => {
                        if (p.id !== player.id) {
                            p.isStunned = true;
                            p.stunTimer = POWERUP_LIGHTNING_DURATION_FRAMES;
                        }
                    });
                } else if (type === PowerUpType.SPEED) {
                    // Speed self
                    player.speedBuffTimer = POWERUP_SPEED_DURATION_FRAMES;
                } else if (type === PowerUpType.BOMB) {
                    // Paint radius
                    const r = POWERUP_BOMB_RADIUS;
                    for (let by = ny - r; by <= ny + r; by++) {
                        for (let bx = nx - r; bx <= nx + r; bx++) {
                            if (by >= 0 && by < GRID_ROWS && bx >= 0 && bx < GRID_COLS) {
                                const bCell = newGrid[by][bx];
                                const dist = Math.sqrt(Math.pow(bx - nx, 2) + Math.pow(by - ny, 2));
                                if (dist <= r) {
                                    if (bCell && bCell.ownerId !== player.id) {
                                         // Steal existing
                                         if (bCell.ownerId !== null) {
                                            const victim = newPlayers.find(p => p.id === bCell.ownerId);
                                            if (victim) victim.score -= SCORE_LOSS_PENALTY;
                                            player.score += SCORE_STEAL;
                                         } else {
                                            player.score += SCORE_FRESH;
                                         }
                                         newGrid[by][bx] = { ...bCell, ownerId: player.id, isFresh: false, timestamp: Date.now() };
                                    } else if (!bCell) {
                                         // Claim empty
                                         newGrid[by][bx] = { ownerId: player.id, isFresh: true, timestamp: Date.now() };
                                         player.score += SCORE_FRESH;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Reset Cooldown
            // If speed buff active, delay is halved (faster)
            const delay = player.speedBuffTimer > 0 ? MOVE_DELAY_FRAMES / 2 : MOVE_DELAY_FRAMES;
            player.moveCooldown = delay;
            
            // Audio Pulse
            soundEngine.pulseEngine(player.id);
        }
    });

    // Update sound engine leitmotifs
    const scores = newPlayers.map(p => p.score);
    soundEngine.updateLeitmotifs(scores);

    gameState.current.grid = newGrid;
    gameState.current.players = newPlayers;

    setGrid(newGrid);
    setPlayers(newPlayers);
  };

  const endRound = () => {
    gameState.current.playing = false;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    soundEngine.stopMusic();

    const { players } = gameState.current;
    
    // Determine round winner (Max Score)
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const roundWinner = sortedPlayers[0];
    
    // Update Rounds Won
    const updatedPlayers = players.map(p => ({
        ...p,
        roundsWon: p.id === roundWinner.id ? p.roundsWon + 1 : p.roundsWon
    }));
    
    setPlayers(updatedPlayers);
    soundEngine.playWinRound();

    // Check Match Win
    const matchWinner = updatedPlayers.find(p => p.roundsWon >= ROUNDS_TO_WIN);

    if (matchWinner) {
        setWinner(matchWinner.name);
        setStatus(GameStatus.MATCH_OVER);
        soundEngine.playGameOver();
    } else {
        setStatus(GameStatus.ROUND_OVER);
    }
  };

  // -- Input Handling --

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!gameState.current.playing) return;

        const code = e.code;
        const { players } = gameState.current;

        const updateDir = (playerIdx: number, newDir: Direction) => {
            const p = players[playerIdx];
            if (OPPOSITE_DIRS[p.direction] !== newDir) {
                p.nextDirection = newDir;
            }
        };

        // P1 (WASD)
        if (P1_CONTROLS.UP.includes(code)) updateDir(0, Direction.UP);
        if (P1_CONTROLS.DOWN.includes(code)) updateDir(0, Direction.DOWN);
        if (P1_CONTROLS.LEFT.includes(code)) updateDir(0, Direction.LEFT);
        if (P1_CONTROLS.RIGHT.includes(code)) updateDir(0, Direction.RIGHT);

        // P2 (ARROWS)
        if (P2_CONTROLS.UP.includes(code)) updateDir(1, Direction.UP);
        if (P2_CONTROLS.DOWN.includes(code)) updateDir(1, Direction.DOWN);
        if (P2_CONTROLS.LEFT.includes(code)) updateDir(1, Direction.LEFT);
        if (P2_CONTROLS.RIGHT.includes(code)) updateDir(1, Direction.RIGHT);
        
        // P3 (IJKL)
        if (P3_CONTROLS.UP.includes(code)) updateDir(2, Direction.UP);
        if (P3_CONTROLS.DOWN.includes(code)) updateDir(2, Direction.DOWN);
        if (P3_CONTROLS.LEFT.includes(code)) updateDir(2, Direction.LEFT);
        if (P3_CONTROLS.RIGHT.includes(code)) updateDir(2, Direction.RIGHT);
        
        // P4 (NUMPAD)
        if (P4_CONTROLS.UP.includes(code)) updateDir(3, Direction.UP);
        if (P4_CONTROLS.DOWN.includes(code)) updateDir(3, Direction.DOWN);
        if (P4_CONTROLS.LEFT.includes(code)) updateDir(3, Direction.LEFT);
        if (P4_CONTROLS.RIGHT.includes(code)) updateDir(3, Direction.RIGHT);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatScore = (score: number) => score.toString().padStart(4, '0');

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-[#05050a] text-white overflow-hidden scanlines">
      
      {/* HUD Bar */}
      <div className="absolute top-0 w-full flex justify-center p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="w-full max-w-7xl flex justify-between items-start">
            
            {/* Left Group (P1, P3) */}
            <div className="flex gap-12">
                {/* P1 */}
                <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                        <span className="text-cyan-400 font-bold text-sm tracking-widest">CYAN</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-white">
                        {players[0] ? formatScore(players[0].score) : "0000"}
                    </div>
                    <div className="flex gap-1 mt-1">
                        {[...Array(ROUNDS_TO_WIN)].map((_, i) => (
                            <div key={i} className={`w-4 h-1.5 rounded-sm ${players[0] && players[0].roundsWon > i ? 'bg-cyan-400' : 'bg-gray-800'}`} />
                        ))}
                    </div>
                </div>

                {/* P3 */}
                <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 bg-lime-500 shadow-[0_0_10px_#84cc16]"></div>
                        <span className="text-lime-500 font-bold text-sm tracking-widest">LIME</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-white">
                        {players[2] ? formatScore(players[2].score) : "0000"}
                    </div>
                    <div className="flex gap-1 mt-1">
                        {[...Array(ROUNDS_TO_WIN)].map((_, i) => (
                            <div key={i} className={`w-4 h-1.5 rounded-sm ${players[2] && players[2].roundsWon > i ? 'bg-lime-500' : 'bg-gray-800'}`} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center mx-8">
                <div className="text-5xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)] font-mono">
                    {timeLeft}
                </div>
            </div>

            {/* Right Group (P4, P2) */}
            <div className="flex gap-12">
                 {/* P4 */}
                 <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-amber-500 font-bold text-sm tracking-widest">AMBER</span>
                        <div className="w-3 h-3 bg-amber-500 shadow-[0_0_10px_#f59e0b]"></div>
                    </div>
                    <div className="text-2xl font-black font-mono text-white">
                        {players[3] ? formatScore(players[3].score) : "0000"}
                    </div>
                    <div className="flex gap-1 mt-1">
                        {[...Array(ROUNDS_TO_WIN)].map((_, i) => (
                            <div key={i} className={`w-4 h-1.5 rounded-sm ${players[3] && players[3].roundsWon > i ? 'bg-amber-500' : 'bg-gray-800'}`} />
                        ))}
                    </div>
                </div>

                {/* P2 */}
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-fuchsia-400 font-bold text-sm tracking-widest">MAGENTA</span>
                        <div className="w-3 h-3 bg-fuchsia-400 shadow-[0_0_10px_#d946ef]"></div>
                    </div>
                    <div className="text-2xl font-black font-mono text-white">
                        {players[1] ? formatScore(players[1].score) : "0000"}
                    </div>
                    <div className="flex gap-1 mt-1">
                        {[...Array(ROUNDS_TO_WIN)].map((_, i) => (
                            <div key={i} className={`w-4 h-1.5 rounded-sm ${players[1] && players[1].roundsWon > i ? 'bg-fuchsia-400' : 'bg-gray-800'}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative z-0 mt-8">
        <GameBoard grid={grid} players={players} />
      </div>

      {/* Footer Controls */}
      <div className="absolute bottom-4 w-full flex justify-center text-gray-500 text-[10px] font-mono opacity-40">
         <div className="flex gap-8">
            <div>P1: WASD</div>
            <div>P2: ARROWS</div>
            <div>P3: IJKL</div>
            <div>P4: NUMPAD 8456</div>
         </div>
      </div>

      {/* Menu Overlay */}
      {status === GameStatus.MENU && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-lime-400 to-fuchsia-500 drop-shadow-[0_0_20px_rgba(124,58,237,0.5)] mb-4 italic tracking-tighter" style={{ fontFamily: "'Press Start 2P', cursive" }}>
            NEON<br/>TERRITORY
          </h1>
          <p className="text-violet-300 mb-12 text-xl tracking-widest">4-PLAYER BATTLE MODE</p>
          
          <button 
            onClick={startGame}
            className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-none border-2 border-cyan-500 hover:bg-cyan-500/20 transition-all duration-300"
          >
            <div className="absolute inset-0 w-full h-full bg-cyan-400/10 group-hover:bg-cyan-400/30 transition-all"></div>
            <span className="relative text-cyan-400 font-bold text-xl tracking-[0.2em] group-hover:text-white">
                INITIALIZE SYSTEM
            </span>
          </button>
          <p className="mt-8 text-gray-500 text-sm">AUDIO SYNTHESIS ENABLED</p>
        </div>
      )}

      {/* Round Over Overlay */}
      {status === GameStatus.ROUND_OVER && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-50">
          <h2 className="text-5xl font-bold text-white mb-8 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">ROUND COMPLETE</h2>
          <div className="grid grid-cols-2 gap-8 mb-8 text-xl font-mono">
             <div className="text-cyan-400">CYAN: {players[0]?.score}</div>
             <div className="text-fuchsia-400">MAGENTA: {players[1]?.score}</div>
             <div className="text-lime-500">LIME: {players[2]?.score}</div>
             <div className="text-amber-500">AMBER: {players[3]?.score}</div>
          </div>
          <button 
            onClick={startNextRound}
            className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded shadow-[0_0_20px_rgba(124,58,237,0.5)]"
          >
            NEXT ROUND
          </button>
        </div>
      )}

      {/* Match Over Overlay */}
      {status === GameStatus.MATCH_OVER && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
          <div className="animate-pulse">
            <h1 className="text-8xl font-black text-white mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">
                {winner} WINS
            </h1>
          </div>
          <p className="text-2xl text-gray-400 mb-12 tracking-widest">DOMINANCE ESTABLISHED</p>
          <button 
            onClick={resetMatch}
            className="px-10 py-4 border border-white text-white hover:bg-white hover:text-black transition-colors font-bold tracking-widest"
          >
            REBOOT SYSTEM
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
