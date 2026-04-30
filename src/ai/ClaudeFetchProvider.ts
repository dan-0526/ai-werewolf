// ClaudeFetchProvider — 用原生 fetch + streaming 调 Claude Messages API

import type { AIProvider, ChatMessage, ChatResult } from './AIProvider.js';

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

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
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
        max_tokens: 16000,
        stream: true,
        thinking: { type: 'enabled', budget_tokens: 10000 },
        ...(system ? { system } : {}),
        messages: rest,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`${this.modelName} API error (${resp.status}): ${text.slice(0, 200)}`);
    }

    // 从 SSE 流中拼出完整文本和思考链
    const { text, thinking } = await this.readStream(resp);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [${this.modelName}] done in ${elapsed}s`);

    return { content: text, reasoning: thinking || undefined };
  }

  private async readStream(resp: Response): Promise<{ text: string; thinking: string }> {
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let text = '';
    let thinking = '';
    let buffer = '';
    let currentBlockType: 'text' | 'thinking' | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_start') {
            currentBlockType = event.content_block?.type === 'thinking' ? 'thinking' : 'text';
          } else if (event.type === 'content_block_delta') {
            if (currentBlockType === 'thinking' && event.delta?.thinking) {
              thinking += event.delta.thinking;
            } else if (event.delta?.text) {
              text += event.delta.text;
            }
          } else if (event.type === 'content_block_stop') {
            currentBlockType = null;
          }
        } catch {
          // 忽略非 JSON 行
        }
      }
    }

    return { text, thinking };
  }
}
