// ProviderFactory — 根据 config 创建 AIProvider 实例

import type { AIProvider } from './AIProvider.js';
import { MockProvider } from './MockProvider.js';
import { ClaudeFetchProvider } from './ClaudeFetchProvider.js';
import { OpenAICompatProvider } from './OpenAICompatProvider.js';

export interface ModelConfig {
  provider: string;
  model?: string;
  api_key_env?: string;
  base_url?: string;
  base_url_env?: string;
  wire_api?: string;
  auth_mode?: 'api-key' | 'bearer';
  timeout_ms?: number;
}

function resolveEnv(envName?: string, fallback?: string): string {
  if (envName && process.env[envName]) return process.env[envName]!;
  return fallback ?? '';
}

function withOpenAIV1Path(baseURL: string): string {
  try {
    const url = new URL(baseURL);
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/v1';
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    // Leave non-URL strings unchanged; the provider will surface fetch errors.
  }
  return baseURL;
}

export function createProvider(name: string, config: ModelConfig): AIProvider {
  const apiKey = resolveEnv(config.api_key_env);
  const baseURL = resolveEnv(config.base_url_env, config.base_url);

  switch (config.provider) {
    case 'mock':
      return new MockProvider();

    case 'claude':
      if (!apiKey) throw new Error(`Missing API key for ${name} (env: ${config.api_key_env})`);
      return new ClaudeFetchProvider(config.model ?? 'claude-sonnet-4-6', apiKey, baseURL || undefined, config.auth_mode ?? 'api-key');

    case 'openai':
    case 'gpt':
      if (!apiKey) throw new Error(`Missing API key for ${name} (env: ${config.api_key_env})`);
      if (!baseURL) throw new Error(`Missing base_url for ${name}`);
      return new OpenAICompatProvider(
        withOpenAIV1Path(baseURL),
        apiKey,
        config.model ?? name,
        config.timeout_ms,
        config.wire_api === 'responses' ? 'responses' : 'chat',
      );

    case 'openai-compat':
      if (!apiKey) throw new Error(`Missing API key for ${name} (env: ${config.api_key_env})`);
      if (!baseURL) throw new Error(`Missing base_url for ${name}`);
      return new OpenAICompatProvider(
        baseURL,
        apiKey,
        config.model ?? name,
        config.timeout_ms,
        config.wire_api === 'responses' ? 'responses' : 'chat',
      );

    default:
      throw new Error(`Unknown provider type: ${config.provider} for model ${name}`);
  }
}
