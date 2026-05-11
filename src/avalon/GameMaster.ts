// 阿瓦隆 — 游戏主控

import type { Player, GameConfig, Faction, GameEvent } from './GameState.js';
import { buildSystemPrompt } from './SystemPrompts.js';
import { ROLE_NAMES_CN } from './RoleConfigs.js';
import { AvalonLogger } from './GameLogger.js';
import { sleep, shuffleArray } from '../shared/helpers.js';
import { EventEmitter } from 'node:events';

export class AvalonGameMaster extends EventEmitter {
  private players: Player[];
  private config: GameConfig;
  private logger: AvalonLogger;
  private missionResults: boolean[] = []; // true=成功, false=失败
  private currentLeaderIdx = 0;
  private rejectCount = 0;
  private ladyHolderId: number | null = null;
  private ladyUsedBy: Set<number> = new Set();

  constructor(players: Player[], config: GameConfig) {
    super();
    this.players = players;
    this.config = config;
    this.logger = new AvalonLogger();
  }

  async run(): Promise<void> {
    this.initPrompts();
    this.emitEvent({
      type: 'game_start',
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      config: this.config,
    });
    this.emitEvent({
      type: 'roles_assigned',
      assignments: this.players.map(p => ({ id: p.id, name: p.name, role: p.role, faction: p.faction })),
    });

    // 随机起始队长
    this.currentLeaderIdx = Math.floor(Math.random() * this.players.length);
    // 湖中女士初始持有者：队长左边的人
    if (this.config.ladyOfLake) {
      this.ladyHolderId = this.players[(this.currentLeaderIdx + this.players.length - 1) % this.players.length].id;
    }

    // 主循环：5轮任务
    for (let round = 0; round < 5; round++) {
      const leader = this.players[this.currentLeaderIdx];
      const missionSize = this.config.missionSizes[round];

      this.emitEvent({ type: 'round_start', round: round + 1, leaderId: leader.id, missionSize });

      // 讨论阶段
      await this.discussionPhase(round + 1);

      // 组队循环（最多5次否决）
      const team = await this.proposeAndVoteLoop(missionSize);
      if (!team) {
        // 连续5次否决，坏人赢
        this.emitEvent({ type: 'game_over', winner: 'evil', reason: '连续5次组队被否决' });
        return;
      }

      // 出征
      const passed = await this.missionPhase(round + 1, team);
      this.missionResults.push(passed);

      // 检查胜负
      const successes = this.missionResults.filter(r => r).length;
      const failures = this.missionResults.filter(r => !r).length;

      if (failures >= 3) {
        this.emitEvent({ type: 'game_over', winner: 'evil', reason: '3次任务失败' });
        return;
      }

      if (successes >= 3) {
        // 好人3次成功，进入刺杀阶段
        const assassinated = await this.assassinatePhase();
        if (assassinated) {
          this.emitEvent({ type: 'game_over', winner: 'evil', reason: '刺客成功刺杀梅林' });
        } else {
          this.emitEvent({ type: 'game_over', winner: 'good', reason: '3次任务成功且梅林存活' });
        }
        return;
      }

      // 湖中女士（第2轮任务结束后开始）
      if (this.config.ladyOfLake && round >= 1 && round < 4) {
        await this.ladyOfLakePhase();
      }

      // 队长轮转
      this.currentLeaderIdx = (this.currentLeaderIdx + 1) % this.players.length;
    }
  }

  // --- 初始化 ---

  private initPrompts(): void {
    for (const player of this.players) {
      const systemPrompt = buildSystemPrompt(player, this.players, this.config);
      player.messageHistory = [{ role: 'system', content: systemPrompt }];
    }
  }

  // --- 讨论阶段 ---

