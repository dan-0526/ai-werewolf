// 回放系统类型定义

export type RoleName = 'werewolf' | 'seer' | 'witch' | 'hunter' | 'villager';
export type Faction = 'werewolf' | 'villager';
export type Phase =
  | 'init' | 'night_wolves' | 'night_seer' | 'night_witch'
  | 'day_announce' | 'day_discuss' | 'day_vote' | 'day_revote'
  | 'check_win' | 'game_over';

export interface PlayerMeta {
  id: number;
  name: string;
  modelKey: string;
  role: RoleName;
  faction: Faction;
}

export interface ReplayMeta {
  sessionId: string;
  players: PlayerMeta[];
}

export interface GodEvent {
  ts: string;
  type: string;
  phase?: Phase;
  day?: number;
  playerId?: number;
  playerName?: string;
  content?: string;
  privateNote?: string;
  voterId?: number;
  targetId?: number;
  cause?: string;
  action?: string;
  result?: string;
  private?: boolean;
  winner?: Faction;
  summary?: string;
}

export interface ReplayEvent {
  index: number;
  ts: string;
  type: string;
  data: GodEvent;
  audio?: { file: string; durationMs: number };
  displayDurationMs: number;
}

// 角色配置
export const ROLE_CONFIG: Record<RoleName, { label: string; color: string; icon: string }> = {
  werewolf: { label: '狼人', color: '#c0392b', icon: '🐺' },
  seer:     { label: '预言家', color: '#2980b9', icon: '🔮' },
  witch:    { label: '女巫', color: '#8e44ad', icon: '🧪' },
  hunter:   { label: '猎人', color: '#e67e22', icon: '🔫' },
  villager: { label: '村民', color: '#27ae60', icon: '👤' },
};

// 阶段标签
export const PHASE_LABELS: Record<string, string> = {
  night_wolves: '夜晚·狼人行动',
  night_seer: '夜晚·预言家查验',
  night_witch: '夜晚·女巫行动',
  day_announce: '天亮了',
  day_discuss: '白天·自由讨论',
  day_vote: '白天·投票环节',
  day_revote: '白天·重新投票',
  game_over: '游戏结束',
};

export function isNightPhase(phase?: string): boolean {
  return !!phase && phase.startsWith('night_');
}
