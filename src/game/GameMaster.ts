// GameMaster — 游戏主控状态机

import type {
  GameState, Player, RoleName, Phase, GameRules,
  NightActions, GameAction, ParsedResponse,
} from './GameState.js';
import { getAlivePlayers, getAliveWolves, getPlayerById, getFaction } from './GameState.js';
import { checkWin } from './WinChecker.js';
import { eventBus } from '../server/GameEventBus.js';
import { buildSystemPrompt } from '../prompt/SystemPrompts.js';
import { parseResponse } from '../prompt/ResponseParser.js';
import { sleep, shuffleArray, majorityVote, isTie } from '../utils/helpers.js';
import { GameLogger } from '../utils/GameLogger.js';
import type { ChatMessage } from '../ai/AIProvider.js';

// --- GameMaster class ---

export interface GameMasterConfig {
  players: Player[];
  rules: GameRules;
  speakDelayMs: number;
  discussionRounds: number;
  wolfChatRounds: number;
  logger?: GameLogger;
}

export class GameMaster {
  private state: GameState;
  private config: GameMasterConfig;
  private logger?: GameLogger;

  constructor(config: GameMasterConfig) {
    this.config = config;
    this.logger = config.logger;
    this.state = {
      day: 0,
      phase: 'init',
      players: config.players,
      nightActions: this.emptyNightActions(),
      witchPotions: { heal: true, poison: true },
      voteHistory: [],
      deathsTonight: [],
      rules: config.rules,
    };

    // 初始化每个玩家的 system prompt
    for (const player of this.state.players) {
      const systemPrompt = buildSystemPrompt(player, this.state.players, this.state.rules);
      player.messageHistory = [{ role: 'system', content: systemPrompt }];
    }
  }

