/**
 * WebSocket client for Chinese Chess game communication
 */

class WSClient {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.reconnectTimer = null;
    this.paused = false;
    this.moveBuffer = [];
  }

  /** Connect to WebSocket server at same host */
  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.updateStatus('已连接');
      this.emit('connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('[WSClient] Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      this.updateStatus('连接断开，正在重连...');
      this.emit('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[WSClient] WebSocket error:', err);
    };
  }

  /** Schedule auto-reconnect after 2s */
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  /** Handle incoming parsed message */
  handleMessage(data) {
    // Emit by type
    if (data.type) {
      this.emit(data.type, data);
    }
    // Always emit generic 'message'
    this.emit('message', data);

    // Handle core events
    switch (data.type) {
      case 'match_start':
        this.onMatchStart(data);
        break;
      case 'game_start':
        this.onGameStart(data);
        break;
      case 'move':
        this.onMove(data);
        break;
      case 'game_end':
        this.onGameEnd(data);
        break;
      case 'match_end':
        this.onMatchEnd(data);
        break;
    }
  }

  onMatchStart(data) {
    const redEl = document.getElementById('redPlayer');
    const blackEl = document.getElementById('blackPlayer');
    if (redEl && data.red) redEl.textContent = data.red;
    if (blackEl && data.black) blackEl.textContent = data.black;
    this.updateStatus(`对局开始: ${data.red || '红方'} vs ${data.black || '黑方'}`);
  }

  onGameStart(data) {
    if (window.chessBoard) {
      window.chessBoard.reset();
    }
    this.updateStatus(data.message || '新一局开始');
  }

  onMove(data) {
    if (this.paused) {
      this.moveBuffer.push(data);
      return;
    }
    this.applyMove(data);
  }

  /** Apply a move to the board with animation */
  applyMove(data) {
    if (!window.chessBoard) return;
    const from = data.from;
    const to = data.to;
    const piece = window.chessBoard.board[from.row][from.col];
    if (piece !== 0) {
      window.chessBoard.animateMove(from, to, piece, () => {
        this.updateStatus(data.notation || '走子完成');
      });
    } else {
      window.chessBoard.applyMove(from, to);
      this.updateStatus(data.notation || '走子完成');
    }
  }

  onGameEnd(data) {
    const redScoreEl = document.getElementById('redScore');
    const blackScoreEl = document.getElementById('blackScore');
    if (redScoreEl && data.redScore != null) redScoreEl.textContent = data.redScore;
    if (blackScoreEl && data.blackScore != null) blackScoreEl.textContent = data.blackScore;
    this.updateStatus(data.message || '本局结束');
  }

  onMatchEnd(data) {
    this.updateStatus(data.message || '比赛结束');
  }

  /** Pause move processing, buffer incoming moves */
  pause() {
    this.paused = true;
  }

  /** Resume and flush buffered moves */
  resume() {
    this.paused = false;
    this.flushBuffer();
  }

  /** Flush buffered moves sequentially */
  flushBuffer() {
    const flush = () => {
      if (this.moveBuffer.length === 0) return;
      const move = this.moveBuffer.shift();
      this.applyMove(move);
      setTimeout(flush, 400);
    };
    flush();
  }

  /** Update status bar text */
  updateStatus(text) {
    const el = document.getElementById('statusBar');
    if (el) el.textContent = text;
  }

  /** Register event listener */
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  /** Remove event listener */
  off(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
  }

  /** Emit event to listeners */
  emit(event, data) {
    const cbs = this.listeners[event];
    if (!cbs) return;
    cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error('[WSClient] Listener error:', e); }
    });
  }
}

// Initialize and export
const wsClient = new WSClient();
wsClient.connect();
window.wsClient = wsClient;
