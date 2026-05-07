// 谁是卧底 — System Prompt

import type { Player, GameConfig } from './GameState.js';

const GAME_RULES_TEMPLATE = `你正在参加一场"谁是卧底"游戏。

== 基本规则 ==
- 每位玩家会收到一个词语，大多数人（平民）拿到相同的词，少数人（卧底）拿到一个相似但不同的词
- 每轮每人用一句话描述自己的词，但不能直接说出这个词
- 每轮描述结束后，所有人投票，票数最多的人被淘汰
- 平民目标：找出卧底并投票淘汰
- 卧底目标：隐藏自己，活到最后

== 描述策略 ==
- 你的描述要让同阵营的人认出你，但不能让对手猜到你的词
- 太精确会暴露自己的词，太模糊会被怀疑是卧底
- 注意听别人的描述，找出那个"不太一样"的人

== 回复格式 ==
你的回复必须是纯 JSON，第一个字符必须是 {，最后一个字符必须是 }。
禁止使用 Markdown 代码块，禁止在 JSON 前后添加任何文字。

描述阶段：
{ "description": "你的一句话描述" }

投票阶段：
{ "vote": 座位号, "reason": "简短理由" }`;

// PLACEHOLDER_FOR_PERSONALITY_HINTS

export function buildSystemPrompt(player: Player, config: GameConfig): string {
  const parts: string[] = [];

  parts.push(`你是 ${player.id}号玩家（${player.name}）。`);
  parts.push(GAME_RULES_TEMPLATE);
  parts.push(`\n== 你的词语 ==\n你拿到的词是：「${player.word}」\n记住：绝对不能直接说出这个词！`);

  if (player.role === 'undercover') {
    parts.push(`\n== 你的身份 ==\n你是卧底。你的词和大多数人不同但相似。你需要伪装成平民，让别人以为你和他们拿到的是同一个词。`);
  } else if (player.role === 'blank') {
    parts.push(`\n== 你的身份 ==\n你是白板。你没有拿到任何词。你需要根据别人的描述猜测平民的词是什么，然后伪装成平民。`);
  } else {
    parts.push(`\n== 你的身份 ==\n你是平民。大多数人和你拿到的词相同。找出那个描述"不太对劲"的人。`);
  }

  parts.push(`\n== 发言要求 ==
- 描述控制在一句话（10-30字），不要写小作文
- 投票时必须给出明确的座位号
- 用中文回复，保持角色扮演`);

  return parts.join('\n\n');
}
