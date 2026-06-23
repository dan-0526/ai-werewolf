/**
 * Game Controls for Chinese Chess
 * Supports live mode (pause/resume) and replay mode (prev/next/auto-play)
 */

class GameControls {
  constructor() {
    this.mode = this.detectMode();
    this.replayEvents = [];
    this.replayIndex = 0;
    this.autoPlayTimer = null;
    this.controlsEl = document.getElementById('controls');
    this.init();
  }

  /** Detect mode from URL params */
  detectMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'manual') return 'manual';
    return params.has('replay') ? 'replay' : 'live';
  }

  /** Initialize controls based on mode */
  init() {
    if (!this.controlsEl) return;
    this.controlsEl.innerHTML = '';

    if (this.mode === 'manual') {
      // Manual mode: no controls needed, board.js handles interaction
      return;
    } else if (this.mode === 'replay') {
      this.initReplayControls();
    } else {
      this.initLiveControls();
    }
  }

  /** Live mode: pause/resume buttons */
  initLiveControls() {
    const pauseBtn = this.createBtn('btnPause', '暂停', () => this.pause());
    const resumeBtn = this.createBtn('btnResume', '继续', () => this.resume());
    resumeBtn.disabled = true;

    this.controlsEl.appendChild(pauseBtn);
    this.controlsEl.appendChild(resumeBtn);
    this.pauseBtn = pauseBtn;
    this.resumeBtn = resumeBtn;
  }

  /** Replay mode: navigation + progress */
  initReplayControls() {
    const prevBtn = this.createBtn('btnPrev', '上一步', () => this.stepBack());
    const nextBtn = this.createBtn('btnNext', '下一步', () => this.stepForward());
    const autoBtn = this.createBtn('btnAuto', '自动播放', () => this.toggleAutoPlay());

    // Progress bar
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.id = 'replayProgress';
    progress.min = '0';
    progress.max = '0';
    progress.value = '0';
    progress.style.width = '100%';
    progress.addEventListener('input', () => this.jumpTo(parseInt(progress.value)));

    this.controlsEl.appendChild(prevBtn);
    this.controlsEl.appendChild(nextBtn);
    this.controlsEl.appendChild(autoBtn);
    this.controlsEl.appendChild(progress);

    this.prevBtn = prevBtn;
    this.nextBtn = nextBtn;
    this.autoBtn = autoBtn;
    this.progressBar = progress;

    // Load replay data
    this.loadReplay();
  }

  /** Create a button element */
  createBtn(id, text, handler) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'btn';
    btn.textContent = text;
    btn.addEventListener('click', handler);
    return btn;
  }

  /** Pause live game */
  pause() {
    if (window.wsClient) {
      window.wsClient.pause();
    }
    if (this.pauseBtn) this.pauseBtn.disabled = true;
    if (this.resumeBtn) this.resumeBtn.disabled = false;
    this.updateStatus('已暂停');
  }

  /** Resume live game */
  resume() {
    if (window.wsClient) {
      window.wsClient.resume();
    }
    if (this.pauseBtn) this.pauseBtn.disabled = false;
    if (this.resumeBtn) this.resumeBtn.disabled = true;
    this.updateStatus('继续中...');
  }

  /** Load replay data from API */
  async loadReplay() {
    this.updateStatus('加载回放数据...');
    try {
      const params = new URLSearchParams(window.location.search);
      const matchId = params.get('replay');
      const url = matchId ? `/api/replay?id=${matchId}` : '/api/replay';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Parse JSONL, filter relevant events
      this.replayEvents = text
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .filter(ev => ['move', 'game_start', 'game_end'].includes(ev.type));

      this.replayIndex = 0;
      if (this.progressBar) {
        this.progressBar.max = String(Math.max(0, this.replayEvents.length - 1));
        this.progressBar.value = '0';
      }
      this.updateStatus(`回放已加载 (${this.replayEvents.length} 步)`);
    } catch (e) {
      console.error('[GameControls] Failed to load replay:', e);
      this.updateStatus('回放加载失败');
    }
  }

  /** Step forward one event */
  stepForward() {
    if (this.replayIndex >= this.replayEvents.length) return;
    const event = this.replayEvents[this.replayIndex];
    this.applyReplayEvent(event);
    this.replayIndex++;
    this.updateProgress();
  }

  /** Step back one event */
  stepBack() {
    if (this.replayIndex <= 0) return;
    this.replayIndex--;
    this.replayToIndex(this.replayIndex);
    this.updateProgress();
  }

  /** Jump to specific index */
  jumpTo(index) {
    if (index < 0) index = 0;
    if (index >= this.replayEvents.length) index = this.replayEvents.length - 1;
    this.replayIndex = index;
    this.replayToIndex(index);
    this.updateProgress();
  }

  /** Reset board and replay all events up to given index */
  replayToIndex(targetIndex) {
    if (!window.chessBoard) return;
    window.chessBoard.reset();
    // Notify move panel to clear
    if (window.movePanel) window.movePanel.clear();
    for (let i = 0; i < targetIndex; i++) {
      this.applyReplayEvent(this.replayEvents[i]);
    }
  }

  /** Apply a single replay event */
  applyReplayEvent(event) {
    if (!event) return;
    switch (event.type) {
      case 'game_start':
        if (window.chessBoard) window.chessBoard.reset();
        if (window.movePanel) window.movePanel.clear();
        break;
      case 'move':
        if (window.chessBoard) {
          window.chessBoard.applyMove(event.from, event.to);
        }
        if (window.movePanel) window.movePanel.addMove(event);
        break;
      case 'game_end':
        this.updateStatus(event.message || '本局结束');
        break;
    }
  }

  /** Toggle auto-play mode */
  toggleAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
      if (this.autoBtn) this.autoBtn.textContent = '自动播放';
    } else {
      if (this.autoBtn) this.autoBtn.textContent = '停止';
      this.autoPlayTimer = setInterval(() => {
        if (this.replayIndex >= this.replayEvents.length) {
          this.toggleAutoPlay(); // Stop at end
          return;
        }
        this.stepForward();
      }, 1500);
    }
  }

  /** Update progress bar value */
  updateProgress() {
    if (this.progressBar) {
      this.progressBar.value = String(this.replayIndex);
    }
  }

  /** Update status bar */
  updateStatus(text) {
    const el = document.getElementById('statusBar');
    if (el) el.textContent = text;
  }
}

// Initialize and export
document.addEventListener('DOMContentLoaded', () => {
  window.gameControls = new GameControls();
});
