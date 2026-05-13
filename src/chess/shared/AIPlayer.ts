import type { Move, Position, Side } from './types.js';
import { buildSystemPrompt, buildMovePrompt } from '../chinese/prompts.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
}

export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<ChatResult>;
}

export interface AIPlayerConfig {
  provider: AIProvider;
  side: Side;
  maxRetries: number;
  model: string;
}

export class AIPlayer {
  private provider: AIProvider;
  private messageHistory: ChatMessage[] = [];
  private side: Side;
  private maxRetries: number;
  readonly model: string;

  constructor(config: AIPlayerConfig) {
    this.provider = config.provider;
    this.side = config.side;
    this.maxRetries = config.maxRetries;
    this.model = config.model;
  }

  getSide(): Side {
    return this.side;
  }

  setSide(side: Side): void {
    this.side = side;
  }

  getHistory(): ChatMessage[] {
    return [...this.messageHistory];
  }

  addSystemMessage(content: string): void {
    this.messageHistory.push({ role: 'system', content });
  }

  addUserMessage(content: string): void {
    this.messageHistory.push({ role: 'user', content });
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  appendSeparator(message: string): void {
    this.messageHistory.push({ role: 'system', content: message });
  }

  async makeMove(boardText: string, lastMove: string | null, moveNumber: number): Promise<{
    move: Move;
    thinking?: string;
    raw: string;
    retries: number;
  }> {
    // Ensure system prompt is present
    if (this.messageHistory.length === 0) {
      this.addSystemMessage(buildSystemPrompt(this.side));
    }

    const userPrompt = buildMovePrompt(boardText, lastMove, moveNumber);
    this.addUserMessage(userPrompt);

    let retries = 0;

    while (retries <= this.maxRetries) {
      const result = await this.provider.chat([...this.messageHistory]);
      const raw = result.content;
      const parsed = this.parseResponse(raw);

      if (parsed) {
        this.messageHistory.push({ role: 'assistant', content: raw });
        return {
          move: parsed.move,
          thinking: parsed.thinking,
          raw,
          retries,
        };
      }

      // Parse failed, add error and retry
      retries++;
      if (retries <= this.maxRetries) {
        this.messageHistory.push({ role: 'assistant', content: raw });
        this.messageHistory.push({
          role: 'user',
          content: '无法解析你的回复，请严格按照 JSON 格式回复：{"move": {"from": [row, col], "to": [row, col]}, "thinking": "..."}',
        });
      }
    }

    throw new Error(`AI failed to produce a valid move after ${this.maxRetries} retries`);
  }

  private parseResponse(raw: string): { move: Move; thinking?: string } | null {
    // Try JSON extraction from ```json...``` block
    const jsonBlockMatch = raw.match(/```json\s*([\s\S]*?)```/);
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : raw;

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.move && Array.isArray(parsed.move.from) && Array.isArray(parsed.move.to)) {
        const from: Position = [parsed.move.from[0], parsed.move.from[1]];
        const to: Position = [parsed.move.to[0], parsed.move.to[1]];
        return {
          move: { from, to, piece: 0 },
          thinking: parsed.thinking,
        };
      }
    } catch {
      // JSON parse failed, try raw JSON object in text
      const rawJsonMatch = raw.match(/\{[\s\S]*"move"[\s\S]*\}/);
      if (rawJsonMatch) {
        try {
          const parsed = JSON.parse(rawJsonMatch[0]);
          if (parsed.move && Array.isArray(parsed.move.from) && Array.isArray(parsed.move.to)) {
            const from: Position = [parsed.move.from[0], parsed.move.from[1]];
            const to: Position = [parsed.move.to[0], parsed.move.to[1]];
            return {
              move: { from, to, piece: 0 },
              thinking: parsed.thinking,
            };
          }
        } catch {
          // Fall through to regex
        }
      }
    }

    // Regex fallback: from[r,c]...to[r,c]
    const regexMatch = raw.match(/from\s*\[\s*(\d+)\s*,\s*(\d+)\s*\][\s\S]*?to\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
    if (regexMatch) {
      const from: Position = [parseInt(regexMatch[1]), parseInt(regexMatch[2])];
      const to: Position = [parseInt(regexMatch[3]), parseInt(regexMatch[4])];
      return {
        move: { from, to, piece: 0 },
      };
    }

    return null;
  }
}