  getPublicState() {
    return {
      day: this.state.day,
      phase: this.state.phase,
      players: this.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        modelName: p.modelName,
        alive: p.alive,
        role: p.role, // 上帝视角
        faction: p.faction,
        causeOfDeath: p.causeOfDeath,
      })),
    };
  }

  // 主循环
  async run(): Promise<void> {
    eventBus.emit('game-event', { type: 'system_message', content: '游戏开始！' });

    const MAX_DAYS = 20;

    while (true) {
      this.state.day++;
      if (this.state.day > MAX_DAYS) {
        eventBus.emit('game-event', {
          type: 'game_over',
          winner: 'werewolf',
          summary: `游戏超过${MAX_DAYS}天未分出胜负，判定狼人阵营获胜。`,
        });
        break;
      }
      this.state.nightActions = this.emptyNightActions();
      this.state.deathsTonight = [];

      // 夜晚阶段
      await this.nightPhase();

      // 天亮公告
      const winAfterNight = await this.dayAnnounce();
      if (winAfterNight) break;

      // 白天讨论
      await this.dayDiscuss();

      // 白天投票
      await this.dayVote();

      // 胜负判定
      const winResult = checkWin(this.state);
      if (winResult.gameOver) {
        this.state.phase = 'game_over';
        eventBus.emit('game-event', {
          type: 'game_over',
          winner: winResult.winner!,
          summary: winResult.reason!,
        });
        break;
      }
    }

    // 复盘鞭尸模式
    await this.postGameReview();
  }

  // === 复盘：身份揭晓 + MVP/最差投票 + 当事人回应 ===

  private async postGameReview(): Promise<void> {
    eventBus.emit('game-event', { type: 'system_message', content: '=== 复盘时间 · 身份揭晓 ===' });

    // 构建身份揭晓信息
    const roleNames: Record<string, string> = {
      werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', villager: '村民',
    };
    const reveal = this.state.players.map((p) =>
      `${p.id}号（${p.name}）：${roleNames[p.role]}${p.alive ? '' : '（已死亡）'}`,
    ).join('\n');

    const reviewPrompt = `游戏结束了！以下是所有玩家的真实身份：

${reveal}

现在是复盘时间。请你回顾整局游戏，评选：
1. MVP（全场最佳玩家）：谁的表现最出色？为什么？
2. 最差玩家：谁的表现最拉胯？为什么？

你可以夸夸表现好的，也可以吐槽表现差的。有冤报冤，有仇报仇。
请用 JSON 格式回复：
{
  "speech": "你的公开评价（其他玩家能看到）",
  "mvp": 座位号（数字）,
  "worst": 座位号（数字）
}`;

    // 收集所有评价和投票
    const mvpVotes: number[] = [];
    const worstVotes: number[] = [];
    const allSpeeches: string[] = [];

    for (const player of this.state.players) {
      const response = await this.askPlayer(player, reviewPrompt);
      const parsed = parseResponse(response);

      // 提取 mvp/worst 投票
      const raw = response.match(/\{[\s\S]*\}/);
      if (raw) {
        try {
          const obj = JSON.parse(raw[0]);
          if (typeof obj.mvp === 'number') mvpVotes.push(obj.mvp);
          if (typeof obj.worst === 'number') worstVotes.push(obj.worst);
        } catch { /* 解析失败忽略 */ }
      }

      const speechText = `${player.id}号（${player.name}）：${parsed.speech}`;
      allSpeeches.push(speechText);

      eventBus.emit('game-event', {
        type: 'player_speak',
        playerId: player.id,
        playerName: player.name,
        content: `[复盘] ${parsed.speech}`,
        privateNote: parsed.privateNote,
      });

      await sleep(this.config.speakDelayMs);
    }

    // 统计票数：取最高票玩家，全散票（每人都只有1票）则跳过，平票则都发言
    const mvpIds = this.tallyTopVotes(mvpVotes);
    const worstIds = this.tallyTopVotes(worstVotes);

    // 当事人回应
    if (mvpIds.length > 0 || worstIds.length > 0) {
      eventBus.emit('game-event', { type: 'system_message', content: '=== MVP & 最差玩家回应 ===' });

      const allSpeechesText = allSpeeches.join('\n');

      for (const id of mvpIds) {
        const player = getPlayerById(this.state, id);
        if (player) {
          const count = mvpVotes.filter((v) => v === id).length;
          await this.reviewResponse(player, 'mvp', count, allSpeechesText);
        }
      }

      for (const id of worstIds) {
        const player = getPlayerById(this.state, id);
        if (player) {
          const count = worstVotes.filter((v) => v === id).length;
          await this.reviewResponse(player, 'worst', count, allSpeechesText);
        }
      }
    }

    eventBus.emit('game-event', { type: 'system_message', content: '=== 复盘结束 ===' });
  }

  private async reviewResponse(
    player: Player,
    type: 'mvp' | 'worst',
    voteCount: number,
    allSpeeches: string,
  ): Promise<void> {
    const label = type === 'mvp' ? 'MVP（全场最佳）' : '最差玩家';
    const prompt = `复盘投票结果出来了，你被评为本局的【${label}】，获得了 ${voteCount} 票。

以下是所有玩家的复盘评价：
${allSpeeches}

现在轮到你回应。你可以发表获奖感言、为自己辩解、反驳别人的评价，随你发挥。
请用 JSON 回复：{ "speech": "你的公开回应" }`;

    const response = await this.askPlayer(player, prompt);
    const parsed = parseResponse(response);

    const tag = type === 'mvp' ? '👑 MVP回应' : '💀 最差玩家回应';

    eventBus.emit('game-event', {
      type: 'player_speak',
      playerId: player.id,
      playerName: player.name,
      content: `[${tag}] ${parsed.speech}`,
      privateNote: parsed.privateNote,
    });

    await sleep(this.config.speakDelayMs);
  }

  /** 统计投票，返回最高票玩家 ID 列表。全散票（最高票仅 1 票）返回空数组，平票返回所有并列者 */
  private tallyTopVotes(votes: number[]): number[] {
    if (votes.length === 0) return [];
    const counts = new Map<number, number>();
    for (const v of votes) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const maxCount = Math.max(...counts.values());
    if (maxCount <= 1) return [];
    return [...counts.entries()].filter(([, c]) => c === maxCount).map(([id]) => id);
  }

  // === 夜晚阶段 ===

  private async nightPhase(): Promise<void> {
    // 狼人行动
    this.state.phase = 'night_wolves';
    eventBus.emit('game-event', { type: 'phase_change', phase: 'night_wolves', day: this.state.day });
    await this.wolfAction();

    // 预言家行动
    this.state.phase = 'night_seer';
    eventBus.emit('game-event', { type: 'phase_change', phase: 'night_seer', day: this.state.day });
    await this.seerAction();

    // 女巫行动
    this.state.phase = 'night_witch';
    eventBus.emit('game-event', { type: 'phase_change', phase: 'night_witch', day: this.state.day });
    await this.witchAction();
  }

  private async wolfAction(): Promise<void> {
    const wolves = getAliveWolves(this.state);
    if (wolves.length === 0) return;

    const alivePlayers = getAlivePlayers(this.state);
    const aliveNonWolves = alivePlayers.filter((p) => p.role !== 'werewolf');
    const targetList = aliveNonWolves.map((p) => `${p.id}号`).join('、');

    // 狼人小群聊
    const wolfChatHistory: string[] = [];
    for (let round = 0; round < this.config.wolfChatRounds; round++) {
      for (const wolf of wolves) {
        const chatContext = wolfChatHistory.length > 0
          ? `\n之前的讨论：\n${wolfChatHistory.join('\n')}`
          : '';

        const prompt = `现在是第${this.state.day}天夜晚，狼人行动时间。${chatContext}\n\n存活的非狼人玩家：${targetList}\n\n请和队友讨论今晚要杀谁，并给出你的投票。\n请用 JSON 回复：{ "speech": "你对队友说的话" }`;

        const response = await this.askPlayer(wolf, prompt);
        const parsed = parseResponse(response);

        wolfChatHistory.push(`${wolf.id}号：${parsed.speech}`);
        eventBus.emit('game-event', {
          type: 'wolf_chat',
          playerId: wolf.id,
          playerName: wolf.name,
          content: parsed.speech,
        });

        await sleep(this.config.speakDelayMs);
      }
    }

    // 狼人投票
    const votes: number[] = [];
    for (const wolf of wolves) {
      const votePrompt = `讨论结束，请投票选择今晚要杀的目标。存活的非狼人玩家：${targetList}\n请用 JSON 回复：{ "action": { "type": "vote", "target": 座位号 } }`;
      const response = await this.askPlayer(wolf, votePrompt);
      const parsed = parseResponse(response);

      if (parsed.action.type === 'vote' && parsed.action.target != null) {
        const target = getPlayerById(this.state, parsed.action.target);
        if (target && target.alive && target.role !== 'werewolf') {
          votes.push(parsed.action.target);
        }
      }
    }

    this.state.nightActions.wolfTarget = majorityVote(votes);
  }

  private async seerAction(): Promise<void> {
    const seer = this.state.players.find((p) => p.role === 'seer' && p.alive);
    if (!seer) return;

    const alivePlayers = getAlivePlayers(this.state).filter((p) => p.id !== seer.id);
    const targetList = alivePlayers.map((p) => `${p.id}号`).join('、');

    const prompt = `现在是第${this.state.day}天夜晚，预言家查验时间。\n存活玩家（除你自己）：${targetList}\n请选择一名玩家查验身份。\n请用 JSON 回复：{ "action": { "type": "check", "target": 座位号 } }`;

    const response = await this.askPlayer(seer, prompt);
    const parsed = parseResponse(response);

    if (parsed.action.type === 'check' && parsed.action.target != null) {
      const target = getPlayerById(this.state, parsed.action.target);
      if (target && target.alive) {
        this.state.nightActions.seerTarget = target.id;
        const isGood = target.faction === 'villager';
        this.state.nightActions.seerResult = isGood;

        // 告知预言家结果（私有信息）
        const resultMsg = `查验结果：${target.id}号玩家是【${isGood ? '好人' : '狼人'}】。`;
        this.addPrivateMessage(seer, resultMsg);
        eventBus.emit('game-event', {
          type: 'action_result',
          playerId: seer.id,
          action: 'check',
          result: resultMsg,
          private: true,
        });
      }
    }
  }

  private async witchAction(): Promise<void> {
    const witch = this.state.players.find((p) => p.role === 'witch' && p.alive);
    if (!witch) return;

    const { witchPotions, nightActions } = this.state;
    const killedId = nightActions.wolfTarget;
    const killedPlayer = killedId != null ? getPlayerById(this.state, killedId) : null;

    // 解药
    if (witchPotions.heal && killedPlayer) {
      const canSelfHeal = this.state.rules.witchFirstNightSelfHeal || this.state.day > 1;
      const isSelf = killedPlayer.id === witch.id;

      if (!isSelf || canSelfHeal) {
        const healPrompt = `现在是第${this.state.day}天夜晚，女巫行动时间。\n今晚 ${killedPlayer.id}号玩家被狼人杀害。\n你还有解药，是否使用解药救他？\n请用 JSON 回复：{ "action": { "type": "heal" } } 或 { "action": { "type": "skip" } }`;

        const response = await this.askPlayer(witch, healPrompt);
        const parsed = parseResponse(response);

        if (parsed.action.type === 'heal') {
          nightActions.witchHeal = true;
          witchPotions.heal = false;
          eventBus.emit('game-event', {
            type: 'action_result',
            playerId: witch.id,
            action: 'heal',
            private: true,
          });
        }
      }
    }

    // 毒药（如果没有同夜使用解药，或规则允许同夜使用）
    if (witchPotions.poison && (this.state.rules.witchSameNightHealPoison || !nightActions.witchHeal)) {
      const alivePlayers = getAlivePlayers(this.state).filter((p) => p.id !== witch.id);
      const targetList = alivePlayers.map((p) => `${p.id}号`).join('、');

      const poisonPrompt = `你还有毒药。存活玩家：${targetList}\n是否使用毒药？\n请用 JSON 回复：{ "action": { "type": "poison", "target": 座位号 } } 或 { "action": { "type": "skip" } }`;

      const response = await this.askPlayer(witch, poisonPrompt);
      const parsed = parseResponse(response);

      if (parsed.action.type === 'poison' && parsed.action.target != null) {
        const target = getPlayerById(this.state, parsed.action.target);
        if (target && target.alive && target.id !== witch.id) {
          nightActions.witchPoisonTarget = target.id;
          witchPotions.poison = false;
          eventBus.emit('game-event', {
            type: 'action_result',
            playerId: witch.id,
            action: 'poison',
            private: true,
          });
        }
      }
    }
  }

  // === 天亮公告 ===

  private async dayAnnounce(): Promise<boolean> {
    this.state.phase = 'day_announce';
    eventBus.emit('game-event', { type: 'phase_change', phase: 'day_announce', day: this.state.day });

    const { nightActions } = this.state;
    const deaths: number[] = [];

    // 狼人杀人（如果女巫没救）
    if (nightActions.wolfTarget != null && !nightActions.witchHeal) {
      deaths.push(nightActions.wolfTarget);
    }

    // 女巫毒人
    if (nightActions.witchPoisonTarget != null) {
      deaths.push(nightActions.witchPoisonTarget);
    }

    // 执行死亡
    for (const id of deaths) {
      const player = getPlayerById(this.state, id);
      if (player && player.alive) {
        player.alive = false;
        const cause = nightActions.witchPoisonTarget === id ? 'poisoned' : 'killed';
        player.causeOfDeath = cause;
        this.state.deathsTonight.push(id);

        eventBus.emit('game-event', {
          type: 'death',
          playerId: player.id,
          playerName: player.name,
          cause: cause === 'poisoned' ? '被毒杀' : '被狼人杀害',
        });

        // 猎人死亡处理
        if (player.role === 'hunter' && cause !== 'poisoned') {
          await this.hunterShoot(player);
        }
      }
    }

    if (deaths.length === 0) {
      eventBus.emit('game-event', { type: 'system_message', content: '昨晚是平安夜，没有人死亡。' });
    }

    // 广播死亡信息给所有存活玩家
    const deathMsg = deaths.length > 0
      ? `昨晚 ${deaths.map((id) => `${id}号`).join('、')} 死亡。`
      : '昨晚是平安夜，没有人死亡。';
    for (const player of getAlivePlayers(this.state)) {
      this.addPrivateMessage(player, `[系统] ${deathMsg}`);
    }

    // 胜负判定
    const winResult = checkWin(this.state);
    if (winResult.gameOver) {
      this.state.phase = 'game_over';
      eventBus.emit('game-event', {
        type: 'game_over',
        winner: winResult.winner!,
        summary: winResult.reason!,
      });
      return true;
    }

    return false;
  }

  // === 白天讨论 ===

  private async dayDiscuss(): Promise<void> {
    this.state.phase = 'day_discuss';
    eventBus.emit('game-event', { type: 'phase_change', phase: 'day_discuss', day: this.state.day });

    const alive = getAlivePlayers(this.state);
    const order = this.state.rules.daySpeakOrder === 'random'
      ? shuffleArray(alive)
      : alive.sort((a, b) => a.id - b.id);

    const aliveList = alive.map((p) => `${p.id}号`).join('、');

    for (let round = 0; round < this.config.discussionRounds; round++) {
      const roundLabel = this.config.discussionRounds > 1 ? `（第${round + 1}轮）` : '';
      eventBus.emit('game-event', {
        type: 'system_message',
        content: `白天讨论${roundLabel}开始，请按顺序发言。`,
      });

      for (const player of order) {
        if (!player.alive) continue;

        const prompt = `现在是第${this.state.day}天白天讨论${roundLabel}，轮到你发言。\n当前存活：${aliveList}（共${alive.length}人）\n请用 JSON 回复：{ "speech": "你的公开发言" }`;

        const response = await this.askPlayer(player, prompt);
        const parsed = parseResponse(response);

        // 广播发言给所有存活玩家
        const speechMsg = `${player.id}号：${parsed.speech}`;
        for (const other of getAlivePlayers(this.state)) {
          if (other.id !== player.id) {
            this.addPrivateMessage(other, speechMsg);
          }
        }

        eventBus.emit('game-event', {
          type: 'player_speak',
          playerId: player.id,
          playerName: player.name,
          content: parsed.speech,
          privateNote: parsed.privateNote,
        });

        await sleep(this.config.speakDelayMs);
      }
    }
  }

  // === 白天投票 ===

  private async dayVote(): Promise<void> {
    this.state.phase = 'day_vote';
    eventBus.emit('game-event', { type: 'phase_change', phase: 'day_vote', day: this.state.day });

    const result = await this.collectVotes();

    if (result.eliminated) {
      await this.eliminatePlayer(result.eliminated, 'voted');
    } else if (result.tie && this.state.rules.tieVote === 'revote_once') {
      // 重新投票
      this.state.phase = 'day_revote';
      eventBus.emit('game-event', { type: 'system_message', content: '平票！进行重新投票。' });
      eventBus.emit('game-event', { type: 'phase_change', phase: 'day_revote', day: this.state.day });

      const revoteResult = await this.collectVotes();
      if (revoteResult.eliminated) {
        await this.eliminatePlayer(revoteResult.eliminated, 'voted');
      } else {
        eventBus.emit('game-event', { type: 'system_message', content: '再次平票，无人被放逐。' });
      }
    } else {
      eventBus.emit('game-event', { type: 'system_message', content: '平票，无人被放逐。' });
    }
  }

  private async collectVotes(): Promise<{ eliminated: number | null; tie: boolean }> {
    const alive = getAlivePlayers(this.state);
    const targetList = alive.map((p) => `${p.id}号`).join('、');
    const votes: number[] = [];

    for (const player of alive) {
      const prompt = `投票时间！存活玩家：${targetList}\n请投票选择你认为应该被放逐的玩家，不能投自己。\n请用 JSON 回复：{ "action": { "type": "vote", "target": 座位号 } }`;

      let voted = false;
      for (let attempt = 0; attempt < 2 && !voted; attempt++) {
        const askPrompt = attempt === 0 ? prompt : `你的投票无效，请重新投票。存活玩家：${targetList}\n请用 JSON 回复：{ "action": { "type": "vote", "target": 座位号 } }，不能投自己。`;
        const response = await this.askPlayer(player, askPrompt);
        const parsed = parseResponse(response);

        if (parsed.action.type === 'vote' && parsed.action.target != null) {
          const target = getPlayerById(this.state, parsed.action.target);
          if (target && target.alive && target.id !== player.id) {
            votes.push(parsed.action.target);
            this.state.voteHistory.push({ day: this.state.day, voterId: player.id, targetId: parsed.action.target });
            eventBus.emit('game-event', { type: 'vote', voterId: player.id, targetId: parsed.action.target });
            voted = true;
          }
        }
      }
      // 两次都无效则视为弃票，不计入
    }

    const tie = isTie(votes);
    const eliminated = tie ? null : majorityVote(votes);
    return { eliminated, tie };
  }

  // === 辅助方法 ===

  private async eliminatePlayer(id: number, cause: 'voted' | 'shot'): Promise<void> {
    const player = getPlayerById(this.state, id);
    if (!player || !player.alive) return;

    player.alive = false;
    player.causeOfDeath = cause;

    eventBus.emit('game-event', {
      type: 'death',
      playerId: player.id,
      playerName: player.name,
      cause: cause === 'voted' ? '被投票放逐' : '被猎人射杀',
    });

    // 广播
    const msg = `${player.id}号被${cause === 'voted' ? '投票放逐' : '猎人射杀'}。`;
    for (const p of getAlivePlayers(this.state)) {
      this.addPrivateMessage(p, `[系统] ${msg}`);
    }

    // 遗言
    if (this.state.rules.lastWords) {
      await this.lastWords(player);
    }

    // 猎人开枪
    if (player.role === 'hunter' && cause === 'voted') {
      await this.hunterShoot(player);
    }
  }

  private async hunterShoot(hunter: Player): Promise<void> {
    if (!this.state.rules.hunterPoisonedCanShoot && hunter.causeOfDeath === 'poisoned') {
      eventBus.emit('game-event', {
        type: 'system_message',
        content: `${hunter.id}号猎人被毒死，无法开枪。`,
      });
      return;
    }

    const alive = getAlivePlayers(this.state);
    const targetList = alive.map((p) => `${p.id}号`).join('、');

    const prompt = `你是猎人，你已经死亡。你可以开枪带走一名玩家。\n存活玩家：${targetList}\n请用 JSON 回复：{ "action": { "type": "shoot", "target": 座位号 } } 或 { "action": { "type": "skip" } }`;

    const response = await this.askPlayer(hunter, prompt);
    const parsed = parseResponse(response);

    if (parsed.action.type === 'shoot' && parsed.action.target != null) {
      const target = getPlayerById(this.state, parsed.action.target);
      if (target && target.alive) {
        await this.eliminatePlayer(target.id, 'shot');
      }
    }
  }

  private async lastWords(player: Player): Promise<void> {
    const prompt = `你已经死亡，现在是你的遗言时间。你可以说任何想说的话。\n请用 JSON 回复：{ "speech": "你的遗言" }`;

    const response = await this.askPlayer(player, prompt);
    const parsed = parseResponse(response);

    // 广播遗言
    const msg = `[遗言] ${player.id}号：${parsed.speech}`;
    for (const p of getAlivePlayers(this.state)) {
      this.addPrivateMessage(p, msg);
    }

    eventBus.emit('game-event', {
      type: 'player_speak',
      playerId: player.id,
      playerName: player.name,
      content: `[遗言] ${parsed.speech}`,
      privateNote: parsed.privateNote,
    });
  }

  private async askPlayer(player: Player, userMessage: string, maxRetries = 4): Promise<string> {
    player.messageHistory.push({ role: 'user', content: userMessage });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await player.provider.chat(player.messageHistory);
        const response = result.content;

        // 空输出视为失败，重试
        if (!response || !response.trim()) {
          if (attempt < maxRetries) {
            console.warn(`  [RETRY] ${player.name} 返回空内容，第${attempt + 1}次重试...`);
            await sleep(2000 * (attempt + 1));
            continue;
          }
          throw new Error('API returned empty response after retries');
        }

        player.messageHistory.push({ role: 'assistant', content: response });
        this.logger?.logRaw(player.id, player.name, player.messageHistory, response, result.reasoning);
        return response;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (attempt < maxRetries) {
          console.warn(`  [RETRY] ${player.name} 第${attempt + 1}次重试 (${errMsg.slice(0, 80)})`);
          await sleep(2000 * (attempt + 1));
          continue;
        }
        console.error(`[ERROR] ${player.name} API 调用失败 (${maxRetries + 1}次尝试): ${errMsg}`);
      }
    }

    // 全部重试失败，返回兜底响应
    const fallback = JSON.stringify({
      private_note: 'API 调用失败，已重试多次',
      speech: '我暂时没有什么想说的。',
      action: { type: 'skip' },
    });
    player.messageHistory.push({ role: 'assistant', content: fallback });
    return fallback;
  }

  private addPrivateMessage(player: Player, content: string): void {
    player.messageHistory.push({ role: 'user', content });
  }

  private emptyNightActions(): NightActions {
    return {
      wolfTarget: null,
      seerTarget: null,
      seerResult: null,
      witchHeal: false,
      witchPoisonTarget: null,
    };
  }
}