  private async discussionPhase(round: number): Promise<void> {
    for (let r = 0; r < this.config.discussionRounds; r++) {
      const context = this.buildDiscussionContext(round, r + 1);
      for (const player of this.players) {
        const prompt = r === 0 && round === 1
          ? `第1轮任务讨论开始。${context}\n请发表你的看法。回复格式：{ "speech": "你的发言" }`
          : `${context}\n请发表你的看法。回复格式：{ "speech": "你的发言" }`;

        player.messageHistory.push({ role: 'user', content: prompt });
        const response = await this.callPlayer(player);
        const speech = this.parseSpeech(response);

        this.emitEvent({ type: 'discussion', playerId: player.id, playerName: player.name, content: speech });
        player.messageHistory.push({ role: 'assistant', content: JSON.stringify({ speech }) });

        // 广播给其他人
        for (const other of this.players) {
          if (other.id !== player.id) {
            other.messageHistory.push({ role: 'user', content: `${player.id}号（${player.name}）说：${speech}` });
            other.messageHistory.push({ role: 'assistant', content: '{"acknowledged": true}' });
          }
        }
      }
    }
  }

  private buildDiscussionContext(round: number, discussionRound: number): string {
    const parts: string[] = [];
    parts.push(`当前是第${round}轮任务，讨论第${discussionRound}轮。`);
    if (this.missionResults.length > 0) {
      const history = this.missionResults.map((r, i) => `第${i + 1}轮：${r ? '成功' : '失败'}`).join('，');
      parts.push(`历史任务结果：${history}`);
    }
    parts.push(`当前队长：${this.players[this.currentLeaderIdx].id}号，需要选${this.config.missionSizes[this.missionResults.length]}人出征。`);
    return parts.join('\n');
  }

  // --- 组队投票循环 ---

  private async proposeAndVoteLoop(missionSize: number): Promise<number[] | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const leader = this.players[this.currentLeaderIdx];

      // 队长提名
      const proposePrompt = `你是本轮队长。请提名${missionSize}名玩家出征（可以包括你自己）。\n存活玩家：${this.players.map(p => `${p.id}号`).join('、')}\n回复格式：{ "team": [座位号数组], "reason": "理由" }`;
      leader.messageHistory.push({ role: 'user', content: proposePrompt });
      const proposeResponse = await this.callPlayer(leader);
      const team = this.parseTeam(proposeResponse, missionSize);
      leader.messageHistory.push({ role: 'assistant', content: proposeResponse });

      this.emitEvent({ type: 'propose_team', leaderId: leader.id, team });

      // 广播提名
      for (const p of this.players) {
        if (p.id !== leader.id) {
          p.messageHistory.push({ role: 'user', content: `队长${leader.id}号提名了：${team.map(id => `${id}号`).join('、')}` });
          p.messageHistory.push({ role: 'assistant', content: '{"acknowledged": true}' });
        }
      }

      // 全员投票
      const votePrompt = `队长${leader.id}号提名了 ${team.map(id => `${id}号`).join('、')} 出征。你是否同意这个队伍？\n回复格式：{ "approve": true/false, "reason": "理由" }`;
      const votes: { playerId: number; playerName: string; approve: boolean }[] = [];

      for (const player of this.players) {
        player.messageHistory.push({ role: 'user', content: votePrompt });
        const voteResponse = await this.callPlayer(player);
        const approve = this.parseVote(voteResponse);
        votes.push({ playerId: player.id, playerName: player.name, approve });
        player.messageHistory.push({ role: 'assistant', content: voteResponse });
      }

      const approveCount = votes.filter(v => v.approve).length;
      const approved = approveCount > this.players.length / 2;

      this.emitEvent({ type: 'team_vote', votes, approved });

      // 广播投票结果
      const voteResultMsg = `投票结果：${approved ? '通过' : '否决'}（${approveCount}/${this.players.length}）`;
      for (const p of this.players) {
        p.messageHistory.push({ role: 'user', content: voteResultMsg });
        p.messageHistory.push({ role: 'assistant', content: '{"acknowledged": true}' });
      }

      if (approved) {
        this.rejectCount = 0;
        return team;
      }

