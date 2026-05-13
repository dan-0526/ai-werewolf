/**
 * Chinese Chess piece definitions
 * Positive values = Red (bottom), Negative values = Black (top)
 */

const PIECE_DEFS = {
  1:  { name: '帥', type: 'king' },
  2:  { name: '仕', type: 'advisor' },
  3:  { name: '相', type: 'bishop' },
  4:  { name: '馬', type: 'knight' },
  5:  { name: '車', type: 'rook' },
  6:  { name: '炮', type: 'cannon' },
  7:  { name: '兵', type: 'pawn' },
  '-1': { name: '將', type: 'king' },
  '-2': { name: '士', type: 'advisor' },
  '-3': { name: '象', type: 'bishop' },
  '-4': { name: '马', type: 'knight' },
  '-5': { name: '车', type: 'rook' },
  '-6': { name: '砲', type: 'cannon' },
  '-7': { name: '卒', type: 'pawn' },
};

/**
 * Get the display name for a piece value
 * @param {number} pieceValue
 * @returns {string|null}
 */
function getPieceName(pieceValue) {
  const def = PIECE_DEFS[pieceValue];
  return def ? def.name : null;
}

/**
 * Get the side of a piece: 'red' for positive, 'black' for negative
 * @param {number} pieceValue
 * @returns {'red'|'black'|null}
 */
function getPieceSide(pieceValue) {
  if (pieceValue > 0) return 'red';
  if (pieceValue < 0) return 'black';
  return null;
}

// Export for use in other scripts
window.PIECE_DEFS = PIECE_DEFS;
window.getPieceName = getPieceName;
window.getPieceSide = getPieceSide;
