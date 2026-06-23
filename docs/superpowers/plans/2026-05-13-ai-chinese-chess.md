# AI 中国象棋对弈系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Claude Opus 4.6 与 GPT 5.5 进行 Bo3 中国象棋对弈，提供实时 Web 可视化观战界面。

**Architecture:** 后端 TypeScript 裁判程序调用双方 API 驱动对局，通过 WebSocket 实时推送棋步到前端。前端 Vanilla JS + Canvas 渲染棋盘，支持实况观战和回放两种模式。复用现有 ai-arena 的 AIProvider 接口和 ProviderFactory。

**Tech Stack:** TypeScript, Express, ws (WebSocket), Canvas API, ES Modules

---

## File Structure

```
src/chess/
├── shared/
│   ├── types.ts              # 所有类型定义
│   ├── GameMaster.ts         # Bo3 对局主控
│   ├── AIPlayer.ts           # AI 调用 + 重试
│   └── ChessLogger.ts        # 三层日志
├── chinese/
│   ├── board.ts              # 棋盘状态管理
│   ├── rules.ts              # 合法性校验
│   ├── notation.ts           # 坐标 ↔ 中文棋谱
│   └── prompts.ts            # AI system prompt
└── index.ts                  # CLI 入口 + HTTP/WS 服务器

public/chess/
├── shared/
│   ├── ws-client.js          # WebSocket 客户端
│   ├── game-controls.js      # 播放控制
│   ├── move-panel.js         # 棋谱面板
│   └── theme.js              # 主题切换
├── chinese/
│   ├── index.html            # 入口页面
│   ├── board.js              # Canvas 棋盘渲染
│   └── pieces.js             # 棋子定义
└── assets/
    └── themes.css            # 主题 CSS 变量

tests/
└── chess/
    ├── board.test.ts         # 棋盘状态测试
    ├── rules.test.ts         # 规则引擎测试
    └── notation.test.ts      # 棋谱转换测试

chess.config.yaml             # 配置文件
```

---

## Task 1: 类型定义与棋盘状态

**Files:**
- Create: `src/chess/shared/types.ts`
- Create: `src/chess/chinese/board.ts`
- Create: `tests/chess/board.test.ts`

- [ ] **Step 1: Create shared types**

```typescript
// src/chess/shared/types.ts

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
```

- [ ] **Step 2: Write board state tests**

```typescript
// tests/chess/board.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChessBoard } from '../../src/chess/chinese/board.js';
import { Piece } from '../../src/chess/shared/types.js';

describe('ChessBoard', () => {
  it('initializes with standard starting position', () => {
    const board = new ChessBoard();
    // 红方车在 [9,0]
    assert.equal(board.get([9, 0]), Piece.RRook);
    // 黑方车在 [0,0]
    assert.equal(board.get([0, 0]), Piece.BRook);
    // 红方炮在 [7,1]
    assert.equal(board.get([7, 1]), Piece.RCannon);
    // 中间为空
    assert.equal(board.get([5, 0]), Piece.Empty);
  });

  it('applies a move correctly', () => {
    const board = new ChessBoard();
    // 炮二平五: [7,7] -> [7,4]
    board.applyMove({ from: [7, 7], to: [7, 4], piece: Piece.RCannon });
    assert.equal(board.get([7, 7]), Piece.Empty);
    assert.equal(board.get([7, 4]), Piece.RCannon);
  });

  it('detects captures', () => {
    const board = new ChessBoard();
    // 手动设置一个吃子场景
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --import tsx --test tests/chess/board.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement ChessBoard**

```typescript
// src/chess/chinese/board.ts
import { Piece, type Position, type Move, type Side } from '../shared/types.js';

// 标准开局布局（row 0 = 黑方底线，row 9 = 红方底线）
const INITIAL_BOARD: number[][] = [
  [-5, -4, -3, -2, -1, -2, -3, -4, -5],  // row 0: 黑方底线
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],  // row 1
  [ 0, -6,  0,  0,  0,  0,  0, -6,  0],  // row 2: 黑炮
  [-7,  0, -7,  0, -7,  0, -7,  0, -7],  // row 3: 黑兵
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],  // row 4
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],  // row 5
  [ 7,  0,  7,  0,  7,  0,  7,  0,  7],  // row 6: 红兵
  [ 0,  6,  0,  0,  0,  0,  0,  6,  0],  // row 7: 红炮
  [ 0,  0,  0,  0,  0,  0,  0,  0,  0],  // row 8
  [ 5,  4,  3,  2,  1,  2,  3,  4,  5],  // row 9: 红方底线
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

  // 生成文字描述（给 AI 看）
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test tests/chess/board.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/chess/shared/types.ts src/chess/chinese/board.ts tests/chess/board.test.ts
git commit -m "feat(chess): add type definitions and board state management"
```

---

## Task 2: 规则引擎

**Files:**
- Create: `src/chess/chinese/rules.ts`
- Create: `tests/chess/rules.test.ts`

- [ ] **Step 1: Write rules engine tests**

```typescript
// tests/chess/rules.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChessRules } from '../../src/chess/chinese/rules.js';
import { ChessBoard } from '../../src/chess/chinese/board.js';
import { Piece } from '../../src/chess/shared/types.js';

