// AI Provider 统一接口

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  /** 推理/思考链（如 DeepSeek R1 的 reasoning_content） */
  reasoning?: string;
}

export interface AIProvider {
  readonly modelName: string;
  chat(messages: ChatMessage[]): Promise<ChatResult>;
}
