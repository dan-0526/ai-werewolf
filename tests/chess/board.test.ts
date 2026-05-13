import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChessBoard } from '../../src/chess/chinese/board.js';
import { Piece } from '../../src/chess/shared/types.js';

describe('ChessBoard', () => {
  it('initializes with standard starting position', () => {
    const board = new ChessBoard();
    assert.equal(board.get([9, 0]), Piece.RRook);
    assert.equal(board.get([0, 0]), Piece.BRook);
    assert.equal(board.get([7, 1]), Piece.RCannon);
    assert.equal(board.get([5, 0]), Piece.Empty);
  });

  it('applies a move correctly', () => {
    const board = new ChessBoard();
    board.applyMove({ from: [7, 7], to: [7, 4], piece: Piece.RCannon });
    assert.equal(board.get([7, 7]), Piece.Empty);
    assert.equal(board.get([7, 4]), Piece.RCannon);
  });

  it('detects captures', () => {
    const board = new ChessBoard();
    board.set([4, 4], Piece.RRook);
    board.set([0, 4], Piece.BKing);
    const move = board.applyMove({ from: [4, 4], to: [0, 4], piece: Piece.RRook, captured: Piece.BKing });
    assert.equal(board.get([0, 4]), Piece.RRook);
  });

  it('returns all pieces for a side', () => {
    const board = new ChessBoard();
    const redPieces = board.getPieces('red');
    assert.equal(redPieces.length, 16);
    const blackPieces = board.getPieces('black');
    assert.equal(blackPieces.length, 16);
  });

  it('finds king position', () => {
    const board = new ChessBoard();
    assert.deepEqual(board.findKing('red'), [9, 4]);
    assert.deepEqual(board.findKing('black'), [0, 4]);
  });

  it('serializes to text description', () => {
    const board = new ChessBoard();
    const text = board.toText();
    assert.ok(text.includes('車'));
    assert.ok(text.includes('帥'));
  });
});
