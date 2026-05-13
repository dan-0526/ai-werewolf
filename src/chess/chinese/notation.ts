import { Piece, type Position, type Move, type Side } from '../shared/types.js';
import { ChessBoard } from './board.js';

// Red column names: col 8=一, col 7=二, ... col 0=九 (right to left)
const RED_COL_NAMES = '九八七六五四三二一';
// Red number chars for distance/target
const RED_NUMBERS = '零一二三四五六七八九';

// Black column names: col 0=1, col 1=2, ... col 8=9 (left to right, from red's perspective)
const BLACK_COL_NAMES = '123456789';
const BLACK_NUMBERS = '0123456789';

const RED_PIECE_CHARS: Record<number, string> = {
  [Piece.RKing]: '帥', [Piece.RAdvisor]: '仕', [Piece.RBishop]: '相',
  [Piece.RKnight]: '馬', [Piece.RRook]: '車', [Piece.RCannon]: '炮', [Piece.RPawn]: '兵',
};

const BLACK_PIECE_CHARS: Record<number, string> = {
  [Piece.BKing]: '将', [Piece.BAdvisor]: '士', [Piece.BBishop]: '象',
  [Piece.BKnight]: '马', [Piece.BRook]: '车', [Piece.BCannon]: '砲', [Piece.BPawn]: '卒',
};

// Reverse lookup: char -> piece
const CHAR_TO_PIECE: Record<string, Piece> = {};
for (const [p, ch] of Object.entries(RED_PIECE_CHARS)) CHAR_TO_PIECE[ch] = Number(p) as Piece;
for (const [p, ch] of Object.entries(BLACK_PIECE_CHARS)) CHAR_TO_PIECE[ch] = Number(p) as Piece;

/** Whether a piece moves diagonally (knight, advisor, bishop) */
function isDiagonalPiece(piece: Piece): boolean {
  const abs = Math.abs(piece);
  return abs === Math.abs(Piece.RKnight) || abs === Math.abs(Piece.RAdvisor) || abs === Math.abs(Piece.RBishop);
}

/** Get the base piece type (positive value) */
function basePiece(piece: Piece): number {
  return Math.abs(piece);
}

/** Convert column index to column name for a given side */
function colToName(col: number, side: Side): string {
  if (side === 'red') return RED_COL_NAMES[col];
  return BLACK_COL_NAMES[col];
}

/** Convert column name to column index for a given side */
function nameToCol(name: string, side: Side): number {
  if (side === 'red') {
    const idx = RED_COL_NAMES.indexOf(name);
    if (idx === -1) {
      const numIdx = RED_NUMBERS.indexOf(name);
      if (numIdx === -1) return -1;
      // Number used as column name: 一=col8, 二=col7, etc. -> numIdx maps to col (8-numIdx+1)
      return RED_COL_NAMES.length - numIdx;
    }
    return idx;
  }
  // Black: left-to-right, col 0='1', col 1='2', ..., col 8='9'
  const idx = BLACK_COL_NAMES.indexOf(name);
  if (idx === -1) {
    const numIdx = BLACK_NUMBERS.indexOf(name);
    if (numIdx === -1 || numIdx === 0) return -1;
    return numIdx - 1; // '1'->col 0, '2'->col 1, ..., '9'->col 8
  }
  return idx;
}

/** Convert a number to the notation number string for a side */
function numToStr(n: number, side: Side): string {
  if (side === 'red') return RED_NUMBERS[n];
  return BLACK_NUMBERS[n];
}

/** Convert a notation number string to a number for a side */
function strToNum(s: string, side: Side): number {
  if (side === 'red') {
    const idx = RED_NUMBERS.indexOf(s);
    return idx;
  }
  const idx = BLACK_NUMBERS.indexOf(s);
  return idx;
}

/**
 * Find all positions of a given piece type in a specific column for a side.
 * Returns positions sorted by row.
 */
function findSamePieceInCol(board: ChessBoard, piece: Piece, col: number, side: Side): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < 10; r++) {
    if (board.get([r, col]) === piece) {
      positions.push([r, col]);
    }
  }
  return positions;
}

/**
 * Convert a coordinate move to Chinese chess notation.
 */
export function moveToNotation(board: ChessBoard, move: Move, side: Side): string {
  const { from, to, piece } = move;
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;

  const isRed = side === 'red';
  const pieceChars = isRed ? RED_PIECE_CHARS : BLACK_PIECE_CHARS;
  const pieceChar = pieceChars[piece];

  // Check for duplicate pieces in the same column (exclude destination to avoid counting illegal states)
  const samePieces = findSamePieceInCol(board, piece, fromCol, side)
    .filter(p => !(p[0] === toRow && p[1] === toCol));
  let prefix: string;

  if (samePieces.length >= 2) {
    // For red: smaller row = front (closer to opponent); for black: larger row = front
    const sorted = [...samePieces].sort((a, b) => a[0] - b[0]);
    const idx = sorted.findIndex(p => p[0] === fromRow && p[1] === fromCol);
    if (isRed) {
      prefix = idx === 0 ? '前' : '后';
    } else {
      prefix = idx === sorted.length - 1 ? '前' : '后';
    }
    prefix += pieceChar;
  } else {
    prefix = pieceChar + colToName(fromCol, side);
  }

  // Determine direction
  let direction: string;
  let distStr: string;

  if (toRow === fromRow) {
    // Horizontal move
    direction = '平';
    distStr = colToName(toCol, side);
  } else {
    // Vertical or diagonal move
    const advancing = isRed ? (toRow < fromRow) : (toRow > fromRow);
    direction = advancing ? '進' : '退';
    if (!isRed) direction = advancing ? '进' : '退';

    if (isDiagonalPiece(piece)) {
      // For diagonal pieces, distance = target column name
      distStr = colToName(toCol, side);
    } else {
      // For straight-line pieces, distance = number of rows moved
      const steps = Math.abs(toRow - fromRow);
      distStr = numToStr(steps, side);
    }
  }

  return prefix + direction + distStr;
}

