// OpenAICompatProvider — DeepSeek / Kimi / 豆包 / GPT

import type { AIProvider, ChatMessage, ChatResult } from './AIProvider.js';
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

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
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
      headers.Accept = 'text/event-stream';
      headers.originator = 'Codex Desktop';
      headers.session_id = this.sessionId;
      headers['x-client-request-id'] = this.sessionId;
      headers['x-codex-turn-metadata'] = JSON.stringify({
        turn_id: this.sessionId,
        workspaces: {},
        sandbox: 'seatbelt',
      });
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

    if (this.wireAPI === 'responses') {
      const responseText = this.extractResponsesText(text);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  [${this.modelName}] done in ${elapsed}s`);
      return { content: responseText };
    }

    const data = JSON.parse(text);

    const businessError = data as { code?: number; message?: string };
    if (typeof businessError.code === 'number' && businessError.code !== 0) {
      throw new Error(`${this.modelName} API error (${businessError.code}): ${businessError.message ?? text.slice(0, 200)}`);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [${this.modelName}] done in ${elapsed}s`);

    return this.extractResult(data);
  }

  private buildRequestBody(messages: ChatMessage[]): Record<string, unknown> {
    if (this.wireAPI === 'responses') {
      const instructions = messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n\n') || undefined;
      const input = messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          type: 'message',
          role: message.role,
          content: [{ type: 'input_text', text: message.content }],
        }));

      return {
        model: this.modelName,
        ...(instructions ? { instructions } : {}),
        input: input.length > 0 ? input : [{
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: '请开始。' }],
        }],
        stream: true,
        store: false,
        reasoning: { effort: 'medium' },
        text: { verbosity: 'low' },
        include: ['reasoning.encrypted_content'],
        tools: [],
        tool_choice: 'auto',
        parallel_tool_calls: true,
        prompt_cache_key: this.sessionId,
      };
    }

    return {
      model: this.modelName,
      messages,
      max_tokens: 1024,
      temperature: 0.8,
    };
  }

  private extractResponsesText(text: string): string {
    if (text.trim().startsWith('{')) {
      const data = JSON.parse(text);
      const businessError = data as { code?: number; message?: string };
      if (typeof businessError.code === 'number' && businessError.code !== 0) {
        throw new Error(`${this.modelName} API error (${businessError.code}): ${businessError.message ?? text.slice(0, 200)}`);
      }
      return this.extractResult(data).content;
    }

    let result = '';
    for (const block of text.split('\n\n')) {
      const dataLines = block
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6));
      if (dataLines.length === 0) continue;

      const data = dataLines.join('\n').trim();
      if (!data || data === '[DONE]') continue;

      try {
        const event = JSON.parse(data) as {
          delta?: string;
          type?: string;
          response?: unknown;
        };
        if (typeof event.delta === 'string') {
          result += event.delta;
        } else if (event.type === 'response.completed' && !result) {
          result += this.extractResult(event.response).content;
        }
      } catch {
        // Ignore malformed SSE chunks; the final empty-result guard catches bad streams.
      }
    }

    if (!result.trim()) {
      throw new Error(`${this.modelName} API returned no text in Responses stream`);
    }
    return result;
  }

  private extractResult(data: unknown): ChatResult {
    const obj = data as {
      output_text?: string;
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    };

    if (typeof obj.output_text === 'string') return { content: obj.output_text };

    const msg = obj.choices?.[0]?.message;
    if (msg) {
      const content = msg.content;
      const reasoning = msg.reasoning_content;

      // 有 content 且非空 → 直接用（标准路径）
      if (typeof content === 'string' && content.trim()) {
        return {
          content,
          reasoning: (typeof reasoning === 'string' && reasoning.trim()) ? reasoning : undefined,
        };
      }

      // content 为空但有 reasoning_content → reasoning 模型只产出了思考链
      // 尝试从思考链中提取 JSON（有些模型会把回复混在思考链末尾）
      if (typeof reasoning === 'string' && reasoning.trim()) {
        const jsonMatch = reasoning.match(/(\{[\s\S]*\})\s*$/);
        if (jsonMatch) return { content: jsonMatch[1], reasoning };
      }

      // 两个都有但 content 是空字符串 → 返回空，让上层重试
      return { content: '', reasoning: (typeof reasoning === 'string' && reasoning.trim()) ? reasoning : undefined };
    }

    const outputText = obj.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => typeof content.text === 'string')?.text;
    return { content: outputText ?? '' };
  }
}
