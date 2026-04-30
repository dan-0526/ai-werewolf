// ClaudeFetchProvider — 用原生 fetch 调 Claude Messages API

import type { AIProvider, ChatMessage } from './AIProvider.js';

export type ClaudeAuthMode = 'api-key' | 'bearer';

export class ClaudeFetchProvider implements AIProvider {
  readonly modelName: string;

  constructor(
    model: string,
    private apiKey: string,
    private baseURL: string = 'https://api.anthropic.com',
    private authMode: ClaudeAuthMode = 'api-key',
  ) {
    this.modelName = model;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const start = Date.now();
    console.log(`  [${this.modelName}] calling...`);

    // system 单独提取
    const systemParts = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content);
    const system = systemParts.join('\n\n') || undefined;

    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    if (rest.length === 0 || rest[0].role !== 'user') {
      rest.unshift({ role: 'user', content: '请开始。' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (this.authMode === 'bearer') {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else {
      headers['x-api-key'] = this.apiKey;
    }

    const resp = await fetch(`${this.baseURL.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: 512,
        ...(system ? { system } : {}),
        messages: rest,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`${this.modelName} API error (${resp.status}): ${text.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [${this.modelName}] done in ${elapsed}s`);

    const textBlock = data.content?.find((b) => b.type === 'text');
    return textBlock?.text ?? '';
  }
}
