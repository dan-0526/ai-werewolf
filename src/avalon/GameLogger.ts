// 阿瓦隆 — 日志系统

import { mkdirSync, createWriteStream, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { GameEvent } from './GameState.js';
import { ROLE_NAMES_CN } from './RoleConfigs.js';

export class AvalonLogger {
  private publicStream: WriteStream;
  private godStream: WriteStream;
  private rawStream: WriteStream;
  private sessionId: string;

  constructor(logsDir = 'logs/avalon') {
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
        return `游戏开始！${e.config.playerCount}人局`;
      case 'roles_assigned':
        return null; // 上帝视角
      case 'round_start':
        return `=== 第${e.round}轮任务 === 队长：${e.leaderId}号 | 需要${e.missionSize}人`;
      case 'discussion':
        return `[${e.playerName}] ${e.content}`;
      case 'propose_team':
        return `队长${e.leaderId}号提名：${e.team.map(id => `${id}号`).join('、')}`;
      case 'team_vote': {
        const approves = e.votes.filter(v => v.approve).map(v => v.playerName);
        const rejects = e.votes.filter(v => !v.approve).map(v => v.playerName);
        return `投票结果：${e.approved ? '通过' : '否决'} | 赞成：${approves.join('、')} | 反对：${rejects.join('、')}`;
      }
      case 'team_rejected':
        return `组队被否决（第${e.rejectCount}次）`;
      case 'mission_result':
        return `任务${e.round}结果：${e.passed ? '✅ 成功' : '❌ 失败'}（${e.successes}成功/${e.fails}失败）`;
      case 'lady_inspect':
        return `湖中女士：${e.inspectorName} 查验了 ${e.targetName}`;
      case 'assassinate':
        return `刺客指认 ${e.targetName} 为梅林 → ${e.isMerlin ? '猜对！坏人翻盘！' : '猜错！好人获胜！'}`;
      case 'game_over':
        return `游戏结束！${e.winner === 'good' ? '好人' : '坏人'}获胜 — ${e.reason}`;
      default:
        return null;
    }
  }
}
