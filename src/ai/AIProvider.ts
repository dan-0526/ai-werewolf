// AI Provider 统一接口

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  readonly modelName: string;
  chat(messages: ChatMessage[]): Promise<string>;
}
