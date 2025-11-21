
export enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

export enum PowerUpType {
  LIGHTNING, // Stun enemies
  BOMB,      // Paint area
  SPEED      // Double speed
}

export interface Point {
  x: number;
  y: number;
}

export interface Player {
  id: number;
  name: string;
  color: string; // Base color (hex)
  glowColor: string; // Shadow blur color
  position: Point;
  direction: Direction;
  nextDirection: Direction; // Buffer for next frame to prevent suicide turns
  trail: Point[];
  score: number;
  roundsWon: number;
  isStunned: boolean;
  stunTimer: number;
  moveCooldown: number; // Frames until next move
  speedBuffTimer: number; // Frames remaining for speed boost
}

export interface CellData {
  ownerId: number | null;
  isFresh: boolean; // True if never stolen, false if stolen
  timestamp: number; // For animation effects
  powerUp?: PowerUpType;
  powerUpId?: number; // ID to group multi-cell powerups
}

export type Grid = (CellData | null)[][]; // null means empty

export enum GameStatus {
  MENU,
  PLAYING,
  ROUND_OVER,
  MATCH_OVER,
}
