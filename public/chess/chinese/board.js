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
    const fromColor = this.getVar('--highlight-from');
    const toColor = this.getVar('--highlight-to');

    const from = this.toPixel(this.lastMove.from.row, this.lastMove.from.col);
    const to = this.toPixel(this.lastMove.to.row, this.lastMove.to.col);

    ctx.fillStyle = fromColor;
    ctx.fillRect(from.x - CELL_SIZE / 2, from.y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);

    ctx.fillStyle = toColor;
    ctx.fillRect(to.x - CELL_SIZE / 2, to.y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
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
}

// Initialize and export to window
document.addEventListener('DOMContentLoaded', () => {
  const board = new ChessBoardRenderer('chessCanvas');
  board.draw();
  window.chessBoard = board;
});
