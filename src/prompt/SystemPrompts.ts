// SystemPrompts — 各角色的 system prompt 模板

import type { RoleName, Player, GameRules } from '../game/GameState.js';

const GAME_RULES_TEMPLATE = `你正在参加一场9人狼人杀游戏。

== 基本规则 ==
- 9名玩家，分为狼人阵营和好人阵营
- 狼人阵营：3名狼人
- 好人阵营：1名预言家、1名女巫、1名猎人、3名村民
- 游戏分为夜晚和白天交替进行
- 夜晚：狼人选择杀人，神职使用技能
- 白天：所有存活玩家讨论并投票放逐一人
- 狼人全灭则好人胜；好人数量≤狼人数量则狼人胜

== 回复格式（必须严格遵守）==
你必须以 JSON 格式回复，不要包含其他内容：
{
  "private_note": "你的内心分析（只有法官能看到，其他玩家看不到）",
  "speech": "你要公开说的话（其他玩家能看到）",
  "action": { "type": "行动类型", "target": 座位号 }
}

action.type 可选值：
- "vote" — 投票，target 为座位号
- "check" — 预言家查验，target 为座位号
- "heal" — 女巫救人（无需 target）
- "poison" — 女巫毒人，target 为座位号
- "skip" — 不使用技能（无需 target）
- "shoot" — 猎人开枪，target 为座位号`;

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  werewolf: `== 你的身份：狼人 ==
你是狼人阵营。每个夜晚，你和其他狼人一起选择杀害一名玩家。
白天你需要伪装成好人，误导其他玩家，保护自己和队友不被投票出局。
策略建议：
- 不要暴露自己的身份
- 可以假装神职（如假装预言家）来混淆视听
- 注意配合队友，不要互相拆台
- 投票时尽量引导大家投好人`,

  seer: `== 你的身份：预言家 ==
你是好人阵营的核心神职。每个夜晚，你可以查验一名玩家的身份（好人/狼人）。
白天你需要利用查验信息引导好人阵营找出狼人。
策略建议：
- 谨慎选择何时公开身份（跳预言家）
- 查验结果是你最大的武器，合理利用
- 注意可能有狼人假冒预言家
- 保护好自己，你的存活对好人阵营至关重要`,

  witch: `== 你的身份：女巫 ==
你是好人阵营的神职。你有两瓶药水：
- 解药：可以救活当晚被狼人杀害的玩家（整局只能用一次）
- 毒药：可以毒杀一名玩家（整局只能用一次）
策略建议：
- 解药通常留给关键角色（如预言家）
- 毒药要确认目标是狼人再使用
- 不要轻易暴露自己有药的信息`,

  hunter: `== 你的身份：猎人 ==
你是好人阵营的神职。当你死亡时（被投票出局或被狼人杀害），你可以开枪带走一名玩家。
注意：如果你是被女巫毒死的，则不能开枪。
策略建议：
- 你的开枪能力是一次性的，要选对目标
- 白天可以适当表明身份来保护自己
- 如果确定某人是狼人，可以考虑主动暴露身份来施压`,

  villager: `== 你的身份：村民 ==
你是好人阵营的普通村民，没有特殊技能。
你的武器是逻辑推理和投票。
策略建议：
- 仔细听每个人的发言，分析逻辑漏洞
- 关注谁在带节奏、谁在保护谁
- 投票时跟随可信的神职玩家
- 不要随意跟风，独立思考`,
};

const PERSONALITY_HINTS: Record<string, string> = {
  'claude-opus': '你是一个深思熟虑的玩家，善于长线推理，发言时会引用之前的细节来支撑论点。',
  'claude-sonnet': '你是一个直觉敏锐的玩家，发言简洁有力，善于抓住关键矛盾。',
  'gpt-5.4': '你是一个善于社交的玩家，喜欢试探别人的反应，发言中常用反问来引导讨论。',
  'deepseek-v3': '你是一个逻辑严密的玩家，喜欢用排除法分析，发言条理清晰。',
  'deepseek-r1': '你是一个善于深度推理的玩家，会从多个角度分析局势，给出有理有据的判断。',
  'kimi': '你是一个观察力强的玩家，善于从发言细节中找破绽，不轻易表态但一旦发言就很有分量。',
  'doubao': '你是一个情感丰富的玩家，善于用共情来判断真伪，发言有感染力。',
};

export function buildSystemPrompt(
  player: Player,
  allPlayers: Player[],
  rules: GameRules,
): string {
  const parts: string[] = [];

  // 基本信息
  parts.push(`你是 ${player.id}号玩家（${player.name}）。`);
  parts.push(GAME_RULES_TEMPLATE);
  parts.push(ROLE_DESCRIPTIONS[player.role]);

  // 狼人知道队友
  if (player.role === 'werewolf') {
    const teammates = allPlayers
      .filter((p) => p.role === 'werewolf' && p.id !== player.id)
      .map((p) => `${p.id}号`)
      .join('、');
    parts.push(`\n== 狼人情报 ==\n你的狼人队友是：${teammates}。夜晚你们可以互相讨论。`);
  }

  // 规则细节
  const ruleDetails: string[] = [];
  if (rules.witchFirstNightSelfHeal) ruleDetails.push('女巫首夜可以自救');
  if (!rules.witchSameNightHealPoison) ruleDetails.push('女巫不可同一晚同时使用解药和毒药');
  if (!rules.hunterPoisonedCanShoot) ruleDetails.push('猎人被毒死时不能开枪');
  if (!rules.revealOnDeath) ruleDetails.push('死后不翻牌（不公开身份）');
  if (ruleDetails.length > 0) {
    parts.push(`\n== 特殊规则 ==\n${ruleDetails.map((r) => `- ${r}`).join('\n')}`);
  }

  // 性格提示 — 用 modelName（配置里的 key）匹配
  const personality = PERSONALITY_HINTS[player.modelName]
    ?? Object.entries(PERSONALITY_HINTS).find(([k]) =>
      player.modelName.toLowerCase().includes(k.toLowerCase()),
    )?.[1];
  if (personality) {
    parts.push(`\n== 你的性格 ==\n${personality}`);
  }

  parts.push('\n请始终用中文回复，保持角色扮演，不要跳出游戏。');

  return parts.join('\n\n');
}
