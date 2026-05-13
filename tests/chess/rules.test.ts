import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChessBoard } from '../../src/chess/chinese/board.js';
import { ChessRules } from '../../src/chess/chinese/rules.js';
import { Piece, type Position } from '../../src/chess/shared/types.js';

function emptyBoard(): ChessBoard {
  const grid = Array.from({ length: 10 }, () => Array(9).fill(0));
  return new ChessBoard(grid);
}

function posSet(moves: Position[]): Set<string> {
  return new Set(moves.map(p => `${p[0]},${p[1]}`));
}

describe('ChessRules - King moves', () => {
  it('red king moves within palace', () => {
    const board = emptyBoard();
    board.set([9, 4], Piece.RKing);
    const moves = ChessRules.generateMoves(board, Piece.RKing, [9, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('8,4'));
    assert.ok(targets.has('9,3'));
    assert.ok(targets.has('9,5'));
    assert.ok(!targets.has('9,2')); // outside palace
  });

  it('black king moves within palace', () => {
    const board = emptyBoard();
    board.set([0, 4], Piece.BKing);
    const moves = ChessRules.generateMoves(board, Piece.BKing, [0, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('1,4'));
    assert.ok(targets.has('0,3'));
    assert.ok(targets.has('0,5'));
    assert.ok(!targets.has('0,2'));
  });

  it('king cannot move outside palace', () => {
    const board = emptyBoard();
    board.set([7, 4], Piece.RKing);
    const moves = ChessRules.generateMoves(board, Piece.RKing, [7, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('7,3'));
    assert.ok(targets.has('7,5'));
    assert.ok(targets.has('8,4'));
    // row 6 is outside palace for red
    assert.ok(!targets.has('6,4'));
  });
});

describe('ChessRules - Advisor moves', () => {
  it('red advisor moves diagonally within palace', () => {
    const board = emptyBoard();
    board.set([9, 3], Piece.RAdvisor);
    const moves = ChessRules.generateMoves(board, Piece.RAdvisor, [9, 3]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('8,4'));
    assert.equal(moves.length, 1); // only one diagonal in palace
  });

  it('advisor at center has 4 moves', () => {
    const board = emptyBoard();
    board.set([8, 4], Piece.RAdvisor);
    const moves = ChessRules.generateMoves(board, Piece.RAdvisor, [8, 4]);
    assert.equal(moves.length, 4);
  });
});

describe('ChessRules - Bishop moves', () => {
  it('red bishop moves diagonally two steps', () => {
    const board = emptyBoard();
    board.set([9, 2], Piece.RBishop);
    const moves = ChessRules.generateMoves(board, Piece.RBishop, [9, 2]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('7,0'));
    assert.ok(targets.has('7,4'));
  });

  it('bishop blocked by eye piece', () => {
    const board = emptyBoard();
    board.set([9, 2], Piece.RBishop);
    board.set([8, 3], Piece.RPawn); // block eye
    const moves = ChessRules.generateMoves(board, Piece.RBishop, [9, 2]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(!targets.has('7,4')); // blocked
    assert.ok(targets.has('7,0')); // not blocked
  });

  it('bishop cannot cross river', () => {
    const board = emptyBoard();
    board.set([5, 2], Piece.RBishop);
    const moves = ChessRules.generateMoves(board, Piece.RBishop, [5, 2]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(!targets.has('3,0')); // across river
    assert.ok(!targets.has('3,4')); // across river
    assert.ok(targets.has('7,0'));
    assert.ok(targets.has('7,4'));
  });
});

describe('ChessRules - Knight moves', () => {
  it('knight in center has up to 8 moves', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RKnight);
    const moves = ChessRules.generateMoves(board, Piece.RKnight, [4, 4]);
    assert.equal(moves.length, 8);
  });

  it('knight blocked by leg piece', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RKnight);
    board.set([3, 4], Piece.RPawn); // block upward leg
    const moves = ChessRules.generateMoves(board, Piece.RKnight, [4, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(!targets.has('2,3')); // blocked
    assert.ok(!targets.has('2,5')); // blocked
    assert.ok(targets.has('6,3')); // not blocked
  });
});

describe('ChessRules - Rook moves', () => {
  it('rook moves in straight lines', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RRook);
    const moves = ChessRules.generateMoves(board, Piece.RRook, [4, 4]);
    // 8 horizontal + 9 vertical - 2 (self) = 16 total? No: 8+9-2=15? Actually 4+4+4+5=17
    // row 4: cols 0-3 and 5-8 = 8; col 4: rows 0-3 and 5-9 = 9; total = 17
    assert.equal(moves.length, 17);
  });

  it('rook blocked by own piece', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RRook);
    board.set([4, 6], Piece.RPawn); // block right
    const moves = ChessRules.generateMoves(board, Piece.RRook, [4, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('4,5'));
    assert.ok(!targets.has('4,6')); // own piece
    assert.ok(!targets.has('4,7')); // behind own piece
  });

  it('rook captures enemy piece', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RRook);
    board.set([4, 6], Piece.BPawn); // enemy
    const moves = ChessRules.generateMoves(board, Piece.RRook, [4, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('4,6')); // can capture
    assert.ok(!targets.has('4,7')); // blocked after capture
  });
});