/**
 * Parse Chinese chess notation back to a coordinate move.
 * Returns null if the notation is invalid or cannot be resolved.
 */
export function notationToMove(board: ChessBoard, notation: string, side: Side): Move | null {
  try {
    const isRed = side === 'red';
    const chars = [...notation];
    if (chars.length < 4) return null;

    let piece: Piece | null = null;
    let fromCol: number = -1;
    let dupPosition: 'front' | 'back' | null = null;
    let offset = 0;

    // Check for 前/后 prefix
    if (chars[0] === '前' || chars[0] === '后') {
      dupPosition = chars[0] === '前' ? 'front' : 'back';
      // Next char is the piece
      const pieceChar = chars[1];
      piece = CHAR_TO_PIECE[pieceChar] ?? null;
      if (piece === null) return null;
      offset = 2;
    } else {
      // First char is piece, second is column
      const pieceChar = chars[0];
      piece = CHAR_TO_PIECE[pieceChar] ?? null;
      if (piece === null) return null;
      const colChar = chars[1];
      fromCol = nameToCol(colChar, side);
      if (fromCol < 0) return null;
      offset = 2;
    }

    // Ensure piece belongs to the correct side
    if (isRed && piece < 0) return null;
    if (!isRed && piece > 0) return null;

    // Direction char
    const dirChar = chars[offset];
    offset++;

    // Distance/target char
    const distChar = chars[offset];

    // Determine direction
    let direction: 'advance' | 'retreat' | 'horizontal';
    if (dirChar === '平') {
      direction = 'horizontal';
    } else if (dirChar === '進' || dirChar === '进') {
      direction = 'advance';
    } else if (dirChar === '退') {
      direction = 'retreat';
    } else {
      return null;
    }

    // Find the source position
    let fromRow: number = -1;

    if (dupPosition !== null) {
      // Find all pieces of this type on the board, then pick front/back
      const allPositions: Position[] = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          if (board.get([r, c]) === piece) {
            allPositions.push([r, c]);
          }
        }
      }

      // Group by column to find which column has duplicates
      // For 前/后, we need to find the column with multiple same pieces
      const colGroups: Record<number, Position[]> = {};
      for (const pos of allPositions) {
        const c = pos[1];
        if (!colGroups[c]) colGroups[c] = [];
        colGroups[c].push(pos);
      }
      // Find the column with multiple pieces
      let dupCol = -1;
      let dupPositions: Position[] = [];
      for (const [c, positions] of Object.entries(colGroups)) {
        if (positions.length >= 2) {
          dupCol = Number(c);
          dupPositions = positions.sort((a, b) => a[0] - b[0]);
          break;
        }
      }
      if (dupCol === -1) return null;
      fromCol = dupCol;
      // front = closer to opponent: red smaller row, black larger row
      if (isRed) {
        fromRow = dupPosition === 'front' ? dupPositions[0][0] : dupPositions[dupPositions.length - 1][0];
      } else {
        fromRow = dupPosition === 'front' ? dupPositions[dupPositions.length - 1][0] : dupPositions[0][0];
      }
    } else {
      // Find the piece in the specified column
      const positions = findSamePieceInCol(board, piece, fromCol, side);
      if (positions.length === 0) return null;
      // If multiple, this shouldn't happen without 前/后 prefix, take first
      fromRow = positions[0][0];
    }

    if (fromRow < 0) return null;
    if (fromCol < 0) return null;

    // Calculate target position
    let toRow: number;
    let toCol: number;

    if (direction === 'horizontal') {
      toRow = fromRow;
      toCol = nameToCol(distChar, side);
      if (toCol < 0) return null;
    } else {
      const advancing = direction === 'advance';
      if (isDiagonalPiece(piece)) {
        toCol = nameToCol(distChar, side);
        if (toCol < 0) return null;
        // Determine row change based on piece type
        const colDiff = Math.abs(toCol - fromCol);
        const abs = basePiece(piece);
        let rowDiff: number;
        if (abs === Math.abs(Piece.RKnight)) {
          // Knight: moves in L-shape, colDiff can be 1 or 2
          rowDiff = colDiff === 1 ? 2 : 1;
        } else if (abs === Math.abs(Piece.RAdvisor)) {
          rowDiff = 1;
        } else {
          // Bishop
          rowDiff = 2;
        }
        if (isRed) {
          toRow = advancing ? fromRow - rowDiff : fromRow + rowDiff;
        } else {
          toRow = advancing ? fromRow + rowDiff : fromRow - rowDiff;
        }
      } else {
        // Straight-line piece: distance = steps
        const steps = strToNum(distChar, side);
        if (steps <= 0) return null;
        toCol = fromCol;
        if (isRed) {
          toRow = advancing ? fromRow - steps : fromRow + steps;
        } else {
          toRow = advancing ? fromRow + steps : fromRow - steps;
        }
      }
    }

    if (toRow < 0 || toRow > 9 || toCol < 0 || toCol > 8) return null;

    return { from: [fromRow, fromCol] as Position, to: [toRow, toCol] as Position, piece };
  } catch {
    return null;
  }
}
