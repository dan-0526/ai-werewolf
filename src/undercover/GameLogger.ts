// 谁是卧底 — 日志系统

import { mkdirSync, createWriteStream, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { GameEvent } from './GameState.js';

export class UndercoverLogger {
  private publicStream: WriteStream;
  private godStream: WriteStream;
  private rawStream: WriteStream;
  private sessionId: string;

  constructor(logsDir = 'logs/undercover') {
    mkdirSync(logsDir, { recursive: true });
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    this.publicStream = createWriteStream(join(logsDir, `game-${this.sessionId}.public.log`));
    this.godStream = createWriteStream(join(logsDir, `game-${this.sessionId}.god.jsonl`));
    this.rawStream = createWriteStream(join(logsDir, `game-${this.sessionId}.raw.jsonl`));
  }

  logEvent(event: GameEvent): void {
    const ts = new Date().toISOString();
    this.godStream.write(JSON.stringify({ ts, ...event }) + '\n');

    const publicLine = this.formatPublicEvent(event);
    if (publicLine) {
      this.publicStream.write(`[${ts.slice(11, 19)}] ${publicLine}\n`);
    }
  }

  logRaw(playerId: number, playerName: string, messages: unknown[], response: string): void {
    this.rawStream.write(JSON.stringify({
      ts: new Date().toISOString(),
      playerId,
      playerName,
      promptLength: JSON.stringify(messages).length,
      responseLength: response.length,
      response,
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
      case 'game_start':
        return `游戏开始！${e.config.playerCount}人局，${e.config.undercoverCount}卧底`;
      case 'round_start':
        return `=== 第${e.round}轮 ===`;
      case 'describe':
        return `[${e.playerName}] ${e.content}`;
      case 'vote':
        return `${e.voterId}号 → 投票 ${e.targetId}号`;
      case 'elimination':
        return `${e.playerName} 被淘汰（${e.role}）`;
      case 'game_over':
        return `游戏结束！${e.summary}`;
      default:
        return null;
    }
  }
}
