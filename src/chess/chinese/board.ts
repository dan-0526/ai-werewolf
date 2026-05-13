import { Piece, type Position, type Move, type Side } from '../shared/types.js';

const INITIAL_BOARD: number[][] = [
  [-5, -4, -3, -2, -1, -2, -3, -4, -5],
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
  [ 0, -6,  0,  0,  0,  0,  0, -6,  0],
  [-7,  0, -7,  0, -7,  0, -7,  0, -7],
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
  [ 7,  0,  7,  0,  7,  0,  7,  0,  7],
  [ 0,  6,  0,  0,  0,  0,  0,  6,  0],
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
  [ 5,  4,  3,  2,  1,  2,  3,  4,  5],
];

const PIECE_NAMES_RED: Record<number, string> = {
  [Piece.RKing]: '帥', [Piece.RAdvisor]: '仕', [Piece.RBishop]: '相',
  [Piece.RKnight]: '馬', [Piece.RRook]: '車', [Piece.RCannon]: '炮', [Piece.RPawn]: '兵',
};

const PIECE_NAMES_BLACK: Record<number, string> = {
  [Piece.BKing]: '將', [Piece.BAdvisor]: '士', [Piece.BBishop]: '象',
  [Piece.BKnight]: '马', [Piece.BRook]: '车', [Piece.BCannon]: '砲', [Piece.BPawn]: '卒',
};

export class ChessBoard {
  private grid: number[][];

  constructor(grid?: number[][]) {
    this.grid = grid
      ? grid.map(row => [...row])
      : INITIAL_BOARD.map(row => [...row]);
  }

  get(pos: Position): Piece {
    return this.grid[pos[0]][pos[1]] as Piece;
  }

  set(pos: Position, piece: Piece): void {
    this.grid[pos[0]][pos[1]] = piece;
  }

  applyMove(move: Move): Move {
    const captured = this.get(move.to);
    const fullMove = { ...move, captured: captured !== Piece.Empty ? captured : undefined };
    this.set(move.to, move.piece);
    this.set(move.from, Piece.Empty);
    return fullMove;
  }

  undoMove(move: Move): void {
    this.set(move.from, move.piece);
    this.set(move.to, move.captured ?? Piece.Empty);
  }

  getPieces(side: Side): { piece: Piece; pos: Position }[] {
    const result: { piece: Piece; pos: Position }[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = this.grid[r][c];
        if (p === 0) continue;
        if (side === 'red' && p > 0) result.push({ piece: p as Piece, pos: [r, c] });
        if (side === 'black' && p < 0) result.push({ piece: p as Piece, pos: [r, c] });
      }
    }
    return result;
  }

  findKing(side: Side): Position {
    const target = side === 'red' ? Piece.RKing : Piece.BKing;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === target) return [r, c];
      }
    }
    throw new Error(`${side} king not found`);
  }

  getSide(pos: Position): Side | null {
    const p = this.grid[pos[0]][pos[1]];
    if (p > 0) return 'red';
    if (p < 0) return 'black';
    return null;
  }

  clone(): ChessBoard {
    return new ChessBoard(this.grid);
  }

  toText(): string {
    const lines: string[] = [];
    for (let r = 0; r < 10; r++) {
      const row = this.grid[r].map(p => {
        if (p === 0) return '．';
        if (p > 0) return PIECE_NAMES_RED[p] ?? '?';
        return PIECE_NAMES_BLACK[p] ?? '?';
      });
      lines.push(row.join(' '));
      if (r === 4) lines.push('—— 楚河  汉界 ——');
    }
    return lines.join('\n');
  }

  getGrid(): readonly (readonly number[])[] {
    return this.grid;
  }

  pieceName(piece: Piece): string {
    if (piece > 0) return PIECE_NAMES_RED[piece] ?? '?';
    if (piece < 0) return PIECE_NAMES_BLACK[piece] ?? '?';
    return '．';
  }
}
