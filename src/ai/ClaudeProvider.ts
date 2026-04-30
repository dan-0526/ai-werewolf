// ClaudeProvider — Opus / Sonnet via @anthropic-ai/sdk

import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ChatMessage } from './AIProvider.js';

export class ClaudeProvider implements AIProvider {
  readonly modelName: string;
  private client: Anthropic;

  constructor(model: string, apiKey: string, baseURL?: string, authMode: 'api-key' | 'bearer' = 'api-key') {
    this.modelName = model;
    this.client = new Anthropic({
      ...(authMode === 'bearer' ? { authToken: apiKey } : { apiKey }),
      ...(baseURL ? { baseURL } : {}),
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const start = Date.now();
    console.log(`  [${this.modelName}] calling...`);

    // Anthropic SDK 要求 system 单独传
    const systemParts = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content);
    const system = systemParts.join('\n\n') || undefined;

    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // 确保第一条是 user（Anthropic 要求）
    if (rest.length === 0 || rest[0].role !== 'user') {
      rest.unshift({ role: 'user', content: '请开始。' });
    }

    const resp = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 512,
      ...(system ? { system } : {}),
      messages: rest,
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [${this.modelName}] done in ${elapsed}s`);

    const textBlock = resp.content.find((b) => b.type === 'text');
    return textBlock?.text ?? '';
  }
}
