// 游戏状态数据结构

import type { AIProvider, ChatMessage } from '../ai/AIProvider.js';

// 角色类型
export type RoleName = 'werewolf' | 'seer' | 'witch' | 'hunter' | 'villager';

// 游戏阶段
export type Phase =
  | 'init'
  | 'night_wolves'
  | 'night_seer'
  | 'night_witch'
  | 'day_announce'
  | 'day_discuss'
  | 'day_vote'
  | 'day_revote'
  | 'check_win'
  | 'game_over';

// 阵营
export type Faction = 'werewolf' | 'villager';

// 玩家
export interface Player {
  id: number;               // 座位号 1-9
  name: string;             // 显示名，如 "1号·Opus"
  modelName: string;        // 模型标识
  role: RoleName;
  faction: Faction;
  provider: AIProvider;
  alive: boolean;
  causeOfDeath?: 'killed' | 'voted' | 'poisoned' | 'shot';
  messageHistory: ChatMessage[];  // 该玩家的私有对话历史
}

// 女巫药水状态
export interface WitchPotions {
  heal: boolean;   // 解药是否可用
  poison: boolean; // 毒药是否可用
}

// 夜晚行动记录
export interface NightActions {
  wolfTarget: number | null;       // 狼人杀的目标座位号
  seerTarget: number | null;       // 预言家查验的目标
  seerResult: boolean | null;      // 查验结果 true=好人 false=狼人
  witchHeal: boolean;              // 女巫是否救人
  witchPoisonTarget: number | null; // 女巫毒的目标
}

// 投票记录
export interface VoteRecord {
  day: number;
  voterId: number;
  targetId: number;
}

// 行动（AI 返回的结构化动作）
export interface GameAction {
  type: 'vote' | 'check' | 'heal' | 'poison' | 'skip' | 'shoot';
  target?: number;
}

// AI 回复解析结果
export interface ParsedResponse {
  privateNote: string;
  speech: string;
  action: GameAction;
}

// SSE 事件
export type GameEvent =
  | { type: 'phase_change'; phase: Phase; day: number }
  | { type: 'player_speak'; playerId: number; playerName: string; content: string; privateNote?: string }
  | { type: 'wolf_chat'; playerId: number; playerName: string; content: string }
  | { type: 'vote'; voterId: number; targetId: number }
  | { type: 'death'; playerId: number; playerName: string; cause: string }
  | { type: 'action_result'; playerId: number; action: string; result?: string; private: boolean }
  | { type: 'system_message'; content: string }
  | { type: 'game_over'; winner: Faction; summary: string };

// 游戏配置
export interface GameRules {
  sheriff: boolean;
  lastWords: boolean;
  witchFirstNightSelfHeal: boolean;
  witchSameNightHealPoison: boolean;
  hunterPoisonedCanShoot: boolean;
  tieVote: 'revote_once' | 'no_elimination';
  wolfNightMode: 'vote' | 'consensus';
  daySpeakOrder: 'seat' | 'random';
  revealOnDeath: boolean;
}

// 完整游戏状态
export interface GameState {
  day: number;
  phase: Phase;
  players: Player[];
  nightActions: NightActions;
  witchPotions: WitchPotions;
  voteHistory: VoteRecord[];
  deathsTonight: number[];     // 今晚死亡的玩家 ID 列表
  rules: GameRules;
}

// 工具函数
export function getAlivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.alive);
}

export function getAliveWolves(state: GameState): Player[] {
  return state.players.filter((p) => p.alive && p.role === 'werewolf');
}

export function getPlayerById(state: GameState, id: number): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function getFaction(role: RoleName): Faction {
  return role === 'werewolf' ? 'werewolf' : 'villager';
}
