// 阿瓦隆 — 角色与任务配置表

import type { RoleName } from './GameState.js';

export interface RoleSetup {
  good: RoleName[];
  evil: RoleName[];
}

export interface MissionSetup {
  sizes: number[];       // 每轮任务人数
  doubleFail: number | null;  // 需要2张失败牌的轮次 (0-based index), null=无
}

// 角色配置
const ROLE_CONFIGS: Record<number, RoleSetup> = {
  7: {
    good: ['merlin', 'percival', 'loyal', 'loyal'],
    evil: ['mordred', 'assassin', 'minion'],
  },
  8: {
    good: ['merlin', 'percival', 'loyal', 'loyal', 'loyal'],
    evil: ['mordred', 'assassin', 'morgana'],
  },
  9: {
    good: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal'],
    evil: ['mordred', 'assassin', 'morgana'],
  },
  10: {
    good: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal'],
    evil: ['mordred', 'morgana', 'assassin', 'minion'],
  },
};

// 任务人数配置
const MISSION_CONFIGS: Record<number, MissionSetup> = {
  7:  { sizes: [2, 3, 3, 4, 4], doubleFail: 3 },
  8:  { sizes: [3, 4, 4, 5, 5], doubleFail: 3 },
  9:  { sizes: [3, 4, 4, 5, 5], doubleFail: 3 },
  10: { sizes: [3, 4, 4, 5, 5], doubleFail: 3 },
};

export function getRoleConfig(playerCount: number): RoleSetup {
  const config = ROLE_CONFIGS[playerCount];
  if (!config) throw new Error(`不支持 ${playerCount} 人局，支持 7/8/9/10 人`);
  return config;
}

export function getMissionConfig(playerCount: number): MissionSetup {
  const config = MISSION_CONFIGS[playerCount];
  if (!config) throw new Error(`不支持 ${playerCount} 人局，支持 7/8/9/10 人`);
  return config;
}

// 角色中文名
export const ROLE_NAMES_CN: Record<RoleName, string> = {
  merlin: '梅林',
  percival: '派西维尔',
  loyal: '忠臣',
  mordred: '莫德雷德',
  morgana: '莫甘娜',
  assassin: '刺客',
  minion: '爪牙',
};
