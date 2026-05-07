// 谁是卧底 — 游戏主控

import type { Player, GameConfig, WordPair, Role, GameEvent } from './GameState.js';
import { buildSystemPrompt } from './SystemPrompts.js';
import { WORD_PAIRS } from './WordBank.js';
import { UndercoverLogger } from './GameLogger.js';
import { sleep, shuffleArray, majorityVote, isTie } from '../shared/helpers.js';
import type { ChatMessage } from '../ai/AIProvider.js';
import { EventEmitter } from 'node:events';

export class UndercoverGameMaster extends EventEmitter {
  private players: Player[];
  private config: GameConfig;
  private round = 0;
  private wordPair: WordPair;
  private logger: UndercoverLogger;

  constructor(players: Player[], config: GameConfig, wordPair?: WordPair) {
    super();
    this.players = players;
    this.config = config;
    this.wordPair = wordPair ?? WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    this.logger = new UndercoverLogger();
  }

  async run(): Promise<void> {
    this.assignWords();
    this.initPrompts();
    this.emitEvent({
      type: 'game_start',
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      config: this.config,
    });

    while (!this.isGameOver()) {
      this.round++;
      if (this.round > this.config.maxRounds) break;

      this.emitEvent({ type: 'round_start', round: this.round });

      // 描述阶段
      await this.describePhase();

      // 投票阶段
      await this.votePhase();

      // 检查胜负
      if (this.isGameOver()) break;
    }

    this.announceResult();
  }

  private assignWords(): void {
    // 随机选卧底位置
    const indices = Array.from({ length: this.config.playerCount }, (_, i) => i);
    const shuffled = shuffleArray(indices);

    const undercoverIndices = new Set(shuffled.slice(0, this.config.undercoverCount));
    const blankIndices = new Set(
      shuffled.slice(this.config.undercoverCount, this.config.undercoverCount + this.config.blankCount)
    );

    for (let i = 0; i < this.players.length; i++) {
      if (undercoverIndices.has(i)) {
        this.players[i].role = 'undercover';
        this.players[i].word = this.wordPair.undercover;
      } else if (blankIndices.has(i)) {
        this.players[i].role = 'blank';
        this.players[i].word = '（无）';
      } else {
        this.players[i].role = 'civilian';
        this.players[i].word = this.wordPair.civilian;
      }
    }
  }

  private initPrompts(): void {
    for (const player of this.players) {
      const systemPrompt = buildSystemPrompt(player, this.config);
      player.messageHistory = [{ role: 'system', content: systemPrompt }];
    }
  }

  private async describePhase(): Promise<void> {
    const alive = this.getAlivePlayers();
    const descriptions: string[] = [];

    for (const player of alive) {
      const prompt = this.round === 1
        ? '现在是第1轮描述阶段。请用一句话描述你的词，注意不要直接说出词语本身。回复格式：{ "description": "你的描述" }'
        : `现在是第${this.round}轮描述阶段。前面的描述：\n${descriptions.map(d => d).join('\n')}\n\n请用一句话描述你的词。回复格式：{ "description": "你的描述" }`;

      player.messageHistory.push({ role: 'user', content: prompt });

      const response = await this.callPlayer(player);
      const parsed = this.parseDescription(response);

      descriptions.push(`${player.id}号（${player.name}）：${parsed}`);
      this.emitEvent({ type: 'describe', playerId: player.id, playerName: player.name, content: parsed });

      // 把描述广播给所有人
      for (const other of alive) {
        if (other.id !== player.id) {
          other.messageHistory.push({
            role: 'user',
            content: `${player.id}号的描述：${parsed}`,
          });
          other.messageHistory.push({ role: 'assistant', content: '{"acknowledged": true}' });
        }
      }

      player.messageHistory.push({ role: 'assistant', content: JSON.stringify({ description: parsed }) });
    }
  }

