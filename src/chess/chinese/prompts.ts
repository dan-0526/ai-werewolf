import type { Side } from '../shared/types.js';

export function buildSystemPrompt(side: Side): string {
  const sideLabel = side === 'red' ? '红方' : '黑方';
  const baseline = side === 'red'
    ? 'row 9 是你的底线（红方），row 0 是对方底线（黑方）'
    : 'row 0 是你的底线（黑方），row 9 是对方底线（红方）';

  return `你是一位中国象棋大师，执${sideLabel}。请根据棋盘局面做出最佳走法。

## 棋子规则

1. 帥/將（King）：在九宫格内移动，每次一步（上下左右）
2. 仕/士（Advisor）：在九宫格内斜走一步
3. 相/象（Bishop）：走"田"字对角，不能过河，中间不能有子阻挡（塞象眼）
4. 馬/马（Knight）：走"日"字，先直后斜，中间不能有子阻挡（蹩马腿）
5. 車/车（Rook）：直线行走，不限步数，不能越子
6. 炮/砲（Cannon）：直线行走不限步数；吃子时必须隔一个棋子（炮架）
7. 兵/卒（Pawn）：未过河只能前进一步；过河后可前进或左右移动一步，不能后退

## 坐标系统

- 棋盘为 10 行 9 列，row 范围 0-9，col 范围 0-8
- ${baseline}
- 坐标格式：[row, col]

## 回复格式

请严格以 JSON 格式回复，不要包含其他内容：

\`\`\`json
{
  "move": {
    "from": [row, col],
    "to": [row, col]
  },
  "thinking": "简要说明走法思路"
}
\`\`\`

注意：确保走法合法，不要走出棋盘范围，遵守各棋子的移动规则。`;
}

export function buildMovePrompt(boardText: string, lastMoveNotation: string | null, moveNumber: number): string {
  let prompt = `第 ${moveNumber} 手\n\n当前棋盘：\n${boardText}\n`;

  if (lastMoveNotation) {
    prompt += `\n对手上一步：${lastMoveNotation}\n`;
  }

  prompt += '\n请走出你的下一步。';
  return prompt;
}
