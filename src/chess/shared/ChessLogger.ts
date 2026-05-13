import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WSEvent, Side } from './types.js';

export class ChessLogger {
  private logDir: string;
  private publicPath: string;
  private godPath: string;
  private rawPath: string;

  constructor(baseDir: string, matchId: string) {
    this.logDir = join(baseDir, 'logs', matchId);
    mkdirSync(this.logDir, { recursive: true });

    this.publicPath = join(this.logDir, 'public.log');
    this.godPath = join(this.logDir, 'god.jsonl');
    this.rawPath = join(this.logDir, 'raw.jsonl');

    // Initialize empty files
    writeFileSync(this.publicPath, '');
    writeFileSync(this.godPath, '');
    writeFileSync(this.rawPath, '');
  }

  getLogDir(): string {
    return this.logDir;
  }

  getGodPath(): string {
    return this.godPath;
  }

  logPublic(message: string): void {
    appendFileSync(this.publicPath, message + '\n');
  }

  logEvent(event: WSEvent): void {
    appendFileSync(this.godPath, JSON.stringify(event) + '\n');
  }

  logRaw(data: { player: string; side: Side; messages: unknown[]; response: string }): void {
    appendFileSync(this.rawPath, JSON.stringify(data) + '\n');
  }

  logGameStart(gameNum: number, red: string, black: string): void {
    const separator = '='.repeat(40);
    this.logPublic(`${separator}`);
    this.logPublic(`第 ${gameNum} 局  红方: ${red}  黑方: ${black}`);
    this.logPublic(`${separator}`);
  }

  logMove(moveNum: number, side: Side, notation: string, thinking?: string): void {
    const sideLabel = side === 'red' ? '红' : '黑';
    let line = `${moveNum}. [${sideLabel}] ${notation}`;
    if (thinking) {
      line += `  (${thinking})`;
    }
    this.logPublic(line);
  }

  logGameEnd(gameNum: number, winner: Side | 'draw', reason: string, score: Record<string, number>): void {
    const winnerLabel = winner === 'draw' ? '和棋' : winner === 'red' ? '红方胜' : '黑方胜';
    this.logPublic('');
    this.logPublic(`第 ${gameNum} 局结束: ${winnerLabel} (${reason})`);
    const scoreStr = Object.entries(score).map(([k, v]) => `${k}: ${v}`).join('  ');
    this.logPublic(`当前比分: ${scoreStr}`);
    this.logPublic('');
  }
}
