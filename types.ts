
export enum GemType {
  RED = 'RED',
  BLUE = 'BLUE',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  PURPLE = 'PURPLE',
  ORANGE = 'ORANGE',
  DIAMOND = 'DIAMOND',
  STAR = 'STAR',
  RAINBOW = 'RAINBOW',
}

export type SpecialType = 'NONE' | 'ROW_BLAST' | 'COL_BLAST' | 'AREA_BLAST' | 'RAINBOW';

export type CellStatus = 'IDLE' | 'SWAPPING' | 'MATCHED' | 'DROPPING' | 'EMPTY' | 'CREATED';

export interface Position {
  row: number;
  col: number;
}

export interface Cell {
  id: string;
  type: GemType;
  special: SpecialType;
  status: CellStatus;
  row: number; // Logical row
  col: number; // Logical col
  visualRow: number; // For animation
  visualCol: number; // For animation
  isBonus?: boolean;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  speed: number;
  life: number;
  size?: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  life: number;
}

export interface LevelConfig {
  level: number;
  targetScore: number;
  moves: number; // Limit on number of swaps
  timeLimit?: number; // seconds, optional
  description: string;
}

export type ItemType = 'BOMB' | 'REFRESH';

export type GamePhase = 'START' | 'PLAYING' | 'LEVEL_COMPLETE' | 'GAME_OVER';

export const GRID_ROWS = 8;
export const GRID_COLS = 8;
export const GEM_TYPES_ARRAY = [
  GemType.RED,
  GemType.BLUE,
  GemType.GREEN,
  GemType.YELLOW,
  GemType.PURPLE,
  GemType.ORANGE,
  GemType.DIAMOND,
  GemType.STAR,
  GemType.RAINBOW
];
