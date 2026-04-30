import { readFileSync, writeFileSync } from 'fs';
import { parseResponse } from '../src/prompt/ResponseParser.js';

const SESSION = 'game-2026-04-30T12-32-02';
const GOD = `logs/${SESSION}.god.jsonl`;
const PUB = `logs/${SESSION}.public.log`;
const RAW = `logs/${SESSION}.raw.jsonl`;

// 从 raw.jsonl 建立按 (playerId, ts) 索引的解析结果
const rawLines = readFileSync(RAW, 'utf-8').trim().split('\n');
const rawEntries = rawLines.map((line) => {
  const obj = JSON.parse(line);
  return {
    playerId: obj.playerId as number,
    ts: new Date(obj.ts as string).getTime(),
    parsed: parseResponse(obj.response as string),
  };
});

// 读取 god.jsonl，用时间戳+playerId 精确匹配 raw 条目
const godLines = readFileSync(GOD, 'utf-8').trim().split('\n');
const usedRawIdx = new Set<number>();
let fixedCount = 0;

const newGodLines = godLines.map((godLine) => {
  const event = JSON.parse(godLine);
  if (event.type !== 'player_speak') return JSON.stringify(event);

  const godTs = new Date(event.ts as string).getTime();
  const pid = event.playerId as number;

  // 找同 playerId、时间差最小且未使用的 raw 条目（30s 窗口）
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < rawEntries.length; i++) {
    if (usedRawIdx.has(i) || rawEntries[i].playerId !== pid) continue;
    const diff = Math.abs(rawEntries[i].ts - godTs);
    if (diff < bestDiff && diff < 30000) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return JSON.stringify(event);
  usedRawIdx.add(bestIdx);

  const { parsed } = rawEntries[bestIdx];
  const oldContent = event.content as string;
  const oldNote = event.privateNote as string;

  // 保留 [复盘]、[遗言]、[👑 MVP回应] 等前缀标签
  const prefixMatch = oldContent.match(/^(\[.*?\]\s*)/);
  const prefix = prefixMatch ? prefixMatch[1] : '';

  const newContent = prefix + parsed.speech;
  const newNote = parsed.privateNote;

  if (newContent !== oldContent || newNote !== oldNote) {
    fixedCount++;
    console.log(`FIXED [${pid}号] speech: ${oldContent.length} -> ${newContent.length} (diff=${bestDiff}ms)`);
  }

  event.content = newContent;
  event.privateNote = newNote;
  return JSON.stringify(event);
});

writeFileSync(GOD, newGodLines.join('\n') + '\n');
console.log(`\ngod.jsonl: fixed ${fixedCount} entries`);

// 重建 public.log
const pubLines = readFileSync(PUB, 'utf-8').trim().split('\n');
const updatedGodSpeaks = newGodLines
  .map((l) => JSON.parse(l))
  .filter((e) => e.type === 'player_speak');

let speakIdx = 0;
const newPubLines = pubLines.map((line) => {
  const m = line.match(/^(\[\d{2}:\d{2}:\d{2}\]) (\[.+?\]) (.+)$/);
  if (!m || speakIdx >= updatedGodSpeaks.length) return line;

  const [, ts, nameTag] = m;
  const godEvent = updatedGodSpeaks[speakIdx];
  if (nameTag === `[${godEvent.playerName}]`) {
    speakIdx++;
    return `${ts} ${nameTag} ${godEvent.content}`;
  }
  return line;
});

writeFileSync(PUB, newPubLines.join('\n') + '\n');
console.log(`public.log: matched ${speakIdx}/${updatedGodSpeaks.length} speak entries`);
