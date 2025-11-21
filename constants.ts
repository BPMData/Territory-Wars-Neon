
import { Direction } from "./types";

// Grid Settings
export const GRID_COLS = 50;
export const GRID_ROWS = 36;
export const CELL_SIZE = 20;
export const CELL_HEIGHT = 8;

// Gameplay Settings
export const FPS = 60;
export const MOVE_DELAY_FRAMES = 12;
export const ROUND_TIME_SECONDS = 60;
export const ROUNDS_TO_WIN = 3;

// Powerups
export const POWERUP_SPAWN_MIN_MS = 500; // Much more frequent
export const POWERUP_SPAWN_MAX_MS = 3000; // Much more frequent
export const POWERUP_LIGHTNING_DURATION_FRAMES = 180; // 3 seconds @ 60fps
export const POWERUP_SPEED_DURATION_FRAMES = 420; // 7 seconds @ 60fps
export const POWERUP_BOMB_RADIUS = 6;

// Scoring
export const SCORE_FRESH = 2;
export const SCORE_STEAL = 1;
export const SCORE_LOSS_PENALTY = 2;

// Visuals
export const PLAYER_1_COLOR = "#22d3ee"; // Cyan 400
export const PLAYER_1_GLOW = "#0891b2"; // Cyan 600
export const PLAYER_2_COLOR = "#d946ef"; // Fuchsia 400
export const PLAYER_2_GLOW = "#c026d3"; // Fuchsia 600
export const PLAYER_3_COLOR = "#84cc16"; // Lime 500
export const PLAYER_3_GLOW = "#4d7c0f"; // Lime 700
export const PLAYER_4_COLOR = "#f59e0b"; // Amber 500
export const PLAYER_4_GLOW = "#b45309"; // Amber 700

export const COLOR_LIGHTNING = "#facc15"; // Yellow 400
export const COLOR_BOMB = "#f43f5e"; // Rose 500
export const COLOR_SPEED = "#22c55e"; // Green 500

export const GRID_COLOR = "rgba(76, 29, 149, 0.3)"; // Violet 800 low opacity
export const BACKGROUND_COLOR = "#0f0718"; // Very dark purple

// Controls
export const P1_CONTROLS = {
  UP: ["KeyW"],
  DOWN: ["KeyS"],
  LEFT: ["KeyA"],
  RIGHT: ["KeyD"],
};

export const P2_CONTROLS = {
  UP: ["ArrowUp"],
  DOWN: ["ArrowDown"],
  LEFT: ["ArrowLeft"],
  RIGHT: ["ArrowRight"],
};

export const P3_CONTROLS = {
  UP: ["KeyI"],
  DOWN: ["KeyK"],
  LEFT: ["KeyJ"],
  RIGHT: ["KeyL"],
};

export const P4_CONTROLS = {
  UP: ["Numpad8"],
  DOWN: ["Numpad2"],
  LEFT: ["Numpad4"],
  RIGHT: ["Numpad6"],
};

export const OPPOSITE_DIRS = {
  [Direction.UP]: Direction.DOWN,
  [Direction.DOWN]: Direction.UP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
};
