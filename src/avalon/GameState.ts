// 阿瓦隆 — 游戏状态定义

export type Faction = 'good' | 'evil';
export type RoleName = 'merlin' | 'percival' | 'loyal' | 'mordred' | 'morgana' | 'assassin' | 'minion';

export interface Player {
  id: number;
  name: string;
  modelName: string;
  role: RoleName;
  faction: Faction;
  provider: import('../ai/AIProvider.js').AIProvider;
  messageHistory: import('../ai/AIProvider.js').ChatMessage[];
}

export interface GameConfig {
  playerCount: number;
  missionSizes: number[];        // 每轮任务需要几人
  doubleFail: number | null;     // 哪轮需要2张失败牌（index 0-based, null=无）
  discussionRounds: number;      // 讨论轮数
  ladyOfLake: boolean;           // 是否启用湖中女士
}

export type Phase =
  | 'discussion'
  | 'propose'
  | 'team_vote'
  | 'mission'
  | 'lady_of_lake'
  | 'assassinate'
  | 'game_over';

export type GameEvent =
  | { type: 'game_start'; players: { id: number; name: string }[]; config: GameConfig }
  | { type: 'roles_assigned'; assignments: { id: number; name: string; role: RoleName; faction: Faction }[] }
  | { type: 'round_start'; round: number; leaderId: number; missionSize: number }
  | { type: 'discussion'; playerId: number; playerName: string; content: string }
  | { type: 'propose_team'; leaderId: number; team: number[] }
  | { type: 'team_vote'; votes: { playerId: number; playerName: string; approve: boolean }[]; approved: boolean }
  | { type: 'team_rejected'; rejectCount: number }
  | { type: 'mission_result'; round: number; successes: number; fails: number; passed: boolean }
  | { type: 'lady_inspect'; inspectorId: number; inspectorName: string; targetId: number; targetName: string; result: Faction }
  | { type: 'assassinate'; assassinId: number; targetId: number; targetName: string; isMerlin: boolean }
  | { type: 'game_over'; winner: Faction; reason: string };
