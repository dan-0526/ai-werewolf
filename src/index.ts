// AI 狼人杀 — 入口

import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { createProvider, type ModelConfig } from './ai/ProviderFactory.js';
import { GameMaster, type GameMasterConfig } from './game/GameMaster.js';
import type { Player, RoleName, GameRules } from './game/GameState.js';
import { getFaction } from './game/GameState.js';
import { shuffleArray } from './utils/helpers.js';
import { GameLogger } from './utils/GameLogger.js';
import { eventBus } from './server/GameEventBus.js';

// 加载配置
const configRaw = readFileSync('game.config.yaml', 'utf-8');
const config = parseYaml(configRaw) as {
  game: {
    name: string;
    discussion_rounds: number;
    wolf_chat_rounds: number;
    speak_delay_ms: number;
  };
  rules: Record<string, unknown>;
  roles: { assignment: string; seed?: number | null; list: string[] };
  models: Record<string, ModelConfig>;
  players: Record<string, { model: string; role?: string }>;
};

console.log(`\n🐺 ${config.game.name}\n`);

// 解析规则
const rules: GameRules = {
  sheriff: config.rules.sheriff as boolean ?? false,
  lastWords: config.rules.last_words as boolean ?? true,
  witchFirstNightSelfHeal: config.rules.witch_first_night_self_heal as boolean ?? true,
  witchSameNightHealPoison: config.rules.witch_same_night_heal_poison as boolean ?? false,
  hunterPoisonedCanShoot: config.rules.hunter_poisoned_can_shoot as boolean ?? false,
  tieVote: (config.rules.tie_vote as string ?? 'revote_once') as 'revote_once' | 'no_elimination',
  wolfNightMode: (config.rules.wolf_night_mode as string ?? 'vote') as 'vote' | 'consensus',
  daySpeakOrder: (config.rules.day_speak_order as string ?? 'seat') as 'seat' | 'random',
  revealOnDeath: config.rules.reveal_on_death as boolean ?? false,
};

// 分配角色
let roleList = config.roles.list.map((r) => r as RoleName);
if (config.roles.assignment === 'random') {
  roleList = shuffleArray(roleList, config.roles.seed ?? undefined);
}

// 创建玩家
const playerEntries = Object.entries(config.players)
  .map(([seat, cfg]) => ({ seat: parseInt(seat), ...cfg }))
  .sort((a, b) => a.seat - b.seat);

if (playerEntries.length !== roleList.length) {
  throw new Error(`玩家数量（${playerEntries.length}）与角色数量（${roleList.length}）不匹配`);
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-opus': 'Opus',
  'claude-sonnet': 'Sonnet',
  'gpt-5.4': 'GPT',
  'deepseek-v3': 'DeepSeek-V3',
  'deepseek-r1': 'DeepSeek-R1',
  'kimi': 'Kimi',
  'doubao': '豆包',
  'mock': 'Mock',
};

const players: Player[] = playerEntries.map((entry, i) => {
  const modelConfig = config.models[entry.model];
  if (!modelConfig) throw new Error(`未找到模型配置: ${entry.model}`);

  const role = config.roles.assignment === 'fixed' && entry.role
    ? entry.role as RoleName
    : roleList[i];

  const displayName = MODEL_DISPLAY_NAMES[entry.model] ?? entry.model;
  const provider = createProvider(entry.model, modelConfig);

  return {
    id: entry.seat,
    name: `${entry.seat}号·${displayName}`,
    modelName: entry.model,
    role,
    faction: getFaction(role),
    provider,
    alive: true,
    messageHistory: [],
  };
});

// 打印阵容（上帝视角）
console.log('=== 阵容 ===');
for (const p of players) {
  const roleEmoji: Record<string, string> = {
    werewolf: '🐺', seer: '🔮', witch: '🧪', hunter: '🔫', villager: '👤',
  };
  console.log(`  ${p.name} — ${roleEmoji[p.role] ?? '?'} ${p.role}`);
}
console.log('');

// 初始化日志系统
const logger = new GameLogger('logs');
console.log(`日志目录: logs/game-${logger.getSessionId()}.*\n`);

// 所有游戏事件自动写入日志
eventBus.on('game-event', (event) => logger.logEvent(event));

// 创建并运行游戏
const gameMaster = new GameMaster({
  players,
  rules,
  speakDelayMs: config.game.speak_delay_ms,
  discussionRounds: config.game.discussion_rounds,
  wolfChatRounds: config.game.wolf_chat_rounds,
  logger,
});

gameMaster.run().then(() => {
  logger.close();
  console.log('\n游戏结束。');
  process.exit(0);
}).catch((err) => {
  logger.close();
  console.error('游戏异常终止:', err);
  process.exit(1);
});
