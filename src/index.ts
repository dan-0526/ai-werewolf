// AI 狼人杀 — 入口

import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { createProvider, type ModelConfig } from './ai/ProviderFactory.js';
import { GameMaster } from './game/GameMaster.js';
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

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-opus': 'Claude Opus 4.6',
  'claude-sonnet': 'Claude Sonnet 4.6',
  'gpt-5.4': 'GPT-5.4',
  'minimax': 'MiniMax M2.5',
  'ernie': 'ERNIE 4.5',
  'deepseek-v4': 'DeepSeek V4',
  'deepseek-r1': 'DeepSeek R1',
  'kimi': 'Kimi K2.6',
  'qwen': 'Qwen 3.5',
  'qwen-big': 'Qwen 3.5-397B',
  'doubao-character': '豆包 Character',
  'doubao-pro': '豆包 Pro',
  'glm': 'GLM 5.1',
  'mock': 'Mock',
};

// === CLI 参数解析 ===
// 用法:
//   npx tsx src/index.ts                              # 使用 config 中 players 段的模型
//   npx tsx src/index.ts claude-opus deepseek-v4 ...  # 指定模型（需 9 个）
//   npx tsx src/index.ts --file lineup.txt            # 从文件读取模型列表（每行一个）
//   npx tsx src/index.ts --list                       # 列出所有可用模型

const args = process.argv.slice(2);

if (args.includes('--list')) {
  console.log('\n可用模型:\n');
  for (const [name, mc] of Object.entries(config.models)) {
    const display = MODEL_DISPLAY_NAMES[name] ?? name;
    console.log(`  ${name.padEnd(20)} ${display.padEnd(22)} (${mc.provider})`);
  }
  console.log(`\n共 ${Object.keys(config.models).length} 个模型。角色列表需要 ${config.roles.list.length} 个玩家。`);
  process.exit(0);
}

// 确定本局参赛模型列表
let selectedModels: string[];

const fileIdx = args.indexOf('--file');
if (fileIdx !== -1 && args[fileIdx + 1]) {
  // 从文件读取
  const filePath = args[fileIdx + 1];
  if (!existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }
  selectedModels = readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
} else if (args.length > 0 && !args[0].startsWith('-')) {
  // 从命令行参数读取
  selectedModels = args.filter((a) => !a.startsWith('-'));
} else {
  // 从 config players 段读取
  selectedModels = Object.entries(config.players)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([, cfg]) => cfg.model);
}

// 校验模型名
for (const name of selectedModels) {
  if (!config.models[name]) {
    console.error(`未知模型: "${name}"。使用 --list 查看可用模型。`);
    process.exit(1);
  }
}

const roleCount = config.roles.list.length;
if (selectedModels.length !== roleCount) {
  console.error(`需要 ${roleCount} 个模型，但提供了 ${selectedModels.length} 个。`);
  console.error(`当前: ${selectedModels.join(', ')}`);
  process.exit(1);
}

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

// 随机打乱模型的座位分配
const shuffledModels = shuffleArray(selectedModels);

const players: Player[] = shuffledModels.map((modelName, i) => {
  const modelConfig = config.models[modelName];
  const seat = i + 1;
  const role = roleList[i];
  const displayName = MODEL_DISPLAY_NAMES[modelName] ?? modelName;
  const provider = createProvider(modelName, modelConfig);

  return {
    id: seat,
    name: `${seat}号·${displayName}`,
    modelName,
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