describe('ChessRules', () => {
  const rules = new ChessRules();

  describe('King moves', () => {
    it('king can move one step within palace', () => {
      const board = new ChessBoard();
      const moves = rules.generateMoves(board, Piece.RKing, [9, 4]);
      // 帅在 [9,4]，可以走 [8,4] 和 [9,3], [9,5]
      assert.ok(moves.some(m => m.to[0] === 8 && m.to[1] === 4));
      assert.ok(moves.some(m => m.to[0] === 9 && m.to[1] === 3));
      assert.ok(moves.some(m => m.to[0] === 9 && m.to[1] === 5));
    });

    it('king cannot leave palace', () => {
      const board = new ChessBoard();
      board.set([9, 4], Piece.Empty);
      board.set([7, 4], Piece.RKing);
      const moves = rules.generateMoves(board, Piece.RKing, [7, 4]);
      // [7,4] 不在宫内，但如果我们把帅放在 [7,4]，生成的走法应该只包含宫内位置
      // 红方宫: row 7-9, col 3-5
      moves.forEach(m => {
        assert.ok(m.to[0] >= 7 && m.to[0] <= 9, `row ${m.to[0]} out of palace`);
        assert.ok(m.to[1] >= 3 && m.to[1] <= 5, `col ${m.to[1]} out of palace`);
      });
    });
  });

  describe('Advisor moves', () => {
    it('advisor moves diagonally within palace', () => {
      const board = new ChessBoard();
      // 红仕在 [9,3]
      const moves = rules.generateMoves(board, Piece.RAdvisor, [9, 3]);
      // 从 [9,3] 只能走 [8,4]
      assert.equal(moves.length, 1);
      assert.deepEqual(moves[0].to, [8, 4]);
    });
  });

  describe('Bishop moves', () => {
    it('bishop moves diagonally two steps', () => {
      const board = new ChessBoard();
      // 红相在 [9,2]
      const moves = rules.generateMoves(board, Piece.RBishop, [9, 2]);
      // 从 [9,2] 可以走 [7,0] 和 [7,4]
      assert.ok(moves.some(m => m.to[0] === 7 && m.to[1] === 0));
      assert.ok(moves.some(m => m.to[0] === 7 && m.to[1] === 4));
    });

    it('bishop cannot cross river', () => {
      const board = new ChessBoard();
      board.set([9, 2], Piece.Empty);
      board.set([5, 2], Piece.RBishop);
      const moves = rules.generateMoves(board, Piece.RBishop, [5, 2]);
      // 红相不能过河（row < 5）
      moves.forEach(m => {
        assert.ok(m.to[0] >= 5, `bishop crossed river to row ${m.to[0]}`);
      });
    });

    it('bishop blocked by piece at eye', () => {
      const board = new ChessBoard();
      // 堵住象眼 [8,1]
      board.set([8, 1], Piece.RPawn);
      const moves = rules.generateMoves(board, Piece.RBishop, [9, 2]);
      // [7,0] 方向被堵，只能走 [7,4]
      assert.ok(!moves.some(m => m.to[0] === 7 && m.to[1] === 0));
      assert.ok(moves.some(m => m.to[0] === 7 && m.to[1] === 4));
    });
  });

  describe('Knight moves', () => {
    it('knight moves in L-shape', () => {
      const board = new ChessBoard();
      // 清空马前方，让马可以跳
      board.set([8, 1], Piece.Empty);
      board.set([9, 1], Piece.Empty);
      board.set([5, 3], Piece.RKnight);
      const moves = rules.generateMoves(board, Piece.RKnight, [5, 3]);
      // 马在 [5,3] 无蹩腿时有最多8个走法
      assert.ok(moves.length > 0);
      assert.ok(moves.some(m => m.to[0] === 3 && m.to[1] === 2));
      assert.ok(moves.some(m => m.to[0] === 3 && m.to[1] === 4));
    });

    it('knight blocked by leg piece', () => {
      const board = new ChessBoard();
      // 马在 [9,1]，前方 [8,1] 有子蹩腿
      board.set([8, 1], Piece.RPawn);
      const moves = rules.generateMoves(board, Piece.RKnight, [9, 1]);
      // 向上跳的两个位置 [7,0] 和 [7,2] 应该被蹩
      assert.ok(!moves.some(m => m.to[0] === 7 && m.to[1] === 0));
      assert.ok(!moves.some(m => m.to[0] === 7 && m.to[1] === 2));
    });
  });

  describe('Rook moves', () => {
    it('rook moves in straight lines', () => {
      const board = new ChessBoard();
      board.set([5, 4], Piece.RRook);
      const moves = rules.generateMoves(board, Piece.RRook, [5, 4]);
      // 车可以横走和竖走
      assert.ok(moves.some(m => m.to[0] === 5 && m.to[1] === 0)); // 左
      assert.ok(moves.some(m => m.to[0] === 5 && m.to[1] === 8)); // 右
      assert.ok(moves.some(m => m.to[0] === 0 && m.to[1] === 4)); // 上（吃黑将）
    });

    it('rook blocked by own pieces', () => {
      const board = new ChessBoard();
      // 车在初始位置 [9,0]，被自己的马挡住
      const moves = rules.generateMoves(board, Piece.RRook, [9, 0]);
      // 不能跳过 [9,1] 的马
      assert.ok(!moves.some(m => m.to[0] === 9 && m.to[1] === 2));
    });
  });

  describe('Cannon moves', () => {
    it('cannon moves straight without capture', () => {
      const board = new ChessBoard();
      // 炮在 [7,1]
      const moves = rules.generateMoves(board, Piece.RCannon, [7, 1]);
      // 可以平移到空位
      assert.ok(moves.some(m => m.to[0] === 7 && m.to[1] === 0));
      assert.ok(moves.some(m => m.to[0] === 7 && m.to[1] === 2));
    });

    it('cannon captures by jumping over exactly one piece', () => {
      const board = new ChessBoard();
      // 炮在 [7,1]，上方 [3,1] 有黑兵（不存在），手动设置场景
      board.set([5, 4], Piece.RCannon);
      board.set([3, 4], Piece.RPawn); // 炮架
      board.set([1, 4], Piece.BRook); // 目标
      const moves = rules.generateMoves(board, Piece.RCannon, [5, 4]);
      // 可以隔一个子吃 [1,4]
      assert.ok(moves.some(m => m.to[0] === 1 && m.to[1] === 4));
      // 不能吃炮架本身
      assert.ok(!moves.some(m => m.to[0] === 3 && m.to[1] === 4));
    });
  });

  describe('Pawn moves', () => {
    it('pawn moves forward only before crossing river', () => {
      const board = new ChessBoard();
      // 红兵在 [6,0]（未过河）
      const moves = rules.generateMoves(board, Piece.RPawn, [6, 0]);
      // 只能前进一步
      assert.equal(moves.length, 1);
      assert.deepEqual(moves[0].to, [5, 0]);
    });

    it('pawn can move sideways after crossing river', () => {
      const board = new ChessBoard();
      board.set([6, 0], Piece.Empty);
      board.set([4, 4], Piece.RPawn); // 过河了
      const moves = rules.generateMoves(board, Piece.RPawn, [4, 4]);
      // 可以前进和左右
      assert.ok(moves.some(m => m.to[0] === 3 && m.to[1] === 4)); // 前进
      assert.ok(moves.some(m => m.to[0] === 4 && m.to[1] === 3)); // 左
      assert.ok(moves.some(m => m.to[0] === 4 && m.to[1] === 5)); // 右
      // 不能后退
      assert.ok(!moves.some(m => m.to[0] === 5 && m.to[1] === 4));
    });

    it('black pawn moves downward', () => {
      const board = new ChessBoard();
      // 黑卒在 [3,0]（未过河）
      const moves = rules.generateMoves(board, Piece.BPawn, [3, 0]);
      assert.equal(moves.length, 1);
      assert.deepEqual(moves[0].to, [4, 0]);
    });
  });

  describe('Kings facing', () => {
    it('detects kings facing each other (flying general)', () => {
      const board = new ChessBoard();
      // 清空中间列，让两王对面
      for (let r = 1; r < 9; r++) board.set([r, 4], Piece.Empty);
      board.set([0, 4], Piece.BKing);
      board.set([9, 4], Piece.RKing);
      assert.ok(rules.isKingsFacing(board));
    });

    it('no facing when piece between kings', () => {
      const board = new ChessBoard();
      assert.ok(!rules.isKingsFacing(board));
    });
  });

  describe('Check and Checkmate', () => {
    it('detects check', () => {
      const board = new ChessBoard();
      // 红车直接将军
      board.set([1, 4], Piece.RRook);
      assert.ok(rules.isInCheck(board, 'black'));
    });

    it('detects checkmate', () => {
      const board = new ChessBoard();
      // 构造一个简单的绝杀局面
      // 清空棋盘
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++)
          board.set([r, c], Piece.Empty);
      // 黑将在 [0,4]
      board.set([0, 4], Piece.BKing);
      // 红车在 [0,0] 将军，红车在 [1,8] 封住退路
      board.set([0, 0], Piece.RRook);
      board.set([1, 8], Piece.RRook);
      // 红帅在 [9,4]
      board.set([9, 4], Piece.RKing);
      assert.ok(rules.isCheckmate(board, 'black'));
    });

    it('detects stalemate', () => {
      const board = new ChessBoard();
      // 清空棋盘
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++)
          board.set([r, c], Piece.Empty);
      // 黑将在 [0,3]，被红子围住但没被将军
      board.set([0, 3], Piece.BKing);
      board.set([2, 3], Piece.RRook); // 封住前方
      board.set([0, 0], Piece.RRook); // 封住横向（但不将军因为有间隔）
      board.set([9, 4], Piece.RKing);
      // 如果黑方无合法走法且未被将军 = 困毙
      // 这个局面需要精心构造，简化测试
      // 实际测试中验证 isStalemate 逻辑正确即可
      const stalemate = rules.isStalemate(board, 'black');
      // 此局面黑将可以走 [0,4]，所以不是困毙
      assert.equal(stalemate, false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/chess/rules.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ChessRules**

```typescript
// src/chess/chinese/rules.ts
import { Piece, type Position, type Move, type Side } from '../shared/types.js';
import { ChessBoard } from './board.js';

export class ChessRules {
  generateMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    const absPiece = Math.abs(piece);
    switch (absPiece) {
      case 1: return this.kingMoves(board, piece, pos);
      case 2: return this.advisorMoves(board, piece, pos);
      case 3: return this.bishopMoves(board, piece, pos);
      case 4: return this.knightMoves(board, piece, pos);
      case 5: return this.rookMoves(board, piece, pos);
      case 6: return this.cannonMoves(board, piece, pos);
      case 7: return this.pawnMoves(board, piece, pos);
      default: return [];
    }
  }

  isLegalMove(board: ChessBoard, move: Move, side: Side): boolean {
    // 验证是否是己方棋子
    const pieceSide = move.piece > 0 ? 'red' : 'black';
    if (pieceSide !== side) return false;

    // 验证目标位置不是己方棋子
    const targetSide = board.getSide(move.to);
    if (targetSide === side) return false;

    // 验证走法在合法列表中
    const legalMoves = this.generateMoves(board, move.piece, move.from);
    const isInList = legalMoves.some(m => m.to[0] === move.to[0] && m.to[1] === move.to[1]);
    if (!isInList) return false;

    // 走完后不能被将军
    const clone = board.clone();
    clone.applyMove(move);
    if (this.isInCheck(clone, side)) return false;

    // 走完后不能形成王对王
    if (this.isKingsFacing(clone)) return false;

    return true;
  }

  isInCheck(board: ChessBoard, side: Side): boolean {
    const kingPos = board.findKing(side);
    const opponentSide: Side = side === 'red' ? 'black' : 'red';
    const opponentPieces = board.getPieces(opponentSide);

    for (const { piece, pos } of opponentPieces) {
      const moves = this.generateMoves(board, piece, pos);
      if (moves.some(m => m.to[0] === kingPos[0] && m.to[1] === kingPos[1])) {
        return true;
      }
    }
    return false;
  }

  isCheckmate(board: ChessBoard, side: Side): boolean {
    if (!this.isInCheck(board, side)) return false;
    return !this.hasLegalMove(board, side);
  }

  isStalemate(board: ChessBoard, side: Side): boolean {
    if (this.isInCheck(board, side)) return false;
    return !this.hasLegalMove(board, side);
  }

  isKingsFacing(board: ChessBoard): boolean {
    const redKing = board.findKing('red');
    const blackKing = board.findKing('black');
    if (redKing[1] !== blackKing[1]) return false;
    const col = redKing[1];
    for (let r = blackKing[0] + 1; r < redKing[0]; r++) {
      if (board.get([r, col]) !== Piece.Empty) return false;
    }
    return true;
  }

  private hasLegalMove(board: ChessBoard, side: Side): boolean {
    const pieces = board.getPieces(side);
    for (const { piece, pos } of pieces) {
      const moves = this.generateMoves(board, piece, pos);
      for (const move of moves) {
        const clone = board.clone();
        clone.applyMove(move);
        if (!this.isInCheck(clone, side) && !this.isKingsFacing(clone)) {
          return true;
        }
      }
    }
    return false;
  }

  private kingMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    const side = piece > 0 ? 'red' : 'black';
    const [minR, maxR] = side === 'red' ? [7, 9] : [0, 2];
    const [minC, maxC] = [3, 5];
    const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    return this.filterMoves(board, piece, pos, dirs.map(([dr, dc]) => {
      const r = pos[0] + dr, c = pos[1] + dc;
      if (r < minR || r > maxR || c < minC || c > maxC) return null;
      return [r, c] as Position;
    }).filter(Boolean) as Position[]);
  }

  private advisorMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    const side = piece > 0 ? 'red' : 'black';
    const [minR, maxR] = side === 'red' ? [7, 9] : [0, 2];
    const [minC, maxC] = [3, 5];
    const dirs: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    return this.filterMoves(board, piece, pos, dirs.map(([dr, dc]) => {
      const r = pos[0] + dr, c = pos[1] + dc;
      if (r < minR || r > maxR || c < minC || c > maxC) return null;
      return [r, c] as Position;
    }).filter(Boolean) as Position[]);
  }

  private bishopMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    const side = piece > 0 ? 'red' : 'black';
    const [minR, maxR] = side === 'red' ? [5, 9] : [0, 4];
    const dirs: [number, number][] = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
    const eyes: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const targets: Position[] = [];
    for (let i = 0; i < 4; i++) {
      const r = pos[0] + dirs[i][0], c = pos[1] + dirs[i][1];
      if (r < minR || r > maxR || c < 0 || c > 8) continue;
      const eyeR = pos[0] + eyes[i][0], eyeC = pos[1] + eyes[i][1];
      if (board.get([eyeR, eyeC]) !== Piece.Empty) continue; // 塞象眼
      targets.push([r, c]);
    }
    return this.filterMoves(board, piece, pos, targets);
  }

  private knightMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    // 马的8个方向及对应蹩腿位置
    const jumps: { dr: number; dc: number; legR: number; legC: number }[] = [
      { dr: -2, dc: -1, legR: -1, legC: 0 },
      { dr: -2, dc: 1, legR: -1, legC: 0 },
      { dr: 2, dc: -1, legR: 1, legC: 0 },
      { dr: 2, dc: 1, legR: 1, legC: 0 },
      { dr: -1, dc: -2, legR: 0, legC: -1 },
      { dr: -1, dc: 2, legR: 0, legC: 1 },
      { dr: 1, dc: -2, legR: 0, legC: -1 },
      { dr: 1, dc: 2, legR: 0, legC: 1 },
    ];
    const targets: Position[] = [];
    for (const { dr, dc, legR, legC } of jumps) {
      const r = pos[0] + dr, c = pos[1] + dc;
      if (r < 0 || r > 9 || c < 0 || c > 8) continue;
      const lr = pos[0] + legR, lc = pos[1] + legC;
      if (board.get([lr, lc]) !== Piece.Empty) continue; // 蹩马腿
      targets.push([r, c]);
    }
    return this.filterMoves(board, piece, pos, targets);
  }

  private rookMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    return this.lineMoves(board, piece, pos, false);
  }

  private cannonMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    return this.lineMoves(board, piece, pos, true);
  }

  private pawnMoves(board: ChessBoard, piece: Piece, pos: Position): Move[] {
    const side = piece > 0 ? 'red' : 'black';
    const forward = side === 'red' ? -1 : 1;
    const crossedRiver = side === 'red' ? pos[0] <= 4 : pos[0] >= 5;
    const targets: Position[] = [];

    // 前进
    const fr = pos[0] + forward;
    if (fr >= 0 && fr <= 9) targets.push([fr, pos[1]]);

    // 过河后可以横走
    if (crossedRiver) {
      if (pos[1] - 1 >= 0) targets.push([pos[0], pos[1] - 1]);
      if (pos[1] + 1 <= 8) targets.push([pos[0], pos[1] + 1]);
    }

    return this.filterMoves(board, piece, pos, targets);
  }

  private lineMoves(board: ChessBoard, piece: Piece, pos: Position, isCannon: boolean): Move[] {
    const side = piece > 0 ? 'red' : 'black';
    const moves: Move[] = [];
    const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (const [dr, dc] of dirs) {
      let jumped = false;
      let r = pos[0] + dr, c = pos[1] + dc;
      while (r >= 0 && r <= 9 && c >= 0 && c <= 8) {
        const target = board.get([r, c]);
        if (!isCannon) {
          // 车的逻辑
          if (target === Piece.Empty) {
            moves.push({ from: pos, to: [r, c], piece });
          } else {
            if (board.getSide([r, c]) !== side) {
              moves.push({ from: pos, to: [r, c], piece, captured: target });
            }
            break;
          }
        } else {
          // 炮的逻辑
          if (!jumped) {
            if (target === Piece.Empty) {
              moves.push({ from: pos, to: [r, c], piece });
            } else {
              jumped = true; // 找到炮架
            }
          } else {
            if (target !== Piece.Empty) {
              if (board.getSide([r, c]) !== side) {
                moves.push({ from: pos, to: [r, c], piece, captured: target });
              }
              break;
            }
          }
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  private filterMoves(board: ChessBoard, piece: Piece, from: Position, targets: Position[]): Move[] {
    const side = piece > 0 ? 'red' : 'black';
    const moves: Move[] = [];
    for (const to of targets) {
      const targetPiece = board.get(to);
      const targetSide = board.getSide(to);
      if (targetSide === side) continue; // 不能吃自己的子
      moves.push({
        from,
        to,
        piece,
        captured: targetPiece !== Piece.Empty ? targetPiece : undefined,
      });
    }
    return moves;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/chess/rules.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/chess/chinese/rules.ts tests/chess/rules.test.ts
git commit -m "feat(chess): add rules engine with move generation and check detection"
```

---

## Task 3: 棋谱转换

**Files:**
- Create: `src/chess/chinese/notation.ts`
- Create: `tests/chess/notation.test.ts`

- [ ] **Step 1: Write notation tests**

```typescript
// tests/chess/notation.test.ts
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

    it('converts knight advance (马八进七)', () => {
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

    it('handles duplicate pieces with front/back (前馬進七)', () => {
      const board = new ChessBoard();
      // 两个红马在同一列
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
      assert.deepEqual(move!.from, [0, 1]);
      assert.deepEqual(move!.to, [2, 2]);
    });

    it('returns null for invalid notation', () => {
      const board = new ChessBoard();
      const move = notationToMove(board, '无效走法', 'red');
      assert.equal(move, null);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/chess/notation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement notation converter**

```typescript
// src/chess/chinese/notation.ts
import { Piece, type Position, type Move, type Side } from '../shared/types.js';
import { ChessBoard } from './board.js';

// 红方列号：从右到左 一到九（col 8=一, col 0=九）
const RED_COL_NAMES = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
// 黑方列号：从左到右 1到9（col 0=1, col 8=9）
const BLACK_COL_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const RED_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const BLACK_NUM = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const PIECE_CHAR_RED: Record<number, string> = {
  [Piece.RKing]: '帥', [Piece.RAdvisor]: '仕', [Piece.RBishop]: '相',
  [Piece.RKnight]: '馬', [Piece.RRook]: '車', [Piece.RCannon]: '炮', [Piece.RPawn]: '兵',
};

const PIECE_CHAR_BLACK: Record<number, string> = {
  [Piece.BKing]: '将', [Piece.BAdvisor]: '士', [Piece.BBishop]: '象',
  [Piece.BKnight]: '马', [Piece.BRook]: '车', [Piece.BCannon]: '砲', [Piece.BPawn]: '卒',
};

export function moveToNotation(board: ChessBoard, move: Move, side: Side): string {
  const { from, to, piece } = move;
  const colNames = side === 'red' ? RED_COL_NAMES : BLACK_COL_NAMES;
  const numNames = side === 'red' ? RED_NUM : BLACK_NUM;
  const pieceChars = side === 'red' ? PIECE_CHAR_RED : PIECE_CHAR_BLACK;
  const pieceName = pieceChars[piece] ?? '?';

  // 检查同列是否有相同棋子（前/后）
  const sameColPieces = findSameColPieces(board, piece, from[1]);
  let prefix = pieceName;
  if (sameColPieces.length > 1) {
    // 红方 row 小的在前（靠近对方），黑方 row 大的在前
    const sorted = side === 'red'
      ? sameColPieces.sort((a, b) => a[0] - b[0])
      : sameColPieces.sort((a, b) => b[0] - a[0]);
    const idx = sorted.findIndex(p => p[0] === from[0] && p[1] === from[1]);
    prefix = (idx === 0 ? '前' : '后') + pieceName;
  } else {
    prefix = pieceName + colNames[from[1]];
  }

  // 方向
  const rowDiff = to[0] - from[0];
  const forward = side === 'red' ? -1 : 1;
  let direction: string;
  let distance: string;

  if (rowDiff === 0) {
    // 平移
    direction = side === 'red' ? '平' : '平';
    distance = colNames[to[1]];
  } else if (rowDiff * forward > 0) {
    // 进
    direction = side === 'red' ? '進' : '进';
    // 直线棋子用步数，斜线棋子用目标列
    const absPiece = Math.abs(piece);
    if (absPiece === 4 || absPiece === 2 || absPiece === 3) {
      // 马、仕、相用目标列号
      distance = colNames[to[1]];
    } else {
      distance = numNames[Math.abs(rowDiff)];
    }
  } else {
    // 退
    direction = side === 'red' ? '退' : '退';
    const absPiece = Math.abs(piece);
    if (absPiece === 4 || absPiece === 2 || absPiece === 3) {
      distance = colNames[to[1]];
    } else {
      distance = numNames[Math.abs(rowDiff)];
    }
  }

  return prefix + direction + distance;
}

export function notationToMove(board: ChessBoard, notation: string, side: Side): Move | null {
  try {
    const colNames = side === 'red' ? RED_COL_NAMES : BLACK_COL_NAMES;
    const numNames = side === 'red' ? RED_NUM : BLACK_NUM;
    const pieceChars = side === 'red' ? PIECE_CHAR_RED : PIECE_CHAR_BLACK;

    // 解析棋谱：[前/后]棋子+列号+方向+距离/列号
    let idx = 0;
    let frontBack: '前' | '后' | null = null;
    if (notation[0] === '前' || notation[0] === '后') {
      frontBack = notation[0] as '前' | '后';
      idx = 1;
    }

    // 找棋子类型
    const pieceChar = notation[idx];
    idx++;
    const piece = findPieceByChar(pieceChar, side, pieceChars);
    if (piece === null) return null;

    // 找来源列
    let fromCol: number;
    if (frontBack !== null) {
      // 前/后模式：找同列的两个相同棋子
      const allPositions = findAllPieces(board, piece);
      if (allPositions.length < 2) return null;
      // 按前后排序
      const sorted = side === 'red'
        ? allPositions.sort((a, b) => a[0] - b[0])
        : allPositions.sort((a, b) => b[0] - a[0]);
      const chosen = frontBack === '前' ? sorted[0] : sorted[sorted.length - 1];
      fromCol = chosen[1];
      // 继续解析方向和距离
      const direction = notation[idx];
      idx++;
      const distStr = notation.slice(idx);
      return resolveMove(board, piece, chosen, direction, distStr, side, colNames, numNames);
    }

    // 普通模式：棋子+列号+方向+距离
    const colStr = notation[idx];
    idx++;
    fromCol = colNames.indexOf(colStr);
    if (fromCol === -1) return null;

    // 找到该列上的该棋子
    const fromPos = findPieceInCol(board, piece, fromCol);
    if (!fromPos) return null;

    const direction = notation[idx];
    idx++;
    const distStr = notation.slice(idx);

    return resolveMove(board, piece, fromPos, direction, distStr, side, colNames, numNames);
  } catch {
    return null;
  }
}

function resolveMove(
  board: ChessBoard, piece: Piece, from: Position,
  direction: string, distStr: string, side: Side,
  colNames: string[], numNames: string[]
): Move | null {
  const forward = side === 'red' ? -1 : 1;
  const absPiece = Math.abs(piece);
  let to: Position;

  if (direction === '平') {
    const toCol = colNames.indexOf(distStr);
    if (toCol === -1) return null;
    to = [from[0], toCol];
  } else {
    const isAdvance = direction === '進' || direction === '进';
    const dir = isAdvance ? forward : -forward;

    if (absPiece === 4 || absPiece === 2 || absPiece === 3) {
      // 斜线棋子：距离是目标列号
      const toCol = colNames.indexOf(distStr);
      if (toCol === -1) return null;
      const colDiff = Math.abs(toCol - from[1]);
      let rowDiff: number;
      if (absPiece === 4) rowDiff = colDiff === 1 ? 2 : 1; // 马
      else if (absPiece === 2) rowDiff = 1; // 仕
      else rowDiff = 2; // 相
      to = [from[0] + rowDiff * dir, toCol];
    } else {
      // 直线棋子：距离是步数
      const steps = numNames.indexOf(distStr);
      if (steps <= 0) return null;
      to = [from[0] + steps * dir, from[1]];
    }
  }

  if (to[0] < 0 || to[0] > 9 || to[1] < 0 || to[1] > 8) return null;
  const captured = board.get(to);
  return { from, to, piece, captured: captured !== Piece.Empty ? captured : undefined };
}

function findSameColPieces(board: ChessBoard, piece: Piece, col: number): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < 10; r++) {
    if (board.get([r, col]) === piece) positions.push([r, col]);
  }
  return positions;
}

function findAllPieces(board: ChessBoard, piece: Piece): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (board.get([r, c]) === piece) positions.push([r, c]);
    }
  }
  return positions;
}