describe('ChessRules - Cannon moves', () => {
  it('cannon moves like rook when not capturing', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RCannon);
    const moves = ChessRules.generateMoves(board, Piece.RCannon, [4, 4]);
    assert.equal(moves.length, 17);
  });

  it('cannon captures by jumping over exactly one piece', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RCannon);
    board.set([4, 6], Piece.RPawn); // platform
    board.set([4, 8], Piece.BPawn); // target
    const moves = ChessRules.generateMoves(board, Piece.RCannon, [4, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('4,8')); // can capture over platform
    assert.ok(!targets.has('4,6')); // cannot land on platform
    assert.ok(!targets.has('4,7')); // cannot land between platform and target
  });

  it('cannon cannot capture without platform', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RCannon);
    board.set([4, 8], Piece.BPawn);
    const moves = ChessRules.generateMoves(board, Piece.RCannon, [4, 4]);
    const targets = posSet(moves.map(m => m.to));
    // No platform between, so cannon can move to 4,5 4,6 4,7 but not capture 4,8
    assert.ok(!targets.has('4,8'));
    assert.ok(targets.has('4,7'));
  });
});

describe('ChessRules - Pawn moves', () => {
  it('red pawn moves forward before crossing river', () => {
    const board = emptyBoard();
    board.set([6, 4], Piece.RPawn);
    const moves = ChessRules.generateMoves(board, Piece.RPawn, [6, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.equal(moves.length, 1);
    assert.ok(targets.has('5,4')); // forward only
  });

  it('red pawn moves forward or sideways after crossing river', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.RPawn);
    const moves = ChessRules.generateMoves(board, Piece.RPawn, [4, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('3,4')); // forward
    assert.ok(targets.has('4,3')); // left
    assert.ok(targets.has('4,5')); // right
    assert.ok(!targets.has('5,4')); // backward not allowed
    assert.equal(moves.length, 3);
  });

  it('black pawn moves forward before crossing river', () => {
    const board = emptyBoard();
    board.set([3, 4], Piece.BPawn);
    const moves = ChessRules.generateMoves(board, Piece.BPawn, [3, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.equal(moves.length, 1);
    assert.ok(targets.has('4,4'));
  });

  it('black pawn moves forward or sideways after crossing river', () => {
    const board = emptyBoard();
    board.set([5, 4], Piece.BPawn);
    const moves = ChessRules.generateMoves(board, Piece.BPawn, [5, 4]);
    const targets = posSet(moves.map(m => m.to));
    assert.ok(targets.has('6,4')); // forward
    assert.ok(targets.has('5,3')); // left
    assert.ok(targets.has('5,5')); // right
    assert.ok(!targets.has('4,4')); // backward not allowed
    assert.equal(moves.length, 3);
  });
});

describe('ChessRules - Kings facing', () => {
  it('detects kings facing on same column', () => {
    const board = emptyBoard();
    board.set([0, 4], Piece.BKing);
    board.set([9, 4], Piece.RKing);
    assert.ok(ChessRules.isKingsFacing(board));
  });

  it('no facing when piece between kings', () => {
    const board = emptyBoard();
    board.set([0, 4], Piece.BKing);
    board.set([9, 4], Piece.RKing);
    board.set([5, 4], Piece.RPawn);
    assert.ok(!ChessRules.isKingsFacing(board));
  });

  it('no facing when kings on different columns', () => {
    const board = emptyBoard();
    board.set([0, 4], Piece.BKing);
    board.set([9, 3], Piece.RKing);
    assert.ok(!ChessRules.isKingsFacing(board));
  });
});

describe('ChessRules - Check detection', () => {
  it('detects red king in check from rook', () => {
    const board = emptyBoard();
    board.set([9, 4], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    board.set([9, 0], Piece.BRook);
    assert.ok(ChessRules.isInCheck(board, 'red'));
  });

  it('detects black king in check from cannon', () => {
    const board = emptyBoard();
    board.set([9, 4], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    board.set([5, 4], Piece.RCannon); // cannon
    // platform needed between cannon and black king
    board.set([2, 4], Piece.RPawn); // platform
    assert.ok(ChessRules.isInCheck(board, 'black'));
  });

  it('no check when path is blocked', () => {
    const board = emptyBoard();
    board.set([9, 4], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    board.set([9, 0], Piece.BRook);
    board.set([9, 2], Piece.RPawn); // blocks rook
    assert.ok(!ChessRules.isInCheck(board, 'red'));
  });
});

describe('ChessRules - Checkmate detection', () => {
  it('detects checkmate', () => {
    const board = emptyBoard();
    // Red king cornered, two rooks delivering mate
    board.set([9, 3], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    board.set([9, 0], Piece.BRook); // checks along row 9
    board.set([8, 0], Piece.BRook); // covers row 8
    assert.ok(ChessRules.isCheckmate(board, 'red'));
  });

  it('not checkmate if king can escape', () => {
    const board = emptyBoard();
    board.set([9, 4], Piece.RKing);
    board.set([0, 3], Piece.BKing); // different column to avoid facing
    board.set([9, 0], Piece.BRook); // checks along row 9
    // King can move to 8,4 without kings facing (different columns)
    assert.ok(!ChessRules.isCheckmate(board, 'red'));
  });
});

describe('ChessRules - Stalemate detection', () => {
  it('detects stalemate', () => {
    const board = emptyBoard();
    // Red king at 9,3 with no legal moves but not in check
    board.set([9, 3], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    board.set([8, 0], Piece.BRook); // covers row 8
    board.set([7, 3], Piece.BRook); // covers col 3 from above
    board.set([7, 4], Piece.BPawn); // covers col 4
    board.set([7, 5], Piece.BPawn); // covers col 5 (blocks 8,4 and 8,5)
    // King at 9,3: can try 8,3 (blocked by rook on col 3), 9,4 (need to check)
    // Actually let's make a simpler stalemate
    // Reset
    const board2 = emptyBoard();
    board2.set([9, 3], Piece.RKing);
    board2.set([0, 3], Piece.BKing);
    // Block all king moves without giving check
    board2.set([8, 0], Piece.BRook); // covers row 8 (blocks 8,3 8,4)
    board2.set([5, 4], Piece.BRook); // covers col 4 (blocks 9,4)
    board2.set([5, 5], Piece.BRook); // covers col 5 (blocks 9,5)
    // King at 9,3: can go to 8,3(blocked by rook row8), 8,4(blocked), 9,4(blocked by rook col4)
    // But 9,3 -> 9,4 is blocked. What about kings facing? col 3 same column, nothing between -> kings facing!
    // Need to put something between
    board2.set([5, 3], Piece.BPawn); // blocks kings facing and covers col 3
    // Now king at 9,3: 8,3 blocked by row-8 rook, 9,4 blocked by col-4 rook
    // Is king in check? row 8 rook at 8,0 attacks row 8 not row 9. col 4 rook at 5,4 attacks col 4 not col 3.
    // pawn at 5,3 attacks... pawns don't attack sideways before crossing. BPawn at row 5 has crossed river (>=5), so can go forward(row+1=6) or sideways.
    // BPawn doesn't attack 9,3 directly. Good.
    // But wait - is there really no legal move? King can only go to palace squares.
    // From 9,3: up=8,3 left=9,2(outside palace!) right=9,4 down=out of board
    // 8,3 attacked by rook at 8,0? Yes! 9,4 attacked by rook at 5,4? Yes!
    // So no legal moves. Is king in check? No attacks on 9,3.
    // But kings facing: king at 0,3 and 9,3 same col, pawn at 5,3 between. OK not facing.
    assert.ok(!ChessRules.isInCheck(board2, 'red'));
    assert.ok(ChessRules.isStalemate(board2, 'red'));
  });
});

describe('ChessRules - isLegalMove', () => {
  it('rejects move of wrong side piece', () => {
    const board = emptyBoard();
    board.set([4, 4], Piece.BRook);
    board.set([9, 4], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    const move = { from: [4, 4] as Position, to: [4, 5] as Position, piece: Piece.BRook };
    assert.ok(!ChessRules.isLegalMove(board, move, 'red'));
  });

  it('rejects move that leaves king in check', () => {
    const board = emptyBoard();
    board.set([9, 4], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    board.set([5, 4], Piece.RPawn); // shields king from facing
    board.set([5, 0], Piece.BRook); // will check if pawn moves off col 4
    // Actually let's use a direct scenario: rook pins a piece
    const board2 = emptyBoard();
    board2.set([9, 4], Piece.RKing);
    board2.set([0, 3], Piece.BKing);
    board2.set([5, 4], Piece.RAdvisor); // on same col as king
    board2.set([0, 4], Piece.BRook); // attacks along col 4
    // Moving advisor off col 4 exposes king to rook
    const move2 = { from: [5, 4] as Position, to: [4, 3] as Position, piece: Piece.RAdvisor };
    // This isn't a valid advisor move anyway. Let's use rook pin on rook.
    const board3 = emptyBoard();
    board3.set([9, 4], Piece.RKing);
    board3.set([0, 3], Piece.BKing);
    board3.set([7, 4], Piece.RRook); // on same col as king
    board3.set([0, 4], Piece.BRook); // attacks along col 4
    // Moving red rook off col 4 exposes king
    const move3 = { from: [7, 4] as Position, to: [7, 5] as Position, piece: Piece.RRook };
    assert.ok(!ChessRules.isLegalMove(board3, move3, 'red'));
  });

  it('accepts valid legal move', () => {
    const board = emptyBoard();
    board.set([9, 4], Piece.RKing);
    board.set([0, 4], Piece.BKing);
    board.set([5, 4], Piece.RPawn); // prevents kings facing
    board.set([4, 4], Piece.RRook);
    const move = { from: [4, 4] as Position, to: [4, 5] as Position, piece: Piece.RRook };
    assert.ok(ChessRules.isLegalMove(board, move, 'red'));
  });
});
