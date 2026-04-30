// GameLogger — 三层日志系统

import { mkdirSync, createWriteStream, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { GameEvent } from '../game/GameState.js';

export class GameLogger {
  private publicStream: WriteStream;
  private godStream: WriteStream;
  private rawStream: WriteStream;
  private sessionId: string;

  constructor(logsDir = 'logs') {
    mkdirSync(logsDir, { recursive: true });
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    this.publicStream = createWriteStream(join(logsDir, `game-${this.sessionId}.public.log`));
    this.godStream = createWriteStream(join(logsDir, `game-${this.sessionId}.god.jsonl`));
    this.rawStream = createWriteStream(join(logsDir, `game-${this.sessionId}.raw.jsonl`));
  }

  // 记录游戏事件（自动分流到 public 和 god）
  logEvent(event: GameEvent): void {
    const ts = new Date().toISOString();

    // god.jsonl — 所有事件，含私密信息
    this.godStream.write(JSON.stringify({ ts, ...event }) + '\n');

    // public.log — 只记录公开信息
    const publicLine = this.formatPublicEvent(event);
    if (publicLine) {
      this.publicStream.write(`[${ts.slice(11, 19)}] ${publicLine}\n`);
    }
  }

  // 记录原始 API 请求/响应
  logRaw(playerId: number, playerName: string, messages: unknown[], response: string, reasoning?: string): void {
    this.rawStream.write(JSON.stringify({
      ts: new Date().toISOString(),
      playerId,
      playerName,
      promptLength: JSON.stringify(messages).length,
      responseLength: response.length,
      response,
      ...(reasoning ? { reasoning } : {}),
    }) + '\n');
  }

  close(): void {
    this.publicStream.end();
    this.godStream.end();
    this.rawStream.end();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  private formatPublicEvent(e: GameEvent): string | null {
    switch (e.type) {
      case 'phase_change':
        return `=== 第${e.day}天 ${phaseLabel(e.phase)} ===`;
      case 'player_speak':
        return `[${e.playerName}] ${e.content}`;
      case 'wolf_chat':
        return null; // 狼人密聊不进公开日志
      case 'vote':
        return `${e.voterId}号 → 投票 ${e.targetId}号`;
      case 'death':
        return `${e.playerName} 死亡（${e.cause}）`;
      case 'action_result':
        return e.private ? null : `[行动] ${e.action}`;
      case 'system_message':
        return `[系统] ${e.content}`;
      case 'game_over':
        return `游戏结束！${e.winner === 'werewolf' ? '狼人' : '好人'}阵营获胜！${e.summary}`;
      default:
        return null;
    }
  }
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    night_wolves: '夜晚·狼人行动',
    night_seer: '夜晚·预言家查验',
    night_witch: '夜晚·女巫行动',
    day_announce: '天亮·公告',
    day_discuss: '白天·讨论',
    day_vote: '白天·投票',
    day_revote: '白天·重新投票',
    game_over: '游戏结束',
  };
  return labels[phase] ?? phase;
}