  private async votePhase(): Promise<void> {
    const alive = this.getAlivePlayers();
    const votes: { voterId: number; targetId: number }[] = [];

    const votePrompt = `描述阶段结束。现在请投票淘汰你认为最可疑的玩家。\n存活玩家：${alive.map(p => `${p.id}号`).join('、')}\n回复格式：{ "vote": 座位号, "reason": "理由" }`;

    for (const player of alive) {
      player.messageHistory.push({ role: 'user', content: votePrompt });

      const response = await this.callPlayer(player);
      const targetId = this.parseVote(response, player.id, alive);

      votes.push({ voterId: player.id, targetId });
      this.emitEvent({ type: 'vote', voterId: player.id, targetId });

      player.messageHistory.push({ role: 'assistant', content: response });
    }

    // 统计票数
    const targetIds = votes.map(v => v.targetId);
    const eliminated = majorityVote(targetIds);

    if (eliminated != null) {
      const player = this.players.find(p => p.id === eliminated)!;
      player.alive = false;
      this.emitEvent({
        type: 'elimination',
        playerId: player.id,
        playerName: player.name,
        role: player.role,
        word: player.word,
      });
    }
  }

  private isGameOver(): boolean {
    const alive = this.getAlivePlayers();
    const aliveUndercover = alive.filter(p => p.role === 'undercover');
    const aliveCivilians = alive.filter(p => p.role === 'civilian');

    // 卧底全部出局 → 平民胜
    if (aliveUndercover.length === 0) return true;
    // 卧底人数 >= 平民人数 → 卧底胜
    if (aliveUndercover.length >= aliveCivilians.length) return true;

    return false;
  }

  private announceResult(): void {
    const alive = this.getAlivePlayers();
    const aliveUndercover = alive.filter(p => p.role === 'undercover');

    const winner: Role = aliveUndercover.length === 0 ? 'civilian' : 'undercover';
    const summary = winner === 'civilian'
      ? `平民胜利！成功找出所有卧底。词对：平民「${this.wordPair.civilian}」/ 卧底「${this.wordPair.undercover}」`
      : `卧底胜利！成功隐藏到最后。词对：平民「${this.wordPair.civilian}」/ 卧底「${this.wordPair.undercover}」`;

    this.emitEvent({ type: 'game_over', winner, summary });
  }

  private getAlivePlayers(): Player[] {
    return this.players.filter(p => p.alive);
  }

  private async callPlayer(player: Player, maxRetries = 3): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await player.provider.chat(player.messageHistory);
        const content = typeof result === 'string' ? result : result.content;
        if (content && content.trim()) {
          this.logger.logRaw(player.id, player.name, player.messageHistory, content.trim());
          return content.trim();
        }

        if (attempt < maxRetries - 1) {
          player.messageHistory.push({
            role: 'user',
            content: '你的回复为空。请直接输出纯 JSON。',
          });
          await sleep(2000);
        }
      } catch (e) {
        if (attempt < maxRetries - 1) {
          await sleep(3000);
        } else {
          throw e;
        }
      }
    }
    return '{"description": "我保留意见"}';
  }

  private parseDescription(response: string): string {
    try {
      const json = JSON.parse(response);
      return json.description ?? response;
    } catch {
      // 尝试提取引号内容
      const match = response.match(/"description"\s*:\s*"([^"]+)"/);
      return match?.[1] ?? response.slice(0, 50);
    }
  }

  private parseVote(response: string, voterId: number, alive: Player[]): number {
    try {
      const json = JSON.parse(response);
      const target = Number(json.vote);
      if (alive.some(p => p.id === target && p.id !== voterId)) return target;
    } catch {}

    // fallback: 随机投一个
    const others = alive.filter(p => p.id !== voterId);
    return others[Math.floor(Math.random() * others.length)].id;
  }

  private emitEvent(event: GameEvent): void {
    this.logger.logEvent(event);
    this.emit('game-event', event);
  }

  getSessionId(): string {
    return this.logger.getSessionId();
  }
}
