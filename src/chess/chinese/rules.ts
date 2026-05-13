import { Piece, type Position, type Move, type Side } from '../shared/types.js';
import { ChessBoard } from './board.js';

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r <= 9 && c >= 0 && c <= 8;
}

function pieceSide(piece: Piece): Side | null {
  if (piece > 0) return 'red';
  if (piece < 0) return 'black';
  return null;
}

function pieceType(piece: Piece): number {
  return Math.abs(piece);
}

const PALACE_RED = { minR: 7, maxR: 9, minC: 3, maxC: 5 };
const PALACE_BLACK = { minR: 0, maxR: 2, minC: 3, maxC: 5 };

function inPalace(r: number, c: number, side: Side): boolean {
  const p = side === 'red' ? PALACE_RED : PALACE_BLACK;
  return r >= p.minR && r <= p.maxR && c >= p.minC && c <= p.maxC;
}

function getSideOfPiece(piece: Piece): Side {
  return piece > 0 ? 'red' : 'black';
}

export class ChessRules {
  static generateMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    const type = pieceType(piece);
    let targets: Position[];
    switch (type) {
      case 1: targets = ChessRules.kingMoves(board, piece, pos); break;
      case 2: targets = ChessRules.advisorMoves(board, piece, pos); break;
      case 3: targets = ChessRules.bishopMoves(board, piece, pos); break;
      case 4: targets = ChessRules.knightMoves(board, piece, pos); break;
      case 5: return ChessRules.lineMoves(board, piece, pos, false);
      case 6: return ChessRules.lineMoves(board, piece, pos, true);
      case 7: targets = ChessRules.pawnMoves(board, piece, pos); break;
      default: targets = [];
    }
    return ChessRules.filterMoves(board, piece, pos, targets);
  }

  private static kingMoves(_board: ChessBoard, piece: Piece, pos: Position): Position[] {
    const side = getSideOfPiece(piece);
    const [r, c] = pos;
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const results: Position[] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (inPalace(nr, nc, side)) {
        results.push([nr, nc]);
      }
    }
    return results;
  }

  private static advisorMoves(_board: ChessBoard, piece: Piece, pos: Position): Position[] {
    const side = getSideOfPiece(piece);
    const [r, c] = pos;
    const dirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const results: Position[] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (inPalace(nr, nc, side)) {
        results.push([nr, nc]);
      }
    }
    return results;
  }

  private static bishopMoves(board: ChessBoard, piece: Piece, pos: Position): Position[] {
    const side = getSideOfPiece(piece);
    const [r, c] = pos;
    const dirs: [number, number][] = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    const results: Position[] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      // Cannot cross river
      if (side === 'red' && nr < 5) continue;
      if (side === 'black' && nr > 4) continue;
      // Check eye (midpoint)
      const eyeR = r + dr / 2;
      const eyeC = c + dc / 2;
      if (board.get([eyeR, eyeC]) !== Piece.Empty) continue;
      results.push([nr, nc]);
    }
    return results;
  }

  private static knightMoves(board: ChessBoard, _piece: Piece, pos: Position): Position[] {
    const [r, c] = pos;
    const jumps = [
      { dr: -2, dc: -1, legR: -1, legC: 0 },
      { dr: -2, dc: 1, legR: -1, legC: 0 },
      { dr: 2, dc: -1, legR: 1, legC: 0 },
      { dr: 2, dc: 1, legR: 1, legC: 0 },
      { dr: -1, dc: -2, legR: 0, legC: -1 },
      { dr: -1, dc: 2, legR: 0, legC: 1 },
      { dr: 1, dc: -2, legR: 0, legC: -1 },
      { dr: 1, dc: 2, legR: 0, legC: 1 },
    ];
    const results: Position[] = [];
    for (const { dr, dc, legR, legC } of jumps) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      // Check leg (blocking piece)
      const lr = r + legR;
      const lc = c + legC;
      if (board.get([lr, lc]) !== Piece.Empty) continue;
      results.push([nr, nc]);
    }
    return results;
  }

  private static lineMoves(board: ChessBoard, piece: Piece, pos: Position, isCannon: boolean): Move[] {
    const [r, c] = pos;
    const side = getSideOfPiece(piece);
    const moves: Move[] = [];
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of dirs) {
      let jumped = false;
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board.get([nr, nc]);
        if (!isCannon) {
          // Rook logic
          if (target === Piece.Empty) {
            moves.push({ from: pos, to: [nr, nc], piece });
          } else {
            // Hit a piece
            if (pieceSide(target) !== side) {
              moves.push({ from: pos, to: [nr, nc], piece, captured: target });
            }
            break;
          }
        } else {
          // Cannon logic
          if (!jumped) {
            if (target === Piece.Empty) {
              moves.push({ from: pos, to: [nr, nc], piece });
            } else {
              jumped = true; // found platform
            }
          } else {
            // After jumping, can only capture
            if (target !== Piece.Empty) {
              if (pieceSide(target) !== side) {
                moves.push({ from: pos, to: [nr, nc], piece, captured: target });
              }
              break;
            }
          }
        }
        nr += dr;
        nc += dc;
      }
    }
    return moves;
  }

  private static pawnMoves(_board: ChessBoard, piece: Piece, pos: Position): Position[] {
    const side = getSideOfPiece(piece);
    const [r, c] = pos;
    const results: Position[] = [];

    if (side === 'red') {
      // Red moves up (row decreases)
      const forward: Position = [r - 1, c];
      if (inBounds(forward[0], forward[1])) results.push(forward);
      // After crossing river (row <= 4), can move sideways
      if (r <= 4) {
        if (c - 1 >= 0) results.push([r, c - 1]);
        if (c + 1 <= 8) results.push([r, c + 1]);
      }
    } else {
      // Black moves down (row increases)
      const forward: Position = [r + 1, c];
      if (inBounds(forward[0], forward[1])) results.push(forward);
      // After crossing river (row >= 5), can move sideways
      if (r >= 5) {
        if (c - 1 >= 0) results.push([r, c - 1]);
        if (c + 1 <= 8) results.push([r, c + 1]);
      }
    }
    return results;
  }

  private static filterMoves(board: ChessBoard, piece: Piece, from: Position, targets: Position[]): Move[] {
    const side = getSideOfPiece(piece);
    const moves: Move[] = [];
    for (const to of targets) {
      const target = board.get(to);
      // Cannot capture own piece
      if (target !== Piece.Empty && pieceSide(target) === side) continue;
      const move: Move = { from, to, piece };
      if (target !== Piece.Empty) move.captured = target;
      moves.push(move);
    }
    return moves;
  }

  static isKingsFacing(board: ChessBoard): boolean {
    const redKing = board.findKing('red');
    const blackKing = board.findKing('black');
    if (redKing[1] !== blackKing[1]) return false;
    const col = redKing[1];
    const minR = Math.min(redKing[0], blackKing[0]);
    const maxR = Math.max(redKing[0], blackKing[0]);
    for (let r = minR + 1; r < maxR; r++) {
      if (board.get([r, col]) !== Piece.Empty) return false;
    }
    return true;
  }

  static isInCheck(board: ChessBoard, side: Side): boolean {
    const kingPos = board.findKing(side);
    const enemySide: Side = side === 'red' ? 'black' : 'red';
    const enemies = board.getPieces(enemySide);
    for (const { piece, pos } of enemies) {
      const moves = ChessRules.generateMoves(board, piece, pos);
      for (const move of moves) {
        if (move.to[0] === kingPos[0] && move.to[1] === kingPos[1]) {
          return true;
        }
      }
    }
    return false;
  }

  static isLegalMove(board: ChessBoard, move: Move, side: Side): boolean {
    // Piece must belong to the given side
    if (pieceSide(move.piece) !== side) return false;
    // Target must not be own piece
    const target = board.get(move.to);
    if (target !== Piece.Empty && pieceSide(target) === side) return false;
    // Move must be in generated moves list
    const generated = ChessRules.generateMoves(board, move.piece, move.from);
    const found = generated.some(m => m.to[0] === move.to[0] && m.to[1] === move.to[1]);
    if (!found) return false;
    // After move, king must not be in check and kings must not be facing
    const clone = board.clone();
    clone.applyMove(move);
    if (ChessRules.isInCheck(clone, side)) return false;
    if (ChessRules.isKingsFacing(clone)) return false;
    return true;
  }

  static isCheckmate(board: ChessBoard, side: Side): boolean {
    if (!ChessRules.isInCheck(board, side)) return false;
    return !ChessRules.hasLegalMove(board, side);
  }

  static isStalemate(board: ChessBoard, side: Side): boolean {
    if (ChessRules.isInCheck(board, side)) return false;
    return !ChessRules.hasLegalMove(board, side);
  }

  private static hasLegalMove(board: ChessBoard, side: Side): boolean {
    const pieces = board.getPieces(side);
    for (const { piece, pos } of pieces) {
      const moves = ChessRules.generateMoves(board, piece, pos);
      for (const move of moves) {
        if (ChessRules.isLegalMove(board, move, side)) return true;
      }
    }
    return false;
  }
}