      this.rejectCount++;
      this.emitEvent({ type: 'team_rejected', rejectCount: this.rejectCount });
      // 队长轮转
      this.currentLeaderIdx = (this.currentLeaderIdx + 1) % this.players.length;
    }

    return null; // 5次否决
  }

  // --- 出征阶段 ---

  private async missionPhase(round: number, team: number[]): Promise<boolean> {
    const failsNeeded = this.config.doubleFail === round - 1 ? 2 : 1;
    let successes = 0;
    let fails = 0;

    for (const playerId of team) {
      const player = this.players.find(p => p.id === playerId)!;
      const isEvil = player.faction === 'evil';

      if (!isEvil) {
        // 好人只能出成功
        successes++;
        player.messageHistory.push({ role: 'user', content: '你被选入出征队伍。作为好人，你只能出成功牌。' });
        player.messageHistory.push({ role: 'assistant', content: '{"action": "success"}' });
      } else {
        // 坏人可以选择
        const missionPrompt = `你被选入出征队伍。作为坏人，你可以选择出"success"（伪装）或"fail"（搞破坏）。\n当前任务成绩：${this.missionResults.filter(r => r).length}成功/${this.missionResults.filter(r => !r).length}失败\n${failsNeeded > 1 ? '注意：本轮需要2张失败牌才算任务失败。' : ''}\n回复格式：{ "action": "success" 或 "fail" }`;
        player.messageHistory.push({ role: 'user', content: missionPrompt });
        const response = await this.callPlayer(player);
        const action = this.parseMissionAction(response);
        player.messageHistory.push({ role: 'assistant', content: response });

        if (action === 'fail') fails++;
        else successes++;
      }
    }

    const passed = fails < failsNeeded;
    this.emitEvent({ type: 'mission_result', round, successes, fails, passed });

    // 广播任务结果
    const resultMsg = `第${round}轮任务结果：${passed ? '成功' : '失败'}（${fails}张失败牌）`;
    for (const p of this.players) {
      p.messageHistory.push({ role: 'user', content: resultMsg });
      p.messageHistory.push({ role: 'assistant', content: '{"acknowledged": true}' });
    }

    return passed;
  }

  // --- 湖中女士 ---

  private async ladyOfLakePhase(): Promise<void> {
    if (this.ladyHolderId == null) return;
    const holder = this.players.find(p => p.id === this.ladyHolderId)!;
    this.ladyUsedBy.add(holder.id);

    const validTargets = this.players.filter(p => p.id !== holder.id && !this.ladyUsedBy.has(p.id));
    if (validTargets.length === 0) return;

    const prompt = `你持有湖中女士。你可以查验一名玩家的阵营（好人/坏人）。\n可选目标：${validTargets.map(p => `${p.id}号`).join('、')}\n回复格式：{ "target": 座位号, "reason": "理由" }`;
    holder.messageHistory.push({ role: 'user', content: prompt });
    const response = await this.callPlayer(holder);
    const targetId = this.parseLadyTarget(response, validTargets.map(p => p.id));
    holder.messageHistory.push({ role: 'assistant', content: response });

    const target = this.players.find(p => p.id === targetId)!;
    const result: Faction = target.faction;

    // 告知持有者结果
    holder.messageHistory.push({ role: 'user', content: `查验结果：${targetId}号是${result === 'good' ? '好人' : '坏人'}。你可以选择如实公布或说谎。` });
    holder.messageHistory.push({ role: 'assistant', content: '{"acknowledged": true}' });

    this.emitEvent({ type: 'lady_inspect', inspectorId: holder.id, inspectorName: holder.name, targetId, targetName: target.name, result });

    // 湖中女士转移给被查验的人
    this.ladyHolderId = targetId;
  }

  // --- 刺杀梅林 ---

  private async assassinatePhase(): Promise<boolean> {
    const assassin = this.players.find(p => p.role === 'assassin');
    if (!assassin) return false;

    const prompt = `好人已经完成3次任务成功！但作为刺客，你有最后一次机会——指认梅林。如果你猜对了，坏人翻盘获胜。\n所有玩家：${this.players.map(p => `${p.id}号（${p.name}）`).join('、')}\n回复格式：{ "target": 座位号, "reason": "理由" }`;
    assassin.messageHistory.push({ role: 'user', content: prompt });
    const response = await this.callPlayer(assassin);
    const targetId = this.parseAssassinTarget(response);
    assassin.messageHistory.push({ role: 'assistant', content: response });

    const target = this.players.find(p => p.id === targetId)!;
    const isMerlin = target.role === 'merlin';

    this.emitEvent({ type: 'assassinate', assassinId: assassin.id, targetId, targetName: target.name, isMerlin });
    return isMerlin;
  }

  // --- AI 调用 ---

  private async callPlayer(player: Player, maxRetries = 5): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`  [${player.name}] calling...`);
        const result = await player.provider.chat(player.messageHistory);
        const content = typeof result === 'string' ? result : result.content;
        if (content && content.trim()) {
          this.logger.logRaw(player.id, player.name, player.messageHistory, content.trim());
          return content.trim();
        }
        if (attempt < maxRetries - 1) {
          console.warn(`  [RETRY] ${player.name} 返回空内容，第${attempt + 1}次重试...`);
          player.messageHistory.push({ role: 'user', content: '你的回复为空。请直接输出纯 JSON。' });
          await sleep(2000 * (attempt + 1));
        }
      } catch (e: any) {
        if (attempt < maxRetries - 1) {
          console.warn(`  [RETRY] ${player.name} 第${attempt + 1}次重试 (${e.message?.slice(0, 50)})`);
          await sleep(3000 * (attempt + 1));
        } else {
          console.error(`  [FAIL] ${player.name} ${maxRetries}次重试后仍失败，使用默认回复`);
          return '{"speech": "我暂时没有意见"}';
        }
      }
    }
    return '{"speech": "我暂时没有意见"}';
  }

  // --- 解析器 ---

  private parseSpeech(response: string): string {
    try {
      const json = JSON.parse(response);
      return json.speech ?? response;
    } catch {
      const match = response.match(/"speech"\s*:\s*"([^"]+)"/);
      return match?.[1] ?? response.slice(0, 100);
    }
  }

  private parseTeam(response: string, size: number): number[] {
    try {
      const json = JSON.parse(response);
      const team = json.team;
      if (Array.isArray(team) && team.length === size) {
        const valid = team.map(Number).filter(id => this.players.some(p => p.id === id));
        if (valid.length === size) return valid;
      }
    } catch {}
    // fallback: 随机选
    const shuffled = shuffleArray(this.players.map(p => p.id));
    return shuffled.slice(0, size);
  }

  private parseVote(response: string): boolean {
    try {
      const json = JSON.parse(response);
      return json.approve === true;
    } catch {
      return response.includes('true');
    }
  }

  private parseMissionAction(response: string): 'success' | 'fail' {
    try {
      const json = JSON.parse(response);
      return json.action === 'fail' ? 'fail' : 'success';
    } catch {
      return response.includes('fail') ? 'fail' : 'success';
    }
  }

  private parseLadyTarget(response: string, validIds: number[]): number {
    try {
      const json = JSON.parse(response);
      const target = Number(json.target);
      if (validIds.includes(target)) return target;
    } catch {}
    return validIds[Math.floor(Math.random() * validIds.length)];
  }

  private parseAssassinTarget(response: string): number {
    try {
      const json = JSON.parse(response);
      const target = Number(json.target);
      if (this.players.some(p => p.id === target)) return target;
    } catch {}
    // fallback: 随机选一个好人
    const goodPlayers = this.players.filter(p => p.faction === 'good');
    return goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id;
  }

  // --- 事件 ---

  private emitEvent(event: GameEvent): void {
    this.logger.logEvent(event);
    this.emit('game-event', event);
  }

  getSessionId(): string {
    return this.logger.getSessionId();
  }
}