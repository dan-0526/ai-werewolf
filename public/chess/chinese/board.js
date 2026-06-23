/**
 * Canvas-based Chinese Chess Board Renderer
 */

const CELL_SIZE = 50;
const PADDING = 30;
const ROWS = 10;
const COLS = 9;
const CANVAS_WIDTH = PADDING * 2 + (COLS - 1) * CELL_SIZE;   // 460
const CANVAS_HEIGHT = PADDING * 2 + (ROWS - 1) * CELL_SIZE;  // 510
const PIECE_RADIUS = 22;

// Initial board layout (10 rows x 9 cols)
// Row 0 = black side (top), Row 9 = red side (bottom)
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
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    // Deep copy initial board
    this.board = INITIAL_BOARD.map(row => [...row]);
    this.lastMove = null; // { from: {row, col}, to: {row, col} }
    this.animating = false;
    this.animState = null;
  }

  /** Get a CSS variable value from the document */
  getVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Convert board position to canvas pixel coordinates */
  toPixel(row, col) {
    return {
      x: PADDING + col * CELL_SIZE,
      y: PADDING + row * CELL_SIZE,
    };
  }
  /** Main draw method */
  draw() {
    const ctx = this.ctx;
    const boardBg = this.getVar('--board-bg');
    const lineColor = this.getVar('--board-line');

    // Clear canvas
    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    // Horizontal lines (10 lines)
    for (let r = 0; r < ROWS; r++) {
      const y = PADDING + r * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(PADDING + (COLS - 1) * CELL_SIZE, y);
      ctx.stroke();
    }

    // Vertical lines (9 lines, break at river except edges)
    for (let c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) {
        // Edge columns: full line
        ctx.beginPath();
        ctx.moveTo(PADDING + c * CELL_SIZE, PADDING);
        ctx.lineTo(PADDING + c * CELL_SIZE, PADDING + (ROWS - 1) * CELL_SIZE);
        ctx.stroke();
      } else {
        // Top half (rows 0-4)
        ctx.beginPath();
        ctx.moveTo(PADDING + c * CELL_SIZE, PADDING);
        ctx.lineTo(PADDING + c * CELL_SIZE, PADDING + 4 * CELL_SIZE);
        ctx.stroke();
        // Bottom half (rows 5-9)
        ctx.beginPath();
        ctx.moveTo(PADDING + c * CELL_SIZE, PADDING + 5 * CELL_SIZE);
        ctx.lineTo(PADDING + c * CELL_SIZE, PADDING + (ROWS - 1) * CELL_SIZE);
        ctx.stroke();
      }
    }

    // 楚河汉界 text
    this.drawRiverText(ctx);

    // Palace diagonals
    this.drawPalace(ctx, lineColor);

    // Last move highlight
    if (this.lastMove) {
      this.drawHighlight(ctx);
    }

    // Draw pieces
    this.drawPieces(ctx);

    // Draw animation frame if animating
    if (this.animating && this.animState) {
      this.drawAnimPiece(ctx);
    }
  }

  drawRiverText(ctx) {
    const riverColor = this.getVar('--river-text');
    const y = PADDING + 4.5 * CELL_SIZE;
    ctx.font = 'bold 22px serif';
    ctx.fillStyle = riverColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Left side: 楚河
    ctx.fillText('楚  河', PADDING + 2 * CELL_SIZE, y);
    // Right side: 漢界
    ctx.fillText('漢  界', PADDING + 6 * CELL_SIZE, y);
  }

  drawPalace(ctx, lineColor) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    // Top palace (black): cols 3-5, rows 0-2
    const topLeft = this.toPixel(0, 3);
    const topRight = this.toPixel(0, 5);
    const botLeft = this.toPixel(2, 3);
    const botRight = this.toPixel(2, 5);
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(botRight.x, botRight.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(topRight.x, topRight.y);
    ctx.lineTo(botLeft.x, botLeft.y);
    ctx.stroke();

    // Bottom palace (red): cols 3-5, rows 7-9
    const bTopLeft = this.toPixel(7, 3);
    const bTopRight = this.toPixel(7, 5);
    const bBotLeft = this.toPixel(9, 3);
    const bBotRight = this.toPixel(9, 5);
    ctx.beginPath();
    ctx.moveTo(bTopLeft.x, bTopLeft.y);
    ctx.lineTo(bBotRight.x, bBotRight.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bTopRight.x, bTopRight.y);
    ctx.lineTo(bBotLeft.x, bBotLeft.y);
    ctx.stroke();
  }
  drawHighlight(ctx) {
    const fromColor = this.getVar('--highlight-from') || 'rgba(255, 200, 0, 0.3)';
    const toColor = this.getVar('--highlight-to') || 'rgba(255, 150, 0, 0.35)';

    const from = this.toPixel(this.lastMove.from.row, this.lastMove.from.col);
    const to = this.toPixel(this.lastMove.to.row, this.lastMove.to.col);

    ctx.beginPath();
    ctx.arc(from.x, from.y, PIECE_RADIUS + 4, 0, Math.PI * 2);
    ctx.fillStyle = fromColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(to.x, to.y, PIECE_RADIUS + 4, 0, Math.PI * 2);
    ctx.fillStyle = toColor;
    ctx.fill();
  }

  drawPieces(ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = this.board[r][c];
        if (piece === 0) continue;
        // Skip piece being animated at its original position
        if (this.animating && this.animState &&
            this.animState.from.row === r && this.animState.from.col === c) {
          continue;
        }
        this.drawSinglePiece(ctx, r, c, piece);
      }
    }
  }

  drawSinglePiece(ctx, row, col, piece) {
    const { x, y } = this.toPixel(row, col);
    const pieceBg = this.getVar('--piece-bg');
    const pieceBorder = this.getVar('--piece-border');
    const side = getPieceSide(piece);
    const textColor = side === 'red' ? this.getVar('--piece-red') : this.getVar('--piece-black');
    const name = getPieceName(piece);

    // Circle background
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = pieceBg;
    ctx.fill();
    ctx.strokeStyle = pieceBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS - 4, 0, Math.PI * 2);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Piece name text
    ctx.font = 'bold 18px serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, y);
  }

  drawAnimPiece(ctx) {
    const { piece, x, y } = this.animState;
    const pieceBg = this.getVar('--piece-bg');
    const pieceBorder = this.getVar('--piece-border');
    const side = getPieceSide(piece);
    const textColor = side === 'red' ? this.getVar('--piece-red') : this.getVar('--piece-black');
    const name = getPieceName(piece);

    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = pieceBg;
    ctx.fill();
    ctx.strokeStyle = pieceBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS - 4, 0, Math.PI * 2);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 18px serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, y);
  }

  /**
   * Animate a piece moving from one position to another
   * @param {{row: number, col: number}} from
   * @param {{row: number, col: number}} to
   * @param {number} piece - piece value
   * @param {Function} callback - called when animation completes
   */
  animateMove(from, to, piece, callback) {
    const duration = 300; // ms
    const startPos = this.toPixel(from.row, from.col);
    const endPos = this.toPixel(to.row, to.col);
    const startTime = performance.now();

    this.animating = true;
    this.animState = { from, to, piece, x: startPos.x, y: startPos.y };

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out quad
      const ease = 1 - (1 - t) * (1 - t);

      this.animState.x = startPos.x + (endPos.x - startPos.x) * ease;
      this.animState.y = startPos.y + (endPos.y - startPos.y) * ease;

      this.draw();

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete: apply the move to board state
        this.animating = false;
        this.animState = null;
        this.board[to.row][to.col] = piece;
        this.board[from.row][from.col] = 0;
        this.lastMove = { from, to };
        this.draw();
        if (callback) callback();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Instantly apply a move (for replay stepping)
   */
  applyMove(from, to) {
    const piece = this.board[from.row][from.col];
    if (piece === 0) return;
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = 0;
    this.lastMove = { from, to };
    this.draw();
  }

  /**
   * Reset board to initial state
   */
  reset() {
    this.board = INITIAL_BOARD.map(row => [...row]);
    this.lastMove = null;
    this.animating = false;
    this.animState = null;
    this.draw();
  }
  /**
   * Draw a selection highlight around a position
   */
  drawSelection(row, col) {
    const ctx = this.ctx;
    const { x, y } = this.toPixel(row, col);
    ctx.strokeStyle = 'rgba(0, 200, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Manual play mode: click to select and move pieces for both sides.
 * No full rule validation — trusts the user, only checks basic legality
 * (must select own piece, can't capture own piece).
 */
class ManualPlayController {
  constructor(board) {
    this.board = board;
    this.currentTurn = 'red';
    this.selected = null; // { row, col }
    this.moveCount = 0;
    this.moves = [];
    this.history = []; // for undo: stores { board snapshot, turn, moveCount }

    this.board.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.bindButtons();
    this.updateStatus();
  }

  /** Bind new game, undo, resign buttons */
  bindButtons() {
    const btnNew = document.getElementById('btnNewGame');
    const btnUndo = document.getElementById('btnUndo');
    const btnResign = document.getElementById('btnResign');

    if (btnNew) btnNew.addEventListener('click', () => this.newGame());
    if (btnUndo) btnUndo.addEventListener('click', () => this.undo());
    if (btnResign) btnResign.addEventListener('click', () => this.resign());
  }

  newGame() {
    this.board.reset();
    this.currentTurn = 'red';
    this.selected = null;
    this.moveCount = 0;
    this.moves = [];
    this.history = [];
    // Clear move list
    const listEl = document.getElementById('moveListItems');
    if (listEl) listEl.innerHTML = '';
    if (window.movePanel && window.movePanel.clear) window.movePanel.clear();
    this.updateStatus();
  }

  undo() {
    if (this.history.length === 0) return;
    const prev = this.history.pop();
    this.board.board = prev.boardState.map(row => [...row]);
    this.currentTurn = prev.turn;
    this.moveCount = prev.moveCount;
    this.moves.pop();
    this.selected = null;
    this.board.lastMove = prev.lastMove;
    this.board.draw();
    // Remove last entry from move list
    const listEl = document.getElementById('moveListItems');
    if (listEl && listEl.lastChild) listEl.removeChild(listEl.lastChild);
    this.updateStatus();
  }

  resign() {
    const loser = this.currentTurn === 'red' ? '红方' : '黑方';
    const winner = this.currentTurn === 'red' ? '黑方' : '红方';
    const el = document.getElementById('statusBar');
    if (el) el.textContent = `${loser}认输，${winner}获胜`;
  }

  /** Convert canvas click coordinates to board position */
  pixelToPos(e) {
    const rect = this.board.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const col = Math.round((px - PADDING) / CELL_SIZE);
    const row = Math.round((py - PADDING) / CELL_SIZE);
    if (row < 0 || row > 9 || col < 0 || col > 8) return null;
    return { row, col };
  }

  handleClick(e) {
    if (this.board.animating) return;
    const pos = this.pixelToPos(e);
    if (!pos) return;

    const piece = this.board.board[pos.row][pos.col];
    const clickedSide = getPieceSide(piece);

    if (this.selected) {
      // Clicked same piece: deselect
      if (pos.row === this.selected.row && pos.col === this.selected.col) {
        this.selected = null;
        this.board.draw();
        return;
      }
      // Clicked another own piece: re-select
      if (clickedSide === this.currentTurn) {
        this.selected = pos;
        this.board.draw();
        this.board.drawSelection(pos.row, pos.col);
        return;
      }
      // Move to target
      this.executeMove(this.selected, pos);
    } else {
      // Select a piece of current turn
      if (clickedSide !== this.currentTurn) return;
      this.selected = pos;
      this.board.draw();
      this.board.drawSelection(pos.row, pos.col);
    }
  }

  executeMove(from, to) {
    const piece = this.board.board[from.row][from.col];
    const captured = this.board.board[to.row][to.col];

    // Save state for undo before modifying anything
    this.history.push({
      boardState: this.board.board.map(row => [...row]),
      turn: this.currentTurn,
      moveCount: this.moveCount,
      lastMove: this.board.lastMove,
    });

    this.moveCount++;

    const chineseNotation = this.toChineseNotation(piece, from, to);
    const sideLabel = this.currentTurn === 'red' ? '红方' : '黑方';
    const coordStr = `[${from.row},${from.col}]\u2192[${to.row},${to.col}]`;

    const moveData = {
      player: this.currentTurn,
      side: this.currentTurn,
      from: { row: from.row, col: from.col },
      to: { row: to.row, col: to.col },
      piece: getPieceName(piece),
      captured: captured !== 0 ? getPieceName(captured) : null,
      notation: `${sideLabel} ${getPieceName(piece)}${coordStr} ${chineseNotation}`,
      moveNum: this.moveCount,
    };
    this.moves.push(moveData);

    this.selected = null;
    this.board.animateMove(from, to, piece, () => {
      // Try movePanel first, fallback to direct DOM
      if (window.movePanel && window.movePanel.addMove) {
        window.movePanel.addMove(moveData);
      } else {
        this.appendToMoveList(moveData);
      }
      this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
      this.updateStatus();
    });
  }

  /** Generate simplified Chinese chess notation */
  toChineseNotation(pieceVal, from, to) {
    const side = getPieceSide(pieceVal);
    const pieceName = getPieceName(pieceVal);
    // Column names: red counts right-to-left (col8=一), black counts left-to-right (col0=1)
    const redCols = ['九','八','七','六','五','四','三','二','一'];
    const blackCols = ['1','2','3','4','5','6','7','8','9'];
    const redNums = ['零','一','二','三','四','五','六','七','八','九'];
    const blackNums = ['0','1','2','3','4','5','6','7','8','9'];

    const cols = side === 'red' ? redCols : blackCols;
    const nums = side === 'red' ? redNums : blackNums;
    const forward = side === 'red' ? -1 : 1;

    const fromCol = cols[from.col];
    const rowDiff = to.row - from.row;
    const absPiece = Math.abs(pieceVal);

    let direction, distance;
    if (rowDiff === 0) {
      direction = '平';
      distance = cols[to.col];
    } else if (rowDiff * forward > 0) {
      direction = side === 'red' ? '進' : '进';
      if (absPiece === 4 || absPiece === 2 || absPiece === 3) {
        distance = cols[to.col];
      } else {
        distance = nums[Math.abs(rowDiff)];
      }
    } else {
      direction = '退';
      if (absPiece === 4 || absPiece === 2 || absPiece === 3) {
        distance = cols[to.col];
      } else {
        distance = nums[Math.abs(rowDiff)];
      }
    }

    return `${pieceName}${fromCol}${direction}${distance}`;
  }

  /** Fallback: directly append to move list DOM */
  appendToMoveList(data) {
    const listEl = document.getElementById('moveListItems');
    if (!listEl) return;
    const li = document.createElement('li');
    const side = data.side;
    li.style.color = side === 'red' ? 'var(--piece-red, #c0392b)' : 'var(--piece-black, #2c3e50)';
    if (side === 'red') {
      li.textContent = `${Math.ceil(data.moveNum / 2)}. ${data.notation}`;
    } else {
      li.textContent = `    ${data.notation}`;
    }
    li.style.padding = '3px 0';
    li.style.fontSize = '13px';
    listEl.appendChild(li);
    listEl.scrollTop = listEl.scrollHeight;
  }

  updateStatus() {
    const el = document.getElementById('statusBar');
    if (el) {
      const turnText = this.currentTurn === 'red' ? '红方走棋' : '黑方走棋';
      el.textContent = `手动模式 \u00b7 ${turnText} \u00b7 第 ${Math.ceil((this.moveCount + 1) / 2)} 回合`;
    }
  }
}

// Initialize and export to window
document.addEventListener('DOMContentLoaded', () => {
  const board = new ChessBoardRenderer('chessCanvas');
  board.draw();
  window.chessBoard = board;

  // Manual mode: ?mode=manual
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'manual') {
    window.manualPlay = new ManualPlayController(board);
  }
});
