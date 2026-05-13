/**
 * Theme toggle logic for Chinese Chess UI
 * Reads/saves theme preference to localStorage
 */

const THEMES = ['classic', 'minimal'];
const STORAGE_KEY = 'chess-theme';

function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'classic';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

function toggleTheme() {
  const current = getStoredTheme();
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  applyTheme(next);
  // Redraw board if available
  if (window.chessBoard && typeof window.chessBoard.draw === 'function') {
    window.chessBoard.draw();
  }
}

// Initialize theme on load
(function initTheme() {
  applyTheme(getStoredTheme());
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnTheme');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  });
})();

window.toggleTheme = toggleTheme;
