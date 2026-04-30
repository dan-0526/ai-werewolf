import assert from 'node:assert/strict';
import test from 'node:test';
import { createProvider } from '../src/ai/ProviderFactory.js';
import { OpenAICompatProvider } from '../src/ai/OpenAICompatProvider.js';

test('creates GPT provider from the Codex GPT API env vars', () => {
  process.env.TEST_GPT_AI_KEY = 'sk-test';

  const provider = createProvider('gpt-5.4', {
    provider: 'gpt',
    model: 'gpt-5.4',
    api_key_env: 'TEST_GPT_AI_KEY',
    base_url: 'https://llm-gateway.example.test/api/v1/responses-compatible',
  });

  assert.equal(provider.modelName, 'gpt-5.4');
  assert.ok(provider instanceof OpenAICompatProvider);
});

test('GPT provider uses OpenAI v1 chat completions under a shared root base URL', async () => {
  process.env.TEST_GPT_AI_KEY = 'sk-test';
  process.env.TEST_GPT_AI_BASE_URL = 'https://gpt-ai.example';

  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const provider = createProvider('gpt-5.4', {
      provider: 'gpt',
      model: 'gpt-5.4',
      api_key_env: 'TEST_GPT_AI_KEY',
      base_url_env: 'TEST_GPT_AI_BASE_URL',
    });

    const response = await provider.chat([{ role: 'user', content: 'ping' }]);

    assert.equal(response.content, 'OK');
    assert.equal(requestedUrl, 'https://gpt-ai.example/v1/chat/completions');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GPT provider can use Responses API wire format', async () => {
  process.env.TEST_GPT_AI_KEY = 'sk-test';
  process.env.TEST_GPT_AI_BASE_URL = 'https://gpt-ai.example';

  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestHeaders: Headers;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestHeaders = new Headers(init?.headers);
    requestBody = JSON.parse(String(init?.body));
    return new Response([
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"O"}',
      '',
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"K"}',
      '',
      'event: response.completed',
      'data: {"type":"response.completed","response":{"status":"completed"}}',
      '',
      '',
    ].join('\n'), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;

  try {
    const provider = createProvider('gpt-5.4', {
      provider: 'gpt',
      model: 'gpt-5.4',
      api_key_env: 'TEST_GPT_AI_KEY',
      base_url_env: 'TEST_GPT_AI_BASE_URL',
      wire_api: 'responses',
    });

    const response = await provider.chat([{ role: 'user', content: 'ping' }]);

    assert.equal(response.content, 'OK');
    assert.equal(requestedUrl, 'https://gpt-ai.example/v1/responses');
    assert.ok(requestHeaders!.get('session_id'));
    assert.ok(requestHeaders!.get('x-client-request-id'));
    assert.equal(requestHeaders!.get('Accept'), 'text/event-stream');
    assert.equal(requestBody.model, 'gpt-5.4');
    assert.equal(requestBody.stream, true);
    assert.equal(requestBody.store, false);
    assert.deepEqual(requestBody.reasoning, { effort: 'medium' });
    assert.deepEqual(requestBody.text, { verbosity: 'low' });
    assert.deepEqual(requestBody.input, [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'ping' }],
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GPT provider preserves custom API base path for Responses API', async () => {
  process.env.TEST_GPT_AI_KEY = 'sk-test';

  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response([
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"OK"}',
      '',
      'event: response.completed',
      'data: {"type":"response.completed","response":{"status":"completed"}}',
      '',
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as typeof fetch;

  try {
    const provider = createProvider('gpt-5.4', {
      provider: 'gpt',
      model: 'gpt-5.4',
      api_key_env: 'TEST_GPT_AI_KEY',
      base_url: 'https://llm-gateway.example.test/api/v1/responses-compatible',
      wire_api: 'responses',
    });

    await provider.chat([{ role: 'user', content: 'ping' }]);

    assert.equal(requestedUrl, 'https://llm-gateway.example.test/api/v1/responses-compatible/responses');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GPT provider throws on GPT API business errors returned with HTTP 200', async () => {
  process.env.TEST_GPT_AI_KEY = 'sk-test';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({
      code: -400,
      message: '请求参数错误 缺失session_id',
      ttl: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const provider = createProvider('gpt-5.4', {
      provider: 'gpt',
      model: 'gpt-5.4',
      api_key_env: 'TEST_GPT_AI_KEY',
      base_url: 'https://llm-gateway.example.test/api/v1/responses-compatible',
      wire_api: 'responses',
    });

    await assert.rejects(
      provider.chat([{ role: 'user', content: 'ping' }]),
      /请求参数错误 缺失session_id/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GPT provider throws on empty successful GPT API responses', async () => {
  process.env.TEST_GPT_AI_KEY = 'sk-test';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response('', { status: 200 });
  }) as typeof fetch;

  try {
    const provider = createProvider('gpt-5.4', {
      provider: 'gpt',
      model: 'gpt-5.4',
      api_key_env: 'TEST_GPT_AI_KEY',
      base_url: 'https://llm-gateway.example.test/api/v1/responses-compatible',
      wire_api: 'responses',
    });

    await assert.rejects(
      provider.chat([{ role: 'user', content: 'ping' }]),
      /empty response/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
