// ResponseParser — 解析 AI 回复中的结构化动作

import type { ParsedResponse, GameAction } from '../game/GameState.js';

const DEFAULT_ACTION: GameAction = { type: 'skip' };

export function parseResponse(raw: string): ParsedResponse {
  // 尝试 JSON 解析
  const jsonResult = tryParseJSON(raw);
  if (jsonResult) return jsonResult;

  // JSON 解析失败时，尝试从原始文本中正则提取 speech/private_note 字段（处理不完整 JSON）
  const fieldResult = tryExtractFields(raw);
  if (fieldResult) return fieldResult;

  // fallback: 正则提取
  return parseFromText(raw);
}

function tryParseJSON(raw: string): ParsedResponse | null {
  // 提取 JSON 块（可能被 markdown 包裹）
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return null;

  let jsonStr = jsonMatch[1].trim();

  // 修复 JSON 字符串值里的真实换行符（部分模型不转义）
  jsonStr = jsonStr.replace(/"([^"]*?)"/gs, (match) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'),
  );

  try {
    const obj = JSON.parse(jsonStr);
    return {
      privateNote: obj.private_note ?? obj.privateNote ?? '',
      speech: obj.speech ?? '',
      action: normalizeAction(obj.action),
    };
  } catch {
    // JSON 不完整时，尝试用正则直接提取 speech 字段
    return tryExtractFields(jsonMatch[1]);
  }
}

/** 从含有 JSON 字段的文本中正则提取 speech/private_note（处理不完整 JSON、未闭合代码块等） */
function tryExtractFields(text: string): ParsedResponse | null {
  const speechMatch = text.match(/"speech"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/s);
  if (!speechMatch) return null;

  const noteMatch = text.match(/"private_note"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/s);
  return {
    privateNote: noteMatch?.[1]?.replace(/\\n/g, '\n') ?? '',
    speech: speechMatch[1].replace(/\\n/g, '\n'),
    action: DEFAULT_ACTION,
  };
}

function parseFromText(raw: string): ParsedResponse {
  const privateNote = extractSection(raw, '私密笔记', 'private_note', '思考') ?? '';
  const speech = extractSection(raw, '发言', 'speech', '公开发言') ?? raw.slice(0, 200);

  // 尝试提取行动
  const actionMatch = raw.match(/\[行动\]\s*(.+)/);
  let action: GameAction = DEFAULT_ACTION;

  if (actionMatch) {
    const text = actionMatch[1].trim();
    if (/投票[：:]?\s*(\d+)/.test(text)) {
      action = { type: 'vote', target: parseInt(RegExp.$1) };
    } else if (/查验[：:]?\s*(\d+)/.test(text)) {
      action = { type: 'check', target: parseInt(RegExp.$1) };
    } else if (/解药|救/.test(text)) {
      action = { type: 'heal' };
    } else if (/毒药[：:]?\s*(\d+)/.test(text)) {
      action = { type: 'poison', target: parseInt(RegExp.$1) };
    } else if (/开枪[：:]?\s*(\d+)/.test(text)) {
      action = { type: 'shoot', target: parseInt(RegExp.$1) };
    } else if (/不使用|跳过|skip/.test(text)) {
      action = { type: 'skip' };
    }
  }

  return { privateNote, speech, action };
}

function extractSection(raw: string, ...labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`\\[${label}\\]\\s*([\\s\\S]*?)(?=\\[|$)`);
    const match = raw.match(re);
    if (match) return match[1].trim();
  }
  return null;
}

function normalizeAction(action: unknown): GameAction {
  if (!action || typeof action !== 'object') return DEFAULT_ACTION;
  const a = action as Record<string, unknown>;
  const type = String(a.type ?? 'skip');
  const validTypes = ['vote', 'check', 'heal', 'poison', 'skip', 'shoot'];
  if (!validTypes.includes(type)) return DEFAULT_ACTION;
  return {
    type: type as GameAction['type'],
    target: typeof a.target === 'number' ? a.target
      : typeof a.target === 'string' ? parseInt(a.target, 10) || undefined
      : undefined,
  };
}
