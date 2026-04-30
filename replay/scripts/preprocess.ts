/**
 * 预处理脚本：解析 god.jsonl → events.json + meta.json + TTS 音频
 *
 * 用法: npx tsx scripts/preprocess.ts <god.jsonl路径>
 * 示例: npx tsx scripts/preprocess.ts ../logs/game-2026-04-30T16-54-45.god.jsonl
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { parseFile } from 'music-metadata';
import { VOICE_MAP, NARRATOR_VOICE } from './voice-map.js';

// ---- 类型定义 ----

type RoleName = 'werewolf' | 'seer' | 'witch' | 'hunter' | 'villager';
type Faction = 'werewolf' | 'villager';
type Phase =
  | 'init' | 'night_wolves' | 'night_seer' | 'night_witch'
  | 'day_announce' | 'day_discuss' | 'day_vote' | 'day_revote'
  | 'check_win' | 'game_over';

interface GodEvent {
  ts: string;
  type: string;
  [key: string]: unknown;
}

interface PlayerMeta {
  id: number;
  name: string;
  modelKey: string;
  role: RoleName;
  faction: Faction;
}

interface ReplayMeta {
  sessionId: string;
  players: PlayerMeta[];
}

interface ReplayEvent {
  index: number;
  ts: string;
  type: string;
  data: GodEvent;
  audio?: { file: string; durationMs: number };
  displayDurationMs: number;
}

interface TtsTask {
  text: string;
  voice: string;
  output: string;
}

// ---- 模型显示名 → 模型 key 映射 ----

const DISPLAY_TO_MODEL: Record<string, string> = {
  'Claude Opus 4.6': 'claude-opus',
  'Claude Sonnet 4.6': 'claude-sonnet',
  'GPT-5.4': 'gpt-5.4',
  'MiniMax M2.5': 'minimax',
  'ERNIE 4.5': 'ernie',
  'DeepSeek V4': 'deepseek-v4',
  'DeepSeek R1': 'deepseek-r1',
  'Kimi K2.6': 'kimi',
  'Qwen 3.5': 'qwen',
  '豆包 Character': 'doubao-character',
  '豆包 Pro': 'doubao-pro',
  'GLM 5.1': 'glm',
};

// ---- 工具函数 ----

function extractModelKey(playerName: string): string {
  // "1号·Claude Opus 4.6" → "Claude Opus 4.6" → "claude-opus"
  const displayName = playerName.replace(/^\d+号·/, '');
  return DISPLAY_TO_MODEL[displayName] ?? displayName.toLowerCase().replace(/\s+/g, '-');
}

function getVoice(modelKey: string): string {
  return VOICE_MAP[modelKey] ?? NARRATOR_VOICE;
}

function calcDisplayDuration(event: GodEvent, audioDurationMs?: number): number {
  if (audioDurationMs) return audioDurationMs + 500;

  switch (event.type) {
    case 'phase_change': return 2000;
    case 'vote': return 800;
    case 'death': return 1500;
    case 'action_result': return 1500;
    case 'system_message': {
      const content = (event.content as string) ?? '';
      return Math.max(2000, content.length * 80);
    }
    case 'game_over': return 3000;
    default: return 1000;
  }
}

// ---- 主逻辑 ----

async function main() {
  const logPath = process.argv[2];
  if (!logPath) {
    console.error('用法: npx tsx scripts/preprocess.ts <god.jsonl路径>');
    process.exit(1);
  }

  const absLogPath = resolve(logPath);
  if (!existsSync(absLogPath)) {
    console.error(`文件不存在: ${absLogPath}`);
    process.exit(1);
  }

  // 从文件名提取 session ID
  const fileName = basename(absLogPath);
  const sessionId = fileName.replace('.god.jsonl', '');
  const outputDir = join(dirname(new URL(import.meta.url).pathname), '..', 'public', 'data', sessionId);
  const audioDir = join(outputDir, 'audio');
  mkdirSync(audioDir, { recursive: true });

  console.log(`解析日志: ${absLogPath}`);
  console.log(`输出目录: ${outputDir}`);

  // 1. 解析 JSONL
  const lines = readFileSync(absLogPath, 'utf-8').split('\n').filter(Boolean);
  const events: GodEvent[] = lines.map((line) => JSON.parse(line));

  // 2. 提取玩家信息
  const playerMap = new Map<number, { name: string; modelKey: string }>();
  for (const e of events) {
    if ((e.type === 'player_speak' || e.type === 'wolf_chat') && e.playerId && e.playerName) {
      const id = e.playerId as number;
      if (!playerMap.has(id)) {
        playerMap.set(id, {
          name: e.playerName as string,
          modelKey: extractModelKey(e.playerName as string),
        });
      }
    }
  }

  // 3. 推断角色（从事件中推断）
  const playerRoles = new Map<number, RoleName>();
  const wolfIds = new Set<number>();

  for (const e of events) {
    if (e.type === 'wolf_chat') {
      wolfIds.add(e.playerId as number);
    }
    if (e.type === 'action_result') {
      const action = e.action as string;
      const pid = e.playerId as number;
      if (action === 'check') playerRoles.set(pid, 'seer');
      else if (action === 'heal' || action === 'poison') playerRoles.set(pid, 'witch');
      else if (action === 'shoot') playerRoles.set(pid, 'hunter');
    }
  }

  for (const wid of wolfIds) {
    playerRoles.set(wid, 'werewolf');
  }

  // 未识别的角色默认为村民
  for (const [id] of playerMap) {
    if (!playerRoles.has(id)) {
      playerRoles.set(id, 'villager');
    }
  }

  // 构建 meta
  const players: PlayerMeta[] = Array.from(playerMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([id, info]) => {
      const role = playerRoles.get(id) ?? 'villager';
      return {
        id,
        name: info.name,
        modelKey: info.modelKey,
        role,
        faction: role === 'werewolf' ? 'werewolf' : 'villager',
      };
    });

  const meta: ReplayMeta = { sessionId, players };
  writeFileSync(join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`meta.json 已生成，${players.length} 个玩家`);

  // 4. 生成 TTS 任务清单
  const ttsTasks: TtsTask[] = [];
  const replayEvents: ReplayEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const audioFileName = `${String(i).padStart(3, '0')}-${e.type}.mp3`;
    const audioPath = join(audioDir, audioFileName);
    let needsTts = false;
    let voice = NARRATOR_VOICE;
    let text = '';

    switch (e.type) {
      case 'player_speak':
        needsTts = true;
        voice = getVoice(playerMap.get(e.playerId as number)?.modelKey ?? '');
        text = e.content as string;
        break;
      case 'wolf_chat':
        needsTts = true;
        voice = getVoice(playerMap.get(e.playerId as number)?.modelKey ?? '');
        text = e.content as string;
        break;
      case 'system_message':
        needsTts = true;
        voice = NARRATOR_VOICE;
        text = e.content as string;
        break;
      case 'game_over':
        needsTts = true;
        voice = NARRATOR_VOICE;
        text = `游戏结束！${(e.winner as string) === 'werewolf' ? '狼人' : '好人'}阵营获胜！${e.summary as string}`;
        break;
    }

    if (needsTts && text.trim()) {
      ttsTasks.push({ text: text.trim(), voice, output: audioPath });
    }

    replayEvents.push({
      index: i,
      ts: e.ts,
      type: e.type,
      data: e,
      audio: needsTts && text.trim() ? { file: `audio/${audioFileName}`, durationMs: 0 } : undefined,
      displayDurationMs: 0, // 后面填充
    });
  }

  // 5. 调用 TTS 生成音频
  if (ttsTasks.length > 0) {
    const tasksFile = join(outputDir, 'tts-tasks.json');
    writeFileSync(tasksFile, JSON.stringify(ttsTasks, null, 2));
    console.log(`\nTTS 任务: ${ttsTasks.length} 条，开始生成...`);

    const scriptDir = dirname(new URL(import.meta.url).pathname);
    const ttsScript = join(scriptDir, 'tts.py');
    execSync(`python3 "${ttsScript}" "${tasksFile}"`, { stdio: 'inherit' });
  }

  // 6. 读取音频时长，填充 displayDurationMs
  console.log('\n读取音频时长...');
  for (const re of replayEvents) {
    if (re.audio) {
      const audioAbsPath = join(outputDir, re.audio.file);
      if (existsSync(audioAbsPath)) {
        try {
          const metadata = await parseFile(audioAbsPath);
          re.audio.durationMs = Math.round((metadata.format.duration ?? 0) * 1000);
        } catch {
          re.audio.durationMs = 2000; // fallback
        }
      }
    }
    re.displayDurationMs = calcDisplayDuration(re.data, re.audio?.durationMs);
  }

  // 7. 输出 events.json
  writeFileSync(join(outputDir, 'events.json'), JSON.stringify(replayEvents, null, 2));

  const totalDuration = replayEvents.reduce((sum, e) => sum + e.displayDurationMs, 0);
  console.log(`\nevents.json 已生成，${replayEvents.length} 个事件`);
  console.log(`预计回放时长: ${Math.round(totalDuration / 1000)}s (${(totalDuration / 60000).toFixed(1)}min)`);
  console.log('预处理完成！');
}

main().catch((err) => {
  console.error('预处理失败:', err);
  process.exit(1);
});
