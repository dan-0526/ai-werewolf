// ResponseParser — 解析 AI 回复中的结构化动作

import type { ParsedResponse, GameAction } from '../game/GameState.js';

const DEFAULT_ACTION: GameAction = { type: 'skip' };

export function parseResponse(raw: string): ParsedResponse {
  // 尝试 JSON 解析
  const jsonResult = tryParseJSON(raw);
  if (jsonResult) return jsonResult;

  // fallback: 正则提取
  return parseFromText(raw);
}

function tryParseJSON(raw: string): ParsedResponse | null {
  // 提取 JSON 块（可能被 markdown 包裹）
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return null;

  try {
    const obj = JSON.parse(jsonMatch[1].trim());
    return {
      privateNote: obj.private_note ?? obj.privateNote ?? '',
      speech: obj.speech ?? '',
      action: normalizeAction(obj.action),
    };
  } catch {
    return null;
  }
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
