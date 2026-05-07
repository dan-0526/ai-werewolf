// 谁是卧底 — 入口

import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { createProvider, type ModelConfig } from '../ai/ProviderFactory.js';
import { UndercoverGameMaster } from './GameMaster.js';
import type { Player, GameConfig } from './GameState.js';
import { shuffleArray } from '../shared/helpers.js';
import { WORD_PAIRS } from './WordBank.js';

// 加载配置
const configRaw = readFileSync('undercover.config.yaml', 'utf-8');
const config = parseYaml(configRaw) as {
  game: { name: string; player_count: number; undercover_count: number; blank_count: number; max_rounds: number; word_pair?: { civilian: string; undercover: string } };
  models: Record<string, ModelConfig>;
  players: Record<string, { model: string }>;
};

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-opus': 'Claude Opus',
  'claude-sonnet': 'Claude Sonnet',
  'gpt-5.4': 'GPT-5.4',
  'minimax': 'MiniMax',
  'ernie': 'ERNIE',
  'deepseek-v4': 'DeepSeek V4',
  'deepseek-r1': 'DeepSeek R1',
  'kimi': 'Kimi',
  'qwen': 'Qwen',
  'doubao-character': '豆包 Character',
  'doubao-pro': '豆包 Pro',
  'glm': 'GLM',
};

// 构建玩家列表
const playerEntries = Object.entries(config.players)
  .sort(([a], [b]) => parseInt(a) - parseInt(b));

const gameConfig: GameConfig = {
  playerCount: config.game.player_count,
  undercoverCount: config.game.undercover_count,
  blankCount: config.game.blank_count,
  maxRounds: config.game.max_rounds,
};

const players: Player[] = playerEntries.map(([seat, cfg]) => {
  const modelConfig = config.models[cfg.model];
  const id = parseInt(seat);
  const displayName = MODEL_DISPLAY_NAMES[cfg.model] ?? cfg.model;
  const provider = createProvider(cfg.model, modelConfig);

  return {
    id,
    name: `${id}号·${displayName}`,
    modelName: cfg.model,
    role: 'civilian' as const,  // 会在 GameMaster 里重新分配
    word: '',
    alive: true,
    provider,
    messageHistory: [],
  };
});

// 选词对：配置指定 > 随机
const wordPair = config.game.word_pair
  ? { civilian: config.game.word_pair.civilian, undercover: config.game.word_pair.undercover }
  : WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];

console.log(`\n🕵️ ${config.game.name}`);
console.log(`\n=== 参赛选手 ===`);
players.forEach(p => console.log(`  ${p.name}`));
console.log(`\n词对（上帝视角）：平民「${wordPair.civilian}」/ 卧底「${wordPair.undercover}」`);
console.log(`配置：${gameConfig.playerCount}人，${gameConfig.undercoverCount}卧底，${gameConfig.blankCount}白板\n`);

// 启动游戏
const game = new UndercoverGameMaster(players, gameConfig, wordPair);
console.log(`日志目录: logs/undercover/game-${game.getSessionId()}.*\n`);

// 控制台日志
game.on('game-event', (event) => {
  const ts = new Date().toLocaleTimeString();
  switch (event.type) {
    case 'roles_assigned':
      console.log(`\n[${ts}] 👁️ 上帝视角 · 角色分配：`);
      for (const a of event.assignments) {
        const roleLabel = a.role === 'undercover' ? '🔴 卧底' : a.role === 'blank' ? '⚪ 白板' : '🔵 平民';
        console.log(`  ${a.name} → ${roleLabel}（词：${a.word}）`);
      }
      console.log();
      break;
    case 'round_start':
      console.log(`\n[${ts}] === 第${event.round}轮 ===`);
      break;
    case 'describe':
      console.log(`[${ts}] [${event.playerName}] ${event.content}`);
      break;
    case 'vote':
      console.log(`[${ts}] ${event.voterId}号 → 投票 ${event.targetId}号`);
      break;
    case 'elimination':
      console.log(`[${ts}] ❌ ${event.playerName} 被淘汰（身份：${event.role}，词：${event.word}）`);
      break;
    case 'guess_word':
      console.log(`[${ts}] 🎯 ${event.playerName} 猜测平民词：「${event.guess}」→ ${event.correct ? '✅ 猜对了！卧底翻盘！' : '❌ 猜错了'}`);
      break;
    case 'game_over':
      console.log(`\n[${ts}] 🎉 ${event.summary}`);
      break;
  }
});

game.run().catch(console.error);
