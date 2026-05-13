import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moveToNotation, notationToMove } from '../../src/chess/chinese/notation.js';
import { ChessBoard } from '../../src/chess/chinese/board.js';
import { Piece } from '../../src/chess/shared/types.js';

describe('Notation', () => {
  describe('moveToNotation', () => {
    it('converts cannon horizontal move (炮二平五)', () => {
      const board = new ChessBoard();
      const notation = moveToNotation(board, { from: [7, 7], to: [7, 4], piece: Piece.RCannon }, 'red');
      assert.equal(notation, '炮二平五');
    });

    it('converts knight advance (馬八進七)', () => {
      const board = new ChessBoard();
      const notation = moveToNotation(board, { from: [9, 1], to: [7, 2], piece: Piece.RKnight }, 'red');
      assert.equal(notation, '馬八進七');
    });

    it('converts black pawn advance (卒7进1)', () => {
      const board = new ChessBoard();
      const notation = moveToNotation(board, { from: [3, 6], to: [4, 6], piece: Piece.BPawn }, 'black');
      assert.equal(notation, '卒7进1');
    });

    it('converts rook retreat (車一退二)', () => {
      const board = new ChessBoard();
      board.set([7, 8], Piece.RRook);
      const notation = moveToNotation(board, { from: [7, 8], to: [9, 8], piece: Piece.RRook }, 'red');
      assert.equal(notation, '車一退二');
    });

    it('handles duplicate pieces with front/back prefix', () => {
      const board = new ChessBoard();
      board.set([5, 2], Piece.RKnight);
      board.set([7, 2], Piece.RKnight);
      const notation = moveToNotation(board, { from: [5, 2], to: [3, 3], piece: Piece.RKnight }, 'red');
      assert.ok(notation.startsWith('前'));
    });
  });

  describe('notationToMove', () => {
    it('parses 炮二平五', () => {
      const board = new ChessBoard();
      const move = notationToMove(board, '炮二平五', 'red');
      assert.ok(move !== null);
      assert.deepEqual(move!.from, [7, 7]);
      assert.deepEqual(move!.to, [7, 4]);
    });

    it('parses 马8进7', () => {
      const board = new ChessBoard();
      const move = notationToMove(board, '马8进7', 'black');
      assert.ok(move !== null);
      assert.deepEqual(move!.from, [0, 7]);
      assert.deepEqual(move!.to, [2, 6]);
    });

    it('returns null for invalid notation', () => {
      const board = new ChessBoard();
      const move = notationToMove(board, '无效走法', 'red');
      assert.equal(move, null);
    });
  });
});
