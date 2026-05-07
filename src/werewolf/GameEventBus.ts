// GameEventBus — 事件总线，游戏事件 → SSE 推送 + 控制台日志

import { EventEmitter } from 'node:events';
import type { GameEvent } from './GameState.js';

class GameEventBus extends EventEmitter {
  emit(event: 'game-event', data: GameEvent): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    // 控制台日志
    if (event === 'game-event') {
      const data = args[0] as GameEvent;
      this.logEvent(data);
    }
    return super.emit(event, ...args);
  }

  private logEvent(e: GameEvent): void {
    const ts = new Date().toLocaleTimeString();
    switch (e.type) {
      case 'phase_change':
        console.log(`\n[${ts}] === 第${e.day}天 ${phaseLabel(e.phase)} ===`);
        break;
      case 'player_speak':
        console.log(`[${ts}] [${e.playerName}] ${e.content}`);
        break;
      case 'wolf_chat':
        console.log(`[${ts}] [狼群·${e.playerName}] ${e.content}`);
        break;
      case 'vote':
        console.log(`[${ts}] ${e.voterId}号 → 投票 ${e.targetId}号`);
        break;
      case 'death':
        console.log(`[${ts}] 💀 ${e.playerName} 死亡（${e.cause}）`);
        break;
      case 'system_message':
        console.log(`[${ts}] [系统] ${e.content}`);
        break;
      case 'action_result':
        console.log(`[${ts}] [上帝] ${e.playerId}号 ${e.action}${e.result ? ': ' + e.result : ''}`);
        break;
      case 'game_over':
        console.log(`\n[${ts}] 🎉 游戏结束！${e.winner === 'werewolf' ? '狼人' : '好人'}阵营获胜！`);
        console.log(`[${ts}] ${e.summary}`);
        break;
    }
  }
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    night_wolves: '🌙 夜晚·狼人行动',
    night_seer: '🌙 夜晚·预言家查验',
    night_witch: '🌙 夜晚·女巫行动',
    day_announce: '☀️ 天亮·公告',
    day_discuss: '☀️ 白天·讨论',
    day_vote: '☀️ 白天·投票',
    day_revote: '☀️ 白天·重新投票',
    check_win: '⚖️ 胜负判定',
    game_over: '🏁 游戏结束',
  };
  return labels[phase] ?? phase;
}

export const eventBus = new GameEventBus();
