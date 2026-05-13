/**
 * Move Panel - displays move notation sidebar
 */

class MovePanel {
  constructor() {
    this.container = document.getElementById('moveList');
    this.listEl = document.getElementById('moveListItems');
    this.moveCount = 0;
    this.thinkingVisible = false;
    this.selectedEntry = null;
    this.bindEvents();
  }

  /** Bind to wsClient events and thinking button */
  bindEvents() {
    // Listen to wsClient events
    if (window.wsClient) {
      window.wsClient.on('move', (data) => this.addMove(data));
      window.wsClient.on('game_start', () => this.clear());
    } else {
      // Retry binding after a short delay (wsClient may not be ready)
      setTimeout(() => {
        if (window.wsClient) {
          window.wsClient.on('move', (data) => this.addMove(data));
          window.wsClient.on('game_start', () => this.clear());
        }
      }, 100);
    }

    // Thinking toggle button
    const btnThinking = document.getElementById('btnThinking');
    if (btnThinking) {
      btnThinking.addEventListener('click', () => this.toggleThinking());
    }
  }

  /**
   * Add a move entry to the panel
   * @param {object} data - move data with side, notation, thinking
   */
  addMove(data) {
    if (!this.listEl) return;

    const side = data.side || (data.piece > 0 ? 'red' : 'black');
    const notation = data.notation || `${data.from.row},${data.from.col} -> ${data.to.row},${data.to.col}`;

    const li = document.createElement('li');
    li.className = `move-entry move-${side}`;
    li.style.color = side === 'red' ? 'var(--piece-red, #c0392b)' : 'var(--piece-black, #2c3e50)';
    li.style.cursor = 'pointer';

    // Red gets "N." prefix, black gets indent
    if (side === 'red') {
      this.moveCount++;
      li.textContent = `${this.moveCount}. ${notation}`;
    } else {
      li.textContent = notation;
      li.style.paddingLeft = '16px';
    }

    // Store thinking text if available
    if (data.thinking) {
      li.dataset.thinking = data.thinking;
    }

    // Click to highlight
    li.addEventListener('click', () => this.selectEntry(li));

    this.listEl.appendChild(li);

    // Auto-scroll to bottom
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  /** Highlight a move entry */
  selectEntry(li) {
    if (this.selectedEntry) {
      this.selectedEntry.style.background = '';
    }
    li.style.background = 'var(--highlight-from, rgba(255, 200, 0, 0.2))';
    this.selectedEntry = li;

    // Show thinking if visible and available
    if (this.thinkingVisible && li.dataset.thinking) {
      this.showThinkingText(li.dataset.thinking);
    }
  }

  /** Toggle AI thinking text display */
  toggleThinking() {
    this.thinkingVisible = !this.thinkingVisible;
    const thinkingEl = document.getElementById('thinkingPanel');

    if (this.thinkingVisible) {
      if (!thinkingEl) {
        const panel = document.createElement('div');
        panel.id = 'thinkingPanel';
        panel.style.cssText = 'padding:8px 12px;background:var(--status-bg,#f5f5f5);border-radius:6px;font-size:12px;color:var(--text-secondary,#666);white-space:pre-wrap;max-height:120px;overflow-y:auto;margin-top:8px;';
        panel.textContent = '选择一步棋查看 AI 思考过程';
        if (this.container && this.container.parentElement) {
          this.container.parentElement.appendChild(panel);
        }
      } else {
        thinkingEl.style.display = 'block';
      }
    } else {
      if (thinkingEl) {
        thinkingEl.style.display = 'none';
      }
    }
  }

  /** Show thinking text in panel */
  showThinkingText(text) {
    const thinkingEl = document.getElementById('thinkingPanel');
    if (thinkingEl) {
      thinkingEl.textContent = text;
    }
  }

  /** Clear all moves on new game */
  clear() {
    if (this.listEl) {
      this.listEl.innerHTML = '';
    }
    this.moveCount = 0;
    this.selectedEntry = null;
    const thinkingEl = document.getElementById('thinkingPanel');
    if (thinkingEl) {
      thinkingEl.textContent = '选择一步棋查看 AI 思考过程';
    }
  }
}

// Initialize and export
document.addEventListener('DOMContentLoaded', () => {
  window.movePanel = new MovePanel();
});
