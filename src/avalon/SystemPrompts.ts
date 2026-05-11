// 阿瓦隆 — System Prompt

import type { Player, GameConfig, Faction } from './GameState.js';
import { ROLE_NAMES_CN } from './RoleConfigs.js';

const GAME_RULES = `你正在参加一场"阿瓦隆"桌游。

== 基本规则 ==
- 玩家分为好人阵营（亚瑟方）和坏人阵营（莫德雷德方）
- 游戏进行5轮任务，好人需要3次任务成功，坏人需要3次任务失败
- 每轮由队长提名出征队伍，全员公开投票决定是否同意
- 连续5次组队被否决，坏人直接获胜
- 出征的人暗中出"成功"或"失败"牌，好人只能出成功，坏人可以选择出成功或失败
- 好人3次任务成功后，坏人的刺客有一次机会指认梅林，猜对则坏人翻盘

== 讨论策略 ==
这是一场社交博弈游戏，不是纯逻辑推理。
- 你可以说谎、栽赃、伪装、试探、结盟
- 讨论时要有明确的立场和态度，不要说空话
- 分析任务结果、投票模式、发言逻辑来推断阵营
- 好人要在不暴露梅林的前提下传递信息
- 坏人要主动伪装成好人，制造混乱，争取被选入队伍

== 回复格式 ==
你的回复必须是纯 JSON，第一个字符必须是 {，最后一个字符必须是 }。
禁止使用 Markdown 代码块，禁止在 JSON 前后添加任何文字。

讨论阶段：{ "speech": "你的发言" }
队长提名：{ "team": [座位号数组], "reason": "理由" }
投票组队：{ "approve": true/false, "reason": "理由" }
出征行动：{ "action": "success" 或 "fail" }
湖中女士：{ "target": 座位号, "reason": "理由" }
刺杀梅林：{ "target": 座位号, "reason": "理由" }`;

export function buildSystemPrompt(player: Player, allPlayers: Player[], config: GameConfig): string {
  const parts: string[] = [];

  parts.push(`你是 ${player.id}号玩家（${player.name}）。`);
  parts.push(GAME_RULES);

  // 角色信息
  const roleCN = ROLE_NAMES_CN[player.role];
  const factionCN = player.faction === 'good' ? '好人（亚瑟方）' : '坏人（莫德雷德方）';
  parts.push(`\n== 你的身份 ==\n你是${factionCN}阵营的「${roleCN}」。`);

  // 角色特殊信息
  const roleInfo = buildRoleInfo(player, allPlayers);
  if (roleInfo) parts.push(roleInfo);

  // 游戏信息
  const goodCount = allPlayers.filter(p => p.faction === 'good').length;
  const evilCount = allPlayers.filter(p => p.faction === 'evil').length;
  parts.push(`\n== 游戏信息 ==\n本局${config.playerCount}人，好人${goodCount}人，坏人${evilCount}人。\n任务人数：${config.missionSizes.join('、')}。${config.doubleFail != null ? `\n第${config.doubleFail + 1}轮任务需要2张失败牌才算失败。` : ''}${config.ladyOfLake ? '\n湖中女士：第2轮任务结束后启用。' : ''}`);

  // 发言要求
  parts.push(`\n== 发言要求 ==
- 讨论时说2-3句话，有观点有态度，不要写长篇大论
- 要像真人玩桌游一样说话：可以质疑、反驳、结盟、甩锅
- 投票和行动要给出简短理由
- 用中文回复`);

  return parts.join('\n\n');
}

function buildRoleInfo(player: Player, allPlayers: Player[]): string | null {
  switch (player.role) {
    case 'merlin': {
      // 梅林看到所有坏人（除了莫德雷德）
      const visibleEvil = allPlayers.filter(p => p.faction === 'evil' && p.role !== 'mordred');
      const evilList = visibleEvil.map(p => `${p.id}号`).join('、');
      return `\n== 梅林的视野 ==\n你能看到以下玩家是坏人：${evilList}（注意：莫德雷德对你隐身，你看不到他）\n\n重要：你知道谁是坏人，但你绝对不能暴露自己是梅林！如果好人赢了但刺客猜中你，坏人会翻盘。你需要巧妙地引导好人，但不能太明显。`;
    }
    case 'percival': {
      // 派西维尔看到梅林和莫甘娜（分不清）
      const merlinOrMorgana = allPlayers.filter(p => p.role === 'merlin' || p.role === 'morgana');
      const list = merlinOrMorgana.map(p => `${p.id}号`).join('、');
      return `\n== 派西维尔的视野 ==\n你知道 ${list} 中有一个是梅林，另一个是莫甘娜（或者只有梅林），但你分不清谁是谁。\n你的任务是保护梅林，同时帮助好人获胜。`;
    }
    case 'mordred':
    case 'morgana':
    case 'assassin':
    case 'minion': {
      // 坏人互相认识
      const evilTeam = allPlayers.filter(p => p.faction === 'evil' && p.id !== player.id);
      const teamList = evilTeam.map(p => `${p.id}号（${ROLE_NAMES_CN[p.role]}）`).join('、');
      let info = `\n== 坏人阵营信息 ==\n你的队友：${teamList}\n\n你们需要伪装成好人，争取被选入任务队伍，然后出失败牌搞破坏。`;
      if (player.role === 'mordred') {
        info += '\n\n你是莫德雷德——梅林看不到你。你可以更大胆地伪装成好人。';
      } else if (player.role === 'morgana') {
        info += '\n\n你是莫甘娜——派西维尔会把你和梅林搞混。利用这一点制造混乱。';
      } else if (player.role === 'assassin') {
        info += '\n\n你是刺客——如果好人赢了，你有最后一次机会指认梅林翻盘。在讨论中注意观察谁在暗中引导好人。';
      }
      return info;
    }
    case 'loyal':
      return `\n== 忠臣 ==\n你没有特殊能力，但你是好人阵营的中坚力量。通过观察发言、投票模式和任务结果来判断谁是坏人。`;
    default:
      return null;
  }
}
