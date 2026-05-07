// 谁是卧底 — 游戏状态定义

export type Role = 'civilian' | 'undercover' | 'blank';

export interface Player {
  id: number;           // 座位号 1-based
  name: string;         // 显示名
  modelName: string;    // 模型 key
  role: Role;
  word: string;         // 分配到的词
  alive: boolean;
  provider: import('../ai/AIProvider.js').AIProvider;
  messageHistory: import('../ai/AIProvider.js').ChatMessage[];
}

export interface GameConfig {
  playerCount: number;        // 总人数（推荐 7-9）
  undercoverCount: number;    // 卧底人数（推荐 1-2）
  blankCount: number;         // 白板人数（0 或 1）
  maxRounds: number;          // 最大轮数
}

export interface WordPair {
  civilian: string;     // 平民词
  undercover: string;   // 卧底词
}

export type Phase =
  | 'describe'    // 描述阶段
  | 'vote'        // 投票阶段
  | 'reveal'      // 揭示被投出的人
  | 'game_over';  // 游戏结束

export type GameEvent =
  | { type: 'game_start'; players: { id: number; name: string }[]; config: GameConfig }
  | { type: 'round_start'; round: number }
  | { type: 'describe'; playerId: number; playerName: string; content: string }
  | { type: 'vote'; voterId: number; targetId: number }
  | { type: 'elimination'; playerId: number; playerName: string; role: Role; word: string }
  | { type: 'game_over'; winner: Role; summary: string };