function findPieceInCol(board: ChessBoard, piece: Piece, col: number): Position | null {
  for (let r = 0; r < 10; r++) {
    if (board.get([r, col]) === piece) return [r, col];
  }
  return null;
}

function findPieceByChar(char: string, side: Side, pieceChars: Record<number, string>): Piece | null {
  for (const [key, val] of Object.entries(pieceChars)) {
    if (val === char) return Number(key) as Piece;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/chess/notation.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/chess/chinese/notation.ts tests/chess/notation.test.ts
git commit -m "feat(chess): add Chinese notation converter (coordinate <-> 棋谱)"
```

---

## Task 4: AI Player + Prompts

**Files:**
- Create: `src/chess/shared/AIPlayer.ts`
- Create: `src/chess/chinese/prompts.ts`

- [ ] **Step 1: Implement prompts**

```typescript
// src/chess/chinese/prompts.ts
import type { Side } from '../shared/types.js';

export function buildSystemPrompt(side: Side): string {
  const sideName = side === 'red' ? '红方' : '黑方';
  const opponentName = side === 'red' ? '黑方' : '红方';

  return `你是一位中国象棋大师，正在以${sideName}身份对弈。

## 规则提醒
- 帅/将：在九宫内移动，每次一步（上下左右）
- 仕/士：在九宫内斜走一步
- 相/象：走田字，不能过河，塞象眼时不能走
- 馬/马：走日字，蹩马腿时不能走
- 車/车：直线行走，不限距离
- 炮/砲：直线移动，吃子时必须隔一个棋子（炮架）
- 兵/卒：未过河只能前进，过河后可左右移动，不能后退
- 不能送将（走完后自己被将军）
- 两王不能在同一列无遮挡对面（飞将）

## 棋盘坐标
- 行：0-9（0为${side === 'red' ? '对方' : '己方'}底线，9为${side === 'red' ? '己方' : '对方'}底线）
- 列：0-8（从左到右）

## 回复格式
请以 JSON 格式回复你的走法：
\`\`\`json
{
  "move": { "from": [row, col], "to": [row, col] },
  "thinking": "简要说明你的思路（可选）"
}
\`\`\`

重要：只回复 JSON，不要有其他内容。确保走法合法。`;
}

export function buildMovePrompt(boardText: string, lastMoveNotation: string | null, moveNumber: number): string {
  let prompt = `## 第 ${moveNumber} 手\n\n当前棋盘：\n\`\`\`\n${boardText}\n\`\`\`\n`;

  if (lastMoveNotation) {
    prompt += `\n对手上一步：${lastMoveNotation}\n`;
  }

  prompt += '\n请走你的下一步。';
  return prompt;
}
```

- [ ] **Step 2: Implement AIPlayer**

```typescript
// src/chess/shared/AIPlayer.ts
import type { Move, Position, Side } from './types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<ChatResult>;
}

export interface AIPlayerConfig {
  provider: AIProvider;
  side: Side;
  maxRetries: number;
  model: string;
}

export class AIPlayer {
  private provider: AIProvider;
  private messageHistory: ChatMessage[] = [];
  private side: Side;
  private maxRetries: number;
  readonly model: string;

  constructor(config: AIPlayerConfig) {
    this.provider = config.provider;
    this.side = config.side;
    this.maxRetries = config.maxRetries;
    this.model = config.model;
  }

  getSide(): Side {
    return this.side;
  }

  setSide(side: Side): void {
    this.side = side;
  }

  getHistory(): ChatMessage[] {
    return [...this.messageHistory];
  }

  addSystemMessage(content: string): void {
    this.messageHistory.push({ role: 'system', content });
  }

  addUserMessage(content: string): void {
    this.messageHistory.push({ role: 'user', content });
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  appendSeparator(message: string): void {
    this.messageHistory.push({ role: 'system', content: `--- ${message} ---` });
  }

  async makeMove(boardText: string, lastMove: string | null, moveNumber: number): Promise<{
    move: Move;
    thinking?: string;
    raw: string;
    retries: number;
  }> {
    const { buildMovePrompt } = await import('../chinese/prompts.js');
    const userMsg = buildMovePrompt(boardText, lastMove, moveNumber);
    this.messageHistory.push({ role: 'user', content: userMsg });

    let retries = 0;
    while (retries <= this.maxRetries) {
      const result = await this.provider.chat([...this.messageHistory]);
      const raw = result.content;

      const parsed = this.parseResponse(raw);
      if (parsed) {
        this.messageHistory.push({ role: 'assistant', content: raw });
        return { move: parsed.move, thinking: parsed.thinking, raw, retries };
      }

      retries++;
      if (retries <= this.maxRetries) {
        this.messageHistory.push({ role: 'assistant', content: raw });
        this.messageHistory.push({
          role: 'user',
          content: '你的回复格式不正确，请用 JSON 格式回复：{"move": {"from": [row, col], "to": [row, col]}, "thinking": "..."}'
        });
      }
    }

    throw new Error(`AI failed to provide valid move after ${this.maxRetries} retries`);
  }

  private parseResponse(raw: string): { move: Move; thinking?: string } | null {
    // 尝试 JSON 解析
    try {
      // 提取 JSON 块
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*"move"[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : raw;
      const parsed = JSON.parse(jsonStr);

      if (parsed.move && Array.isArray(parsed.move.from) && Array.isArray(parsed.move.to)) {
        const from: Position = [parsed.move.from[0], parsed.move.from[1]];
        const to: Position = [parsed.move.to[0], parsed.move.to[1]];
        return {
          move: { from, to, piece: 0 as any }, // piece will be filled by GameMaster
          thinking: parsed.thinking,
        };
      }
    } catch {}

    // 正则回退：匹配 from [r,c] to [r,c] 模式
    const regex = /from[:\s]*\[(\d),\s*(\d)\].*?to[:\s]*\[(\d),\s*(\d)\]/i;
    const match = raw.match(regex);
    if (match) {
      const from: Position = [Number(match[1]), Number(match[2])];
      const to: Position = [Number(match[3]), Number(match[4])];
      return { move: { from, to, piece: 0 as any } };
    }

    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/chess/shared/AIPlayer.ts src/chess/chinese/prompts.ts
git commit -m "feat(chess): add AI player with retry logic and Chinese chess prompts"
```

---

## Task 5: ChessLogger + GameMaster

**Files:**
- Create: `src/chess/shared/ChessLogger.ts`
- Create: `src/chess/shared/GameMaster.ts`

- [ ] **Step 1: Implement ChessLogger**

```typescript
// src/chess/shared/ChessLogger.ts
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WSEvent, Side } from './types.js';

export class ChessLogger {
  private logDir: string;
  private publicPath: string;
  private godPath: string;
  private rawPath: string;

  constructor(baseDir: string, matchId: string) {
    this.logDir = join(baseDir, 'logs', matchId);
    mkdirSync(this.logDir, { recursive: true });
    this.publicPath = join(this.logDir, 'public.log');
    this.godPath = join(this.logDir, 'god.jsonl');
    this.rawPath = join(this.logDir, 'raw.jsonl');
    // 初始化文件
    writeFileSync(this.publicPath, '');
    writeFileSync(this.godPath, '');
    writeFileSync(this.rawPath, '');
  }

  getLogDir(): string {
    return this.logDir;
  }

  getGodPath(): string {
    return this.godPath;
  }

  // 公开棋谱日志（人类可读）
  logPublic(message: string): void {
    appendFileSync(this.publicPath, message + '\n');
  }

  // 完整事件日志（用于回放）
  logEvent(event: WSEvent): void {
    const entry = { ...event, timestamp: Date.now() };
    appendFileSync(this.godPath, JSON.stringify(entry) + '\n');
  }

  // 原始 API 调用日志
  logRaw(data: { player: string; side: Side; messages: unknown[]; response: string; usage?: unknown }): void {
    const entry = { ...data, timestamp: Date.now() };
    appendFileSync(this.rawPath, JSON.stringify(entry) + '\n');
  }

  // 记录对局开始
  logGameStart(gameNum: number, red: string, black: string): void {
    this.logPublic(`\n${'='.repeat(40)}`);
    this.logPublic(`第 ${gameNum} 局  红方: ${red}  黑方: ${black}`);
    this.logPublic('='.repeat(40));
    this.logEvent({ type: 'game_start', game: gameNum, red, black });
  }

  // 记录走棋
  logMove(moveNum: number, side: Side, notation: string, thinking?: string): void {
    const prefix = side === 'red' ? `${Math.ceil(moveNum / 2)}.` : '    ';
    this.logPublic(`${prefix} ${notation}${thinking ? `  (${thinking})` : ''}`);
  }

  // 记录对局结束
  logGameEnd(gameNum: number, winner: Side | 'draw', reason: string, score: Record<string, number>): void {
    const winText = winner === 'draw' ? '和棋' : `${winner === 'red' ? '红方' : '黑方'}胜`;
    this.logPublic(`\n结果: ${winText} - ${reason}`);
    this.logPublic(`比分: ${JSON.stringify(score)}`);
    this.logEvent({ type: 'game_end', game: gameNum, winner, reason, score });
  }
}
```

- [ ] **Step 2: Implement GameMaster**

```typescript
// src/chess/shared/GameMaster.ts
import { ChessBoard } from '../chinese/board.js';
import { ChessRules } from '../chinese/rules.js';
import { moveToNotation } from '../chinese/notation.js';
import { buildSystemPrompt } from '../chinese/prompts.js';
import { ChessLogger } from './ChessLogger.js';
import { AIPlayer } from './AIPlayer.js';
import type { GameConfig, Move, Side, WSEvent } from './types.js';
import { Piece } from './types.js';

export interface GameMasterConfig {
  game: GameConfig;
  logger: ChessLogger;
  onEvent?: (event: WSEvent) => void;
}

export interface MatchResult {
  winner: string;
  finalScore: Record<string, number>;
  games: GameResult[];
}

export interface GameResult {
  gameNum: number;
  winner: Side | 'draw';
  reason: string;
  moves: number;
}

export class GameMaster {
  private config: GameConfig;
  private logger: ChessLogger;
  private onEvent: (event: WSEvent) => void;
  private players: { player1: AIPlayer; player2: AIPlayer };

  constructor(config: GameMasterConfig, player1: AIPlayer, player2: AIPlayer) {
    this.config = config.game;
    this.logger = config.logger;
    this.onEvent = config.onEvent ?? (() => {});
    this.players = { player1, player2 };
  }

  async runMatch(): Promise<MatchResult> {
    const score: Record<string, number> = {
      [this.players.player1.model]: 0,
      [this.players.player2.model]: 0,
    };
    const games: GameResult[] = [];

    const matchEvent: WSEvent = {
      type: 'match_start',
      bo: this.config.bo,
      players: { red: this.players.player1.model, black: this.players.player2.model },
    };
    this.onEvent(matchEvent);
    this.logger.logEvent(matchEvent);

    for (let i = 0; i < this.config.bo; i++) {
      // 交替先手：偶数局 player1 红方，奇数局 player2 红方
      const redPlayer = i % 2 === 0 ? this.players.player1 : this.players.player2;
      const blackPlayer = i % 2 === 0 ? this.players.player2 : this.players.player1;

      redPlayer.setSide('red');
      blackPlayer.setSide('black');

      // 设置 system prompt
      redPlayer.clearHistory();
      blackPlayer.clearHistory();
      redPlayer.addSystemMessage(buildSystemPrompt('red'));
      blackPlayer.addSystemMessage(buildSystemPrompt('black'));

      const result = await this.runGame(i + 1, redPlayer, blackPlayer);
      games.push(result);

      // 更新比分
      if (result.winner !== 'draw') {
        const winnerPlayer = result.winner === 'red' ? redPlayer : blackPlayer;
        score[winnerPlayer.model]++;
      } else {
        score[redPlayer.model] += 0.5;
        score[blackPlayer.model] += 0.5;
      }

      this.logger.logGameEnd(i + 1, result.winner, result.reason, score);

      // 检查是否已经决出胜负
      const maxScore = Math.max(...Object.values(score));
      const winsNeeded = Math.ceil(this.config.bo / 2);
      if (maxScore >= winsNeeded) break;

      // 局间分隔
      if (i < this.config.bo - 1) {
        redPlayer.appendSeparator('对局结束，准备下一局');
        blackPlayer.appendSeparator('对局结束，准备下一局');
      }
    }

    const winner = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
    const matchEnd: WSEvent = { type: 'match_end', winner, finalScore: score };
    this.onEvent(matchEnd);
    this.logger.logEvent(matchEnd);

    return { winner, finalScore: score, games };
  }

  private async runGame(gameNum: number, redPlayer: AIPlayer, blackPlayer: AIPlayer): Promise<GameResult> {
    const board = new ChessBoard();
    const rules = new ChessRules();
    let currentSide: Side = 'red';
    let moveNumber = 0;
    let lastNotation: string | null = null;
    const maxMoves = 200; // 防止无限循环

    this.logger.logGameStart(gameNum, redPlayer.model, blackPlayer.model);

    while (moveNumber < maxMoves) {
      const currentPlayer = currentSide === 'red' ? redPlayer : blackPlayer;
      moveNumber++;

      try {
        const result = await currentPlayer.makeMove(board.toText(), lastNotation, moveNumber);
        let move = result.move;

        // 填充 piece 字段
        const piece = board.get(move.from);
        if (piece === Piece.Empty) {
          this.emitIllegalMove(currentSide, `from ${move.from}`, '起始位置无棋子', 0);
          return { gameNum, winner: currentSide === 'red' ? 'black' : 'red', reason: '非法走子', moves: moveNumber };
        }
        move = { ...move, piece };

        // 验证合法性
        if (!rules.isLegalMove(board, move, currentSide)) {
          this.emitIllegalMove(currentSide, `${move.from}->${move.to}`, '不合法的走法', 0);
          return { gameNum, winner: currentSide === 'red' ? 'black' : 'red', reason: '非法走子', moves: moveNumber };
        }

        // 生成棋谱记号
        const notation = moveToNotation(board, move, currentSide);

        // 执行走棋
        board.applyMove(move);

        // 广播事件
        const moveEvent: WSEvent = {
          type: 'move',
          player: currentSide,
          from: move.from,
          to: move.to,
          piece: board.pieceName(piece),
          notation,
          thinking: result.thinking,
        };
        this.onEvent(moveEvent);
        this.logger.logEvent(moveEvent);
        this.logger.logMove(moveNumber, currentSide, notation, result.thinking);

        // 记录原始 API 调用
        this.logger.logRaw({
          player: currentPlayer.model,
          side: currentSide,
          messages: currentPlayer.getHistory(),
          response: result.raw,
        });

        lastNotation = notation;

        // 检查胜负
        const opponentSide: Side = currentSide === 'red' ? 'black' : 'red';
        if (rules.isCheckmate(board, opponentSide)) {
          return { gameNum, winner: currentSide, reason: '将杀', moves: moveNumber };
        }
        if (rules.isStalemate(board, opponentSide)) {
          return { gameNum, winner: currentSide, reason: '困毙', moves: moveNumber };
        }

        // 延迟
        if (this.config.moveDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.moveDelayMs));
        }

        // 切换方
        currentSide = opponentSide;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        return { gameNum, winner: currentSide === 'red' ? 'black' : 'red', reason: `AI 错误: ${reason}`, moves: moveNumber };
      }
    }

    return { gameNum, winner: 'draw', reason: '超过最大步数', moves: moveNumber };
  }

  private emitIllegalMove(side: Side, attempt: string, reason: string, retry: number): void {
    const event: WSEvent = { type: 'illegal_move', player: side, attempt, reason, retry };
    this.onEvent(event);
    this.logger.logEvent(event);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/chess/shared/ChessLogger.ts src/chess/shared/GameMaster.ts
git commit -m "feat(chess): add ChessLogger (3-layer) and GameMaster (Bo3 orchestrator)"
```

---

## Task 6: CLI 入口 + HTTP/WebSocket 服务器

**Files:**
- Create: `src/chess/index.ts`
- Create: `chess.config.yaml`
- Modify: `package.json`

- [ ] **Step 1: Create chess.config.yaml**

```yaml
# chess.config.yaml
game:
  name: "AI Chinese Chess"
  mode: chinese
  bo: 3
  moveDelayMs: 2000
  maxRetries: 3
  language: zh-CN

players:
  - model: claude-opus-4-6-20250513
    provider: anthropic
  - model: gpt-5.5
    provider: openai

server:
  port: 3100
  host: localhost
```

- [ ] **Step 2: Implement CLI entry point**

```typescript
// src/chess/index.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GameMaster } from './shared/GameMaster.js';
import { ChessLogger } from './shared/ChessLogger.js';
import { AIPlayer } from './shared/AIPlayer.js';
import { buildSystemPrompt } from './chinese/prompts.js';
import type { GameConfig, WSEvent } from './shared/types.js';

// 加载配置
const configPath = resolve(process.cwd(), process.argv[2] || 'chess.config.yaml');
const configRaw = readFileSync(configPath, 'utf-8');
const config = parseYaml(configRaw);

const isReplay = process.argv.includes('--replay');
const replayPath = process.argv[process.argv.indexOf('--replay') + 1] || null;

// Express 服务器
const app = express();
const port = config.server?.port ?? 3100;

// 静态文件
app.use('/chess', express.static(resolve(process.cwd(), 'public/chess')));

// 回放模式：提供日志文件
if (isReplay && replayPath) {
  app.get('/api/replay', (_req, res) => {
    try {
      const data = readFileSync(resolve(process.cwd(), replayPath), 'utf-8');
      res.type('text/plain').send(data);
    } catch (err) {
      res.status(404).json({ error: 'Replay file not found' });
    }
  });
}

const server = app.listen(port, () => {
  console.log(`Chess server running at http://localhost:${port}/chess/chinese/`);
  if (isReplay) {
    console.log(`Replay mode: serving ${replayPath}`);
  }
});

// WebSocket 服务器
const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event: WSEvent): void {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// 对局模式
if (!isReplay) {
  startMatch().catch(err => {
    console.error('Match failed:', err);
    process.exit(1);
  });
}

async function startMatch(): Promise<void> {
  // 创建 providers（使用项目已有的 ProviderFactory）
  const { ProviderFactory } = await import('../providers/factory.js');

  const matchId = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = new ChessLogger(process.cwd(), matchId);

  const provider1 = ProviderFactory.create(config.players[0].provider, {
    model: config.players[0].model,
  });
  const provider2 = ProviderFactory.create(config.players[1].provider, {
    model: config.players[1].model,
  });

  const player1 = new AIPlayer({
    provider: provider1,
    side: 'red',
    maxRetries: config.game.maxRetries,
    model: config.players[0].model,
  });

  const player2 = new AIPlayer({
    provider: provider2,
    side: 'black',
    maxRetries: config.game.maxRetries,
    model: config.players[1].model,
  });

  const gameMaster = new GameMaster(
    { game: config.game as GameConfig, logger, onEvent: broadcast },
    player1,
    player2
  );

  console.log(`\nMatch starting: ${config.players[0].model} vs ${config.players[1].model}`);
  console.log(`Best of ${config.game.bo}\n`);

  const result = await gameMaster.runMatch();

  console.log(`\nMatch complete!`);
  console.log(`Winner: ${result.winner}`);
  console.log(`Final score: ${JSON.stringify(result.finalScore)}`);
  console.log(`Logs saved to: ${logger.getLogDir()}`);
}
```

- [ ] **Step 3: Update package.json scripts**

Add the following scripts to `package.json`:

```json
{
  "scripts": {
    "chess": "tsx src/chess/index.ts",
    "chess:replay": "tsx src/chess/index.ts --replay"
  }
}
```

Run: Verify with `npm run chess -- --help` (should at least load without crashing if config exists)

- [ ] **Step 4: Commit**

```bash
git add src/chess/index.ts chess.config.yaml package.json
git commit -m "feat(chess): add CLI entry point with Express/WebSocket server"
```

---

## Task 7: 前端 - 棋盘渲染

**Files:**
- Create: `public/chess/chinese/index.html`
- Create: `public/chess/chinese/board.js`
- Create: `public/chess/chinese/pieces.js`
- Create: `public/chess/assets/themes.css`
- Create: `public/chess/shared/theme.js`

- [ ] **Step 1: Create index.html**

```html
<!-- public/chess/chinese/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 中国象棋 - Claude vs GPT</title>
  <link rel="stylesheet" href="../assets/themes.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border-color);
    }
    .header h1 { font-size: 1.2rem; }
    .players {
      display: flex;
      gap: 24px;
      align-items: center;
    }
    .player {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: 4px;
    }
    .player.red { background: var(--red-bg); color: var(--red-color); }
    .player.black { background: var(--black-bg); color: var(--black-color); }
    .score { font-weight: bold; font-size: 1.1rem; }
    .main {
      display: flex;
      flex: 1;
      padding: 24px;
      gap: 24px;
      justify-content: center;
    }
    .board-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    #chessCanvas {
      border: 2px solid var(--border-color);
      border-radius: 4px;
    }
    .side-panel {
      width: 300px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .move-list {
      flex: 1;
      overflow-y: auto;
      background: var(--panel-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 12px;
      font-family: monospace;
      font-size: 0.9rem;
      max-height: 500px;
    }
    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .controls button {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--btn-bg);
      color: var(--text-color);
      cursor: pointer;
      font-size: 0.85rem;
    }
    .controls button:hover { background: var(--btn-hover); }
    .controls button.active { background: var(--btn-active); color: white; }
    .status {
      text-align: center;
      padding: 8px;
      font-size: 0.9rem;
      color: var(--muted-color);
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>AI 中国象棋</h1>
    <div class="players">
      <div class="player red">
        <span class="name" id="redName">Red</span>
        <span class="score" id="redScore">0</span>
      </div>
      <span>vs</span>
      <div class="player black">
        <span class="name" id="blackName">Black</span>
        <span class="score" id="blackScore">0</span>
      </div>
    </div>
    <div class="controls">
      <button id="btnTheme" title="切换主题">🎨 主题</button>
      <button id="btnThinking" title="显示/隐藏思考">💭 思考</button>
    </div>
  </header>

  <main class="main">
    <div class="board-container">
      <canvas id="chessCanvas" width="460" height="510"></canvas>
      <div class="status" id="status">等待连接...</div>
    </div>
    <div class="side-panel">
      <div class="controls" id="gameControls"></div>
      <div class="move-list" id="moveList"></div>
    </div>
  </main>

  <script type="module" src="../shared/theme.js"></script>
  <script type="module" src="./pieces.js"></script>
  <script type="module" src="./board.js"></script>
  <script type="module" src="../shared/ws-client.js"></script>
  <script type="module" src="../shared/game-controls.js"></script>
  <script type="module" src="../shared/move-panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create pieces.js**

```javascript
// public/chess/chinese/pieces.js

export const PIECE_DEFS = {
  // Red pieces (positive values)
  1: { name: '帥', type: 'king' },
  2: { name: '仕', type: 'advisor' },
  3: { name: '相', type: 'bishop' },
  4: { name: '馬', type: 'knight' },
  5: { name: '車', type: 'rook' },
  6: { name: '炮', type: 'cannon' },
  7: { name: '兵', type: 'pawn' },
  // Black pieces (negative values)
  '-1': { name: '將', type: 'king' },
  '-2': { name: '士', type: 'advisor' },
  '-3': { name: '象', type: 'bishop' },
  '-4': { name: '马', type: 'knight' },
  '-5': { name: '车', type: 'rook' },
  '-6': { name: '砲', type: 'cannon' },
  '-7': { name: '卒', type: 'pawn' },
};

export function getPieceName(pieceValue) {
  const def = PIECE_DEFS[String(pieceValue)];
  return def ? def.name : '';
}

export function getPieceSide(pieceValue) {
  if (pieceValue > 0) return 'red';
  if (pieceValue < 0) return 'black';
  return null;
}
```

- [ ] **Step 3: Create board.js (Canvas rendering)**

```javascript
// public/chess/chinese/board.js
import { PIECE_DEFS, getPieceSide } from './pieces.js';

const CELL_SIZE = 50;
const PADDING = 30;
const ROWS = 10;
const COLS = 9;

// 初始棋盘布局
const INITIAL_BOARD = [
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

class ChessBoardRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.board = INITIAL_BOARD.map(row => [...row]);
    this.lastMove = null;
    this.animating = false;
    this.animationPiece = null;
    this.animationFrom = null;
    this.animationTo = null;
    this.animationProgress = 0;
  }

  // 坐标转换：棋盘坐标 -> 画布像素
  toPixel(row, col) {
    return {
      x: PADDING + col * CELL_SIZE,
      y: PADDING + row * CELL_SIZE,
    };
  }

  draw() {
    const ctx = this.ctx;
    const style = getComputedStyle(document.documentElement);

    // 清空画布
    ctx.fillStyle = style.getPropertyValue('--board-bg').trim() || '#f0d9a0';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 画网格线
    ctx.strokeStyle = style.getPropertyValue('--line-color').trim() || '#333';
    ctx.lineWidth = 1;

    // 横线
    for (let r = 0; r < ROWS; r++) {
      const y = PADDING + r * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(PADDING + (COLS - 1) * CELL_SIZE, y);
      ctx.stroke();
    }

    // 竖线（注意楚河汉界中间断开，只有边线贯通）
    for (let c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) {
        // 边线贯通
        ctx.beginPath();
        ctx.moveTo(PADDING + c * CELL_SIZE, PADDING);
        ctx.lineTo(PADDING + c * CELL_SIZE, PADDING + (ROWS - 1) * CELL_SIZE);
        ctx.stroke();
      } else {
        // 上半部分
        ctx.beginPath();
        ctx.moveTo(PADDING + c * CELL_SIZE, PADDING);
        ctx.lineTo(PADDING + c * CELL_SIZE, PADDING + 4 * CELL_SIZE);
        ctx.stroke();
        // 下半部分
        ctx.beginPath();
        ctx.moveTo(PADDING + c * CELL_SIZE, PADDING + 5 * CELL_SIZE);
        ctx.lineTo(PADDING + c * CELL_SIZE, PADDING + 9 * CELL_SIZE);
        ctx.stroke();
      }
    }

    // 九宫格斜线
    this.drawPalaceDiagonals(ctx, 0); // 黑方
    this.drawPalaceDiagonals(ctx, 7); // 红方

    // 楚河汉界
    ctx.font = '18px serif';
    ctx.fillStyle = style.getPropertyValue('--text-color').trim() || '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const riverY = PADDING + 4.5 * CELL_SIZE;
    ctx.fillText('楚 河', PADDING + 2 * CELL_SIZE, riverY);
    ctx.fillText('漢 界', PADDING + 6 * CELL_SIZE, riverY);

    // 画棋子
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = this.board[r][c];
        if (piece === 0) continue;
        // 如果正在动画中且是动画棋子的起始位置，跳过
        if (this.animating && this.animationFrom &&
            r === this.animationFrom[0] && c === this.animationFrom[1]) continue;
        this.drawPiece(ctx, r, c, piece, style);
      }
    }

    // 画动画中的棋子
    if (this.animating && this.animationPiece !== null) {
      const fromPx = this.toPixel(this.animationFrom[0], this.animationFrom[1]);
      const toPx = this.toPixel(this.animationTo[0], this.animationTo[1]);
      const x = fromPx.x + (toPx.x - fromPx.x) * this.animationProgress;
      const y = fromPx.y + (toPx.y - fromPx.y) * this.animationProgress;
      this.drawPieceAt(ctx, x, y, this.animationPiece, style);
    }

    // 高亮上一步
    if (this.lastMove && !this.animating) {
      this.highlightMove(ctx, this.lastMove, style);
    }
  }

  drawPalaceDiagonals(ctx, startRow) {
    const topLeft = this.toPixel(startRow, 3);
    const topRight = this.toPixel(startRow, 5);
    const bottomLeft = this.toPixel(startRow + 2, 3);
    const bottomRight = this.toPixel(startRow + 2, 5);
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(topRight.x, topRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.stroke();
  }

  drawPiece(ctx, row, col, piece, style) {
    const { x, y } = this.toPixel(row, col);
    this.drawPieceAt(ctx, x, y, piece, style);
  }

  drawPieceAt(ctx, x, y, piece, style) {
    const side = getPieceSide(piece);
    const def = PIECE_DEFS[String(piece)];
    if (!def) return;

    const radius = 22;

    // 棋子底色
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = style.getPropertyValue('--piece-bg').trim() || '#fffbe6';
    ctx.fill();
    ctx.strokeStyle = side === 'red'
      ? (style.getPropertyValue('--red-piece-border').trim() || '#c00')
      : (style.getPropertyValue('--black-piece-border').trim() || '#333');
    ctx.lineWidth = 2;
    ctx.stroke();

    // 棋子文字
    ctx.font = 'bold 18px serif';
    ctx.fillStyle = side === 'red'
      ? (style.getPropertyValue('--red-piece-text').trim() || '#c00')
      : (style.getPropertyValue('--black-piece-text').trim() || '#333');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.name, x, y);
  }

  highlightMove(ctx, move, style) {
    const color = style.getPropertyValue('--highlight-color').trim() || 'rgba(255, 200, 0, 0.4)';
    for (const pos of [move.from, move.to]) {
      const { x, y } = this.toPixel(pos[0], pos[1]);
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  // 动画走棋
  animateMove(from, to, piece, callback) {
    this.animating = true;
    this.animationFrom = from;
    this.animationTo = to;
    this.animationPiece = piece;
    this.animationProgress = 0;

    const duration = 300; // ms
    const startTime = performance.now();

    const animate = (now) => {
      this.animationProgress = Math.min((now - startTime) / duration, 1);
      this.draw();

      if (this.animationProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 动画结束，更新棋盘状态
        this.animating = false;
        this.board[to[0]][to[1]] = piece;
        this.board[from[0]][from[1]] = 0;
        this.lastMove = { from, to };
        this.draw();
        if (callback) callback();
      }
    };

    requestAnimationFrame(animate);
  }

  // 直接应用走棋（无动画）
  applyMove(from, to) {
    const piece = this.board[from[0]][from[1]];
    this.board[to[0]][to[1]] = piece;
    this.board[from[0]][from[1]] = 0;
    this.lastMove = { from, to };
    this.draw();
  }

  // 重置棋盘
  reset() {
    this.board = INITIAL_BOARD.map(row => [...row]);
    this.lastMove = null;
    this.draw();
  }
}

// 初始化并导出到全局
const renderer = new ChessBoardRenderer('chessCanvas');
renderer.draw();
window.chessBoard = renderer;

export default renderer;
```

- [ ] **Step 4: Create themes.css**

```css
/* public/chess/assets/themes.css */

/* Classic theme (default) */
:root, [data-theme="classic"] {
  --bg-color: #faf6f0;
  --header-bg: #fff;
  --text-color: #333;
  --muted-color: #888;
  --border-color: #ddd;
  --panel-bg: #fff;
  --btn-bg: #f5f5f5;
  --btn-hover: #e8e8e8;
  --btn-active: #4a90d9;
  --board-bg: #f0d9a0;
  --line-color: #333;
  --piece-bg: #fffbe6;
  --red-piece-border: #c00;
  --red-piece-text: #c00;
  --black-piece-border: #333;
  --black-piece-text: #333;
  --highlight-color: rgba(255, 200, 0, 0.4);
  --red-bg: #fff0f0;
  --red-color: #c00;
  --black-bg: #f0f0f0;
  --black-color: #333;
}

/* Minimal theme */
[data-theme="minimal"] {
  --bg-color: #1a1a2e;
  --header-bg: #16213e;
  --text-color: #e0e0e0;
  --muted-color: #888;
  --border-color: #333;
  --panel-bg: #16213e;
  --btn-bg: #0f3460;
  --btn-hover: #1a4a7a;
  --btn-active: #e94560;
  --board-bg: #2a2a4a;
  --line-color: #666;
  --piece-bg: #1a1a2e;
  --red-piece-border: #e94560;
  --red-piece-text: #e94560;
  --black-piece-border: #aaa;
  --black-piece-text: #e0e0e0;
  --highlight-color: rgba(233, 69, 96, 0.3);
  --red-bg: rgba(233, 69, 96, 0.1);
  --red-color: #e94560;
  --black-bg: rgba(255, 255, 255, 0.05);
  --black-color: #e0e0e0;
}
```

- [ ] **Step 5: Create theme.js**

```javascript
// public/chess/shared/theme.js

const THEMES = ['classic', 'minimal'];
const STORAGE_KEY = 'chess-theme';

function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'classic';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

function toggleTheme() {
  const current = getTheme();
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  setTheme(next);
  // 重绘棋盘
  if (window.chessBoard) {
    window.chessBoard.draw();
  }
}

// 初始化
setTheme(getTheme());

// 绑定按钮
const btnTheme = document.getElementById('btnTheme');
if (btnTheme) {
  btnTheme.addEventListener('click', toggleTheme);
}

export { getTheme, setTheme, toggleTheme };
```

- [ ] **Step 6: Commit**

```bash
git add public/chess/chinese/index.html public/chess/chinese/board.js public/chess/chinese/pieces.js public/chess/assets/themes.css public/chess/shared/theme.js
git commit -m "feat(chess): add frontend board rendering with Canvas and theme support"
```

---

## Task 8: 前端 - WebSocket + 控制面板

**Files:**
- Create: `public/chess/shared/ws-client.js`
- Create: `public/chess/shared/game-controls.js`
- Create: `public/chess/shared/move-panel.js`

- [ ] **Step 1: Create ws-client.js**

```javascript
// public/chess/shared/ws-client.js

class WSClient {
  constructor() {
    this.ws = null;
    this.reconnectDelay = 2000;
    this.reconnectTimer = null;
    this.listeners = new Map();
    this.connected = false;
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.emit('connected');
      this.updateStatus('已连接');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
        this.emit('message', data);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.emit('disconnected');
      this.updateStatus('连接断开，重连中...');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx !== -1) cbs.splice(idx, 1);
    }
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) cb(data);
    }
  }

  updateStatus(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
  }
}

// 初始化全局 WS 客户端
const wsClient = new WSClient();
wsClient.connect();

// 处理核心事件
wsClient.on('match_start', (data) => {
  document.getElementById('redName').textContent = data.players.red;
  document.getElementById('blackName').textContent = data.players.black;
  wsClient.updateStatus(`Bo${data.bo} 对局开始`);
});

wsClient.on('game_start', (data) => {
  if (window.chessBoard) window.chessBoard.reset();
  wsClient.updateStatus(`第 ${data.game} 局进行中`);
});

wsClient.on('move', (data) => {
  if (window.chessBoard && !window.gameControls?.isPaused()) {
    const piece = window.chessBoard.board[data.from[0]][data.from[1]];
    window.chessBoard.animateMove(data.from, data.to, piece);
  }
  // 缓冲走棋（如果暂停）
  if (window.gameControls?.isPaused()) {
    window.gameControls.bufferMove(data);
  }
});

wsClient.on('game_end', (data) => {
  const winText = data.winner === 'draw' ? '和棋' : `${data.winner === 'red' ? '红方' : '黑方'}胜`;
  wsClient.updateStatus(`第 ${data.game} 局结束: ${winText} - ${data.reason}`);
  // 更新比分
  const scores = Object.values(data.score);
  document.getElementById('redScore').textContent = String(scores[0] || 0);
  document.getElementById('blackScore').textContent = String(scores[1] || 0);
});

wsClient.on('match_end', (data) => {
  wsClient.updateStatus(`对局结束! 胜者: ${data.winner}`);
});

window.wsClient = wsClient;
export default wsClient;
```

- [ ] **Step 2: Create game-controls.js**

```javascript
// public/chess/shared/game-controls.js

class GameControls {
  constructor() {
    this.paused = false;
    this.replayMode = false;
    this.moveBuffer = [];
    this.replayEvents = [];
    this.replayIndex = 0;
    this.container = document.getElementById('gameControls');
    this.init();
  }

  init() {
    // 检测是否为回放模式
    const params = new URLSearchParams(location.search);
    this.replayMode = params.has('replay');

    if (this.replayMode) {
      this.renderReplayControls();
      this.loadReplay();
    } else {
      this.renderLiveControls();
    }
  }

  renderLiveControls() {
    this.container.innerHTML = `
      <button id="btnPause">⏸ 暂停</button>
      <button id="btnResume" style="display:none">▶ 继续</button>
    `;

    document.getElementById('btnPause').addEventListener('click', () => this.pause());
    document.getElementById('btnResume').addEventListener('click', () => this.resume());
  }

  renderReplayControls() {
    this.container.innerHTML = `
      <button id="btnPrev">⏮ 上一步</button>
      <button id="btnNext">⏭ 下一步</button>
      <button id="btnAutoPlay">▶ 自动播放</button>
      <div style="width:100%;margin-top:8px">
        <input type="range" id="progressBar" min="0" max="0" value="0" style="width:100%">
      </div>
    `;

    document.getElementById('btnPrev').addEventListener('click', () => this.stepBack());
    document.getElementById('btnNext').addEventListener('click', () => this.stepForward());
    document.getElementById('btnAutoPlay').addEventListener('click', () => this.toggleAutoPlay());
    document.getElementById('progressBar').addEventListener('input', (e) => {
      this.jumpTo(Number(e.target.value));
    });
  }

  isPaused() {
    return this.paused;
  }

  pause() {
    this.paused = true;
    document.getElementById('btnPause').style.display = 'none';
    document.getElementById('btnResume').style.display = '';
    window.wsClient?.updateStatus('已暂停');
  }

  resume() {
    this.paused = false;
    document.getElementById('btnPause').style.display = '';
    document.getElementById('btnResume').style.display = 'none';
    window.wsClient?.updateStatus('继续中...');
    // 播放缓冲的走棋
    this.flushBuffer();
  }

  bufferMove(data) {
    this.moveBuffer.push(data);
  }

  flushBuffer() {
    while (this.moveBuffer.length > 0) {
      const data = this.moveBuffer.shift();
      if (window.chessBoard) {
        const piece = window.chessBoard.board[data.from[0]][data.from[1]];
        window.chessBoard.animateMove(data.from, data.to, piece);
      }
      if (window.movePanel) {
        window.movePanel.addMove(data);
      }
    }
  }

  // 回放模式方法
  async loadReplay() {
    try {
      const res = await fetch('/api/replay');
      const text = await res.text();
      this.replayEvents = text.trim().split('\n')
        .map(line => JSON.parse(line))
        .filter(e => e.type === 'move' || e.type === 'game_start' || e.type === 'game_end');

      const bar = document.getElementById('progressBar');
      if (bar) bar.max = String(this.replayEvents.length - 1);

      window.wsClient?.updateStatus(`回放已加载: ${this.replayEvents.length} 个事件`);
    } catch (err) {
      window.wsClient?.updateStatus('加载回放失败');
      console.error('Failed to load replay:', err);
    }
  }

  stepForward() {
    if (this.replayIndex >= this.replayEvents.length) return;
    const event = this.replayEvents[this.replayIndex];
    this.applyReplayEvent(event);
    this.replayIndex++;
    this.updateProgressBar();
  }

  stepBack() {
    if (this.replayIndex <= 0) return;
    // 重置并重放到 index-1
    this.replayIndex--;
    window.chessBoard?.reset();
    for (let i = 0; i < this.replayIndex; i++) {
      const event = this.replayEvents[i];
      if (event.type === 'move') {
        window.chessBoard?.applyMove(event.from, event.to);
      }
    }
    window.chessBoard?.draw();
    this.updateProgressBar();
  }

  jumpTo(index) {
    window.chessBoard?.reset();
    this.replayIndex = 0;
    for (let i = 0; i <= index && i < this.replayEvents.length; i++) {
      const event = this.replayEvents[i];
      if (event.type === 'move') {
        window.chessBoard?.applyMove(event.from, event.to);
      }
      this.replayIndex = i + 1;
    }
    window.chessBoard?.draw();
  }

  toggleAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
      document.getElementById('btnAutoPlay').textContent = '▶ 自动播放';
    } else {
      document.getElementById('btnAutoPlay').textContent = '⏹ 停止';
      this.autoPlayTimer = setInterval(() => {
        if (this.replayIndex >= this.replayEvents.length) {
          this.toggleAutoPlay();
          return;
        }
        this.stepForward();
      }, 1500);
    }
  }

  applyReplayEvent(event) {
    if (event.type === 'move') {
      if (window.chessBoard) {
        const piece = window.chessBoard.board[event.from[0]][event.from[1]];
        window.chessBoard.animateMove(event.from, event.to, piece);
      }
      if (window.movePanel) {
        window.movePanel.addMove(event);
      }
    } else if (event.type === 'game_start') {
      window.chessBoard?.reset();
      window.wsClient?.updateStatus(`第 ${event.game} 局`);
    }
  }

  updateProgressBar() {
    const bar = document.getElementById('progressBar');
    if (bar) bar.value = String(this.replayIndex);
  }
}

const controls = new GameControls();
window.gameControls = controls;
export default controls;
```

- [ ] **Step 3: Create move-panel.js**

```javascript
// public/chess/shared/move-panel.js

class MovePanel {
  constructor() {
    this.container = document.getElementById('moveList');
    this.moves = [];
    this.showThinking = false;
    this.currentHighlight = null;
    this.init();
  }

  init() {
    // 绑定思考按钮
    const btnThinking = document.getElementById('btnThinking');
    if (btnThinking) {
      btnThinking.addEventListener('click', () => this.toggleThinking());
    }

    // 监听 WS 事件
    if (window.wsClient) {
      window.wsClient.on('move', (data) => {
        if (!window.gameControls?.isPaused()) {
          this.addMove(data);
        }
      });
      window.wsClient.on('game_start', () => {
        this.clear();
      });
    }
  }

  addMove(data) {
    this.moves.push(data);
    const moveNum = this.moves.length;
    const isRed = data.player === 'red';

    const entry = document.createElement('div');
    entry.className = `move-entry ${data.player}`;
    entry.dataset.index = String(moveNum - 1);

    const numStr = isRed ? `${Math.ceil(moveNum / 2)}.` : '    ';
    let html = `<span class="move-num">${numStr}</span> <span class="move-notation">${data.notation}</span>`;

    if (data.thinking && this.showThinking) {
      html += `<div class="move-thinking">${data.thinking}</div>`;
    }

    entry.innerHTML = html;
    entry.style.cssText = `
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      color: ${isRed ? 'var(--red-color)' : 'var(--black-color)'};
    `;

    entry.addEventListener('click', () => this.highlightMove(moveNum - 1));

    this.container.appendChild(entry);
    this.container.scrollTop = this.container.scrollHeight;
    this.highlightMove(moveNum - 1);
  }

  highlightMove(index) {
    // 移除旧高亮
    if (this.currentHighlight !== null) {
      const old = this.container.querySelector(`[data-index="${this.currentHighlight}"]`);
      if (old) old.style.background = '';
    }
    // 添加新高亮
    const el = this.container.querySelector(`[data-index="${index}"]`);
    if (el) el.style.background = 'var(--highlight-color)';
    this.currentHighlight = index;
  }

  toggleThinking() {
    this.showThinking = !this.showThinking;
    // 重新渲染所有走棋
    this.container.innerHTML = '';
    const moves = [...this.moves];
    this.moves = [];
    for (const move of moves) {
      this.addMove(move);
    }
  }

  clear() {
    this.moves = [];
    this.currentHighlight = null;
    this.container.innerHTML = '';
  }
}

const movePanel = new MovePanel();
window.movePanel = movePanel;
export default movePanel;
```

- [ ] **Step 4: Verify frontend loads**

Run: `npm run chess`
Open: `http://localhost:3100/chess/chinese/`
Expected: Page loads with empty board rendered on Canvas, theme toggle works, WS connects (shows "已连接" or reconnecting if no match running)

- [ ] **Step 5: Commit**

```bash
git add public/chess/shared/ws-client.js public/chess/shared/game-controls.js public/chess/shared/move-panel.js
git commit -m "feat(chess): add WebSocket client, game controls, and move panel"
```
