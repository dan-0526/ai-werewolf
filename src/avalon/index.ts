// 阿瓦隆 — 入口

import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { createProvider, type ModelConfig } from '../ai/ProviderFactory.js';
import { AvalonGameMaster } from './GameMaster.js';
import type { Player, GameConfig, RoleName, Faction } from './GameState.js';
import { getRoleConfig, getMissionConfig, ROLE_NAMES_CN } from './RoleConfigs.js';
import { shuffleArray } from '../shared/helpers.js';

// 加载配置
const configRaw = readFileSync('avalon.config.yaml', 'utf-8');
const config = parseYaml(configRaw) as {
  game: { name: string; player_count: number; discussion_rounds: number; lady_of_lake: boolean };
  models: Record<string, ModelConfig>;
  players: Record<string, { model: string }>;
};

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-opus': 'Claude Opus',
  'claude-sonnet': 'Claude Sonnet',
  'deepseek-v4': 'DeepSeek V4',
  'kimi': 'Kimi',
  'doubao-pro': '豆包 Pro',
  'glm': 'GLM',
  'minimax': 'MiniMax',
};

// 构建玩家列表
const playerEntries = Object.entries(config.players)
  .sort(([a], [b]) => parseInt(a) - parseInt(b));

const roleSetup = getRoleConfig(config.game.player_count);
const missionSetup = getMissionConfig(config.game.player_count);

const gameConfig: GameConfig = {
  playerCount: config.game.player_count,
  missionSizes: missionSetup.sizes,
  doubleFail: missionSetup.doubleFail,
  discussionRounds: config.game.discussion_rounds,
  ladyOfLake: config.game.lady_of_lake,
};

// 分配角色
const allRoles: { role: RoleName; faction: Faction }[] = [
  ...roleSetup.good.map(r => ({ role: r, faction: 'good' as Faction })),
  ...roleSetup.evil.map(r => ({ role: r, faction: 'evil' as Faction })),
];
const shuffledRoles = shuffleArray(allRoles);

const players: Player[] = playerEntries.map(([seat, cfg], idx) => {
  const modelConfig = config.models[cfg.model];
  const id = parseInt(seat);
  const displayName = MODEL_DISPLAY_NAMES[cfg.model] ?? cfg.model;
  const provider = createProvider(cfg.model, modelConfig);
  const { role, faction } = shuffledRoles[idx];

  return {
    id,
    name: `${id}号·${displayName}`,
    modelName: cfg.model,
    role,
    faction,
    provider,
    messageHistory: [],
  };
});

console.log(`\n⚔️  ${config.game.name}`);
console.log(`\n=== 参赛选手 ===`);
players.forEach(p => console.log(`  ${p.name}`));
console.log(`\n配置：${gameConfig.playerCount}人，任务人数 ${gameConfig.missionSizes.join('/')}，湖中女士${gameConfig.ladyOfLake ? '开启' : '关闭'}\n`);

// 启动游戏
const game = new AvalonGameMaster(players, gameConfig);
console.log(`日志目录: logs/avalon/game-${game.getSessionId()}.*\n`);

// 控制台日志
game.on('game-event', (event) => {
  const ts = new Date().toLocaleTimeString();
  switch (event.type) {
    case 'roles_assigned':
      console.log(`\n[${ts}] 👁️ 上帝视角 · 角色分配：`);
      for (const a of event.assignments) {
        const fIcon = a.faction === 'good' ? '🔵' : '🔴';
        console.log(`  ${a.name} → ${fIcon} ${ROLE_NAMES_CN[a.role]}`);
      }
      console.log();
      break;
    case 'round_start':
      console.log(`\n[${ts}] === 第${event.round}轮任务 === 队长：${event.leaderId}号 | 需要${event.missionSize}人`);
      break;
    case 'discussion':
      console.log(`[${ts}] [${event.playerName}] ${event.content}`);
      break;
    case 'propose_team':
      console.log(`[${ts}] 📋 队长${event.leaderId}号提名：${event.team.map(id => `${id}号`).join('、')}`);
      break;
    case 'team_vote':
      console.log(`[${ts}] 🗳️  投票：${event.approved ? '✅ 通过' : '❌ 否决'}`);
      event.votes.forEach(v => console.log(`    ${v.playerName}: ${v.approve ? '赞成' : '反对'}`));
      break;
    case 'team_rejected':
      console.log(`[${ts}] ⚠️  第${event.rejectCount}次否决`);
      break;
    case 'mission_result':
      console.log(`[${ts}] ${event.passed ? '✅' : '❌'} 任务${event.round}：${event.successes}成功/${event.fails}失败`);
      break;
    case 'lady_inspect':
      console.log(`[${ts}] 🔮 湖中女士：${event.inspectorName} 查验 ${event.targetName} → ${event.result === 'good' ? '好人' : '坏人'}`);
      break;
    case 'assassinate':
      console.log(`[${ts}] 🗡️  刺客指认 ${event.targetName} → ${event.isMerlin ? '猜对！坏人翻盘！' : '猜错！好人获胜！'}`);
      break;
    case 'game_over':
      console.log(`\n[${ts}] 🎉 ${event.winner === 'good' ? '好人' : '坏人'}获胜！${event.reason}`);
      break;
  }
});

game.run().catch(console.error);
