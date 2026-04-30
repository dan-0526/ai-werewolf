// OpenAICompatProvider — DeepSeek / Kimi / 豆包 / GPT (chat/completions)

import type { AIProvider, ChatMessage } from './AIProvider.js';
import { randomUUID } from 'node:crypto';

type WireAPI = 'chat' | 'responses';

export class OpenAICompatProvider implements AIProvider {
  readonly modelName: string;

  constructor(
    private baseURL: string,
    private apiKey: string,
    model: string,
    private timeoutMs = 60000,
    private wireAPI: WireAPI = 'chat',
    private sessionId = `ai-werewolf-${randomUUID()}`,
  ) {
    this.modelName = model;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const start = Date.now();
    console.log(`  [${this.modelName}] calling...`);
    const url = this.wireAPI === 'responses'
      ? `${this.baseURL.replace(/\/$/, '')}/responses`
      : `${this.baseURL.replace(/\/$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.wireAPI === 'responses') {
      headers.session_id = this.sessionId;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(this.buildRequestBody(messages)),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const text = await resp.text();

    if (!resp.ok) {
      throw new Error(`${this.modelName} API error (${resp.status}): ${text.slice(0, 200)}`);
    }

    if (!text.trim()) {
      throw new Error(`${this.modelName} API returned empty response`);
    }

    const data = JSON.parse(text);

    const businessError = data as { code?: number; message?: string };
    if (typeof businessError.code === 'number' && businessError.code !== 0) {
      throw new Error(`${this.modelName} API error (${businessError.code}): ${businessError.message ?? text.slice(0, 200)}`);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [${this.modelName}] done in ${elapsed}s`);

    return this.extractText(data);
  }

  private buildRequestBody(messages: ChatMessage[]): Record<string, unknown> {
    if (this.wireAPI === 'responses') {
      return {
        model: this.modelName,
        input: messages,
        max_output_tokens: 1024,
        temperature: 0.8,
      };
    }

    return {
      model: this.modelName,
      messages,
      max_tokens: 1024,
      temperature: 0.8,
    };
  }

  private extractText(data: unknown): string {
    const obj = data as {
      output_text?: string;
      choices?: Array<{ message?: { content?: string } }>;
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    };

    if (typeof obj.output_text === 'string') return obj.output_text;

    const choiceText = obj.choices?.[0]?.message?.content;
    if (typeof choiceText === 'string') return choiceText;

    const outputText = obj.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => typeof content.text === 'string')?.text;
    return outputText ?? '';
  }
}
