// MockProvider — 测试状态机用，不调 API

import type { AIProvider, ChatMessage, ChatResult } from './AIProvider.js';

export class MockProvider implements AIProvider {
  readonly modelName = 'mock';
  private callCount = 0;

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    this.callCount++;
    const lastMsg = messages[messages.length - 1]?.content ?? '';

    // 从 prompt 中提取存活玩家列表，随机选一个作为 target
    const aliveMatch = lastMsg.match(/(\d+)号/g);
    const aliveIds = aliveMatch ? aliveMatch.map((m) => parseInt(m)) : [];
    const randomTarget = aliveIds.length > 0
      ? aliveIds[Math.floor(Math.random() * aliveIds.length)]
      : 1;

    // 根据 prompt 内容推断需要什么类型的行动
    let action: object = { type: 'skip' };
    if (lastMsg.includes('投票选择你认为') || lastMsg.includes('投票选择今晚')) {
      action = { type: 'vote', target: randomTarget };
    } else if (lastMsg.includes('查验') || lastMsg.includes('check')) {
      action = { type: 'check', target: randomTarget };
    } else if (lastMsg.includes('是否使用解药')) {
      action = Math.random() > 0.5 ? { type: 'heal' } : { type: 'skip' };
    } else if (lastMsg.includes('是否使用毒药')) {
      action = Math.random() > 0.7
        ? { type: 'poison', target: randomTarget }
        : { type: 'skip' };
    } else if (lastMsg.includes('开枪') || lastMsg.includes('shoot')) {
      action = { type: 'shoot', target: randomTarget };
    }

    return { content: JSON.stringify({
      private_note: `[Mock] 第${this.callCount}次调用`,
      speech: `我是Mock玩家，这是我的第${this.callCount}次发言。`,
      action,
    }) };
  }
}
