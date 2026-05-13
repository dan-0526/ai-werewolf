// 棋子编码：正数红方，负数黑方，0 为空
export enum Piece {
  Empty = 0,
  RKing = 1, RAdvisor = 2, RBishop = 3, RKnight = 4, RRook = 5, RCannon = 6, RPawn = 7,
  BKing = -1, BAdvisor = -2, BBishop = -3, BKnight = -4, BRook = -5, BCannon = -6, BPawn = -7,
}

export type Position = [number, number]; // [row, col], row 0-9, col 0-8

export type Side = 'red' | 'black';

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
}

export interface GameConfig {
  name: string;
  mode: 'chinese' | 'western';
  bo: number;
  moveDelayMs: number;
  maxRetries: number;
  language: string;
}

export interface PlayerConfig {
  model: string;
  side: Side;
}

// WebSocket 事件类型
export type WSEvent =
  | { type: 'match_start'; bo: number; players: { red: string; black: string } }
  | { type: 'game_start'; game: number; red: string; black: string }
  | { type: 'move'; player: Side; from: Position; to: Position; piece: string; notation: string; thinking?: string }
  | { type: 'illegal_move'; player: Side; attempt: string; reason: string; retry: number }
  | { type: 'game_end'; game: number; winner: Side | 'draw'; reason: string; score: Record<string, number> }
  | { type: 'match_end'; winner: string; finalScore: Record<string, number> };
