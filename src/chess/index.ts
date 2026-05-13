#!/usr/bin/env node
// CLI 入口 — AI Chinese Chess Express/WebSocket 服务器

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createProvider, type ModelConfig } from '../ai/ProviderFactory.js';
import { AIPlayer } from './shared/AIPlayer.js';
import { GameMaster } from './shared/GameMaster.js';
import { ChessLogger } from './shared/ChessLogger.js';
import type { WSEvent, GameConfig } from './shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// --- CLI argument parsing ---
const args = process.argv.slice(2);
let configPath = resolve(projectRoot, 'chess.config.yaml');
let replayPath: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && args[i + 1]) {
    configPath = resolve(args[++i]);
  } else if (args[i] === '--replay') {
    replayPath = args[i + 1] ? resolve(args[++i]) : '';
  }
}

// --- Load config ---
if (!existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  process.exit(1);
}

const rawConfig = parseYaml(readFileSync(configPath, 'utf-8')) as {
  game: {
    name: string;
    mode: string;
    bo: number;
    move_delay_ms: number;
    max_retries: number;
    language: string;
  };
  models: Record<string, ModelConfig>;
  players: { red: { model: string }; black: { model: string } };
  server: { port: number; open_browser: boolean };
};

const gameConfig: GameConfig = {
  name: rawConfig.game.name,
  mode: rawConfig.game.mode as 'chinese' | 'western',
  bo: rawConfig.game.bo,
  moveDelayMs: rawConfig.game.move_delay_ms,
  maxRetries: rawConfig.game.max_retries,
  language: rawConfig.game.language,
};

const serverPort = rawConfig.server.port;

// --- Express + HTTP + WebSocket setup ---
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Serve static files for chess UI
const publicChessDir = resolve(projectRoot, 'public/chess');
if (existsSync(publicChessDir)) {
  app.use('/chess', express.static(publicChessDir));
}

// Broadcast helper
function broadcast(event: WSEvent): void {
  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// --- Replay mode ---
if (replayPath !== null) {
  // Resolve replay file: if empty string, find latest god.jsonl
  let replayFile = replayPath;
  if (!replayFile) {
    console.error('Usage: --replay <path-to-god.jsonl>');
    process.exit(1);
  }
  if (!existsSync(replayFile)) {
    console.error(`Replay file not found: ${replayFile}`);
    process.exit(1);
  }

  // Serve replay data via API
  app.get('/api/replay', (_req, res) => {
    const content = readFileSync(replayFile, 'utf-8');
    const events = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    res.json(events);
  });

  httpServer.listen(serverPort, () => {
    console.log(`[Replay] Server running at http://localhost:${serverPort}/chess`);
  });
} else {
  // --- Live mode ---
  startLiveMatch().catch(err => {
    console.error('Match error:', err);
    process.exit(1);
  });
}

async function startLiveMatch(): Promise<void> {
  // Create AI providers from config
  const redModelName = rawConfig.players.red.model;
  const blackModelName = rawConfig.players.black.model;
  const redModelConfig = rawConfig.models[redModelName];
  const blackModelConfig = rawConfig.models[blackModelName];

  if (!redModelConfig) throw new Error(`Model config not found: ${redModelName}`);
  if (!blackModelConfig) throw new Error(`Model config not found: ${blackModelName}`);

  const redProvider = createProvider(redModelName, redModelConfig);
  const blackProvider = createProvider(blackModelName, blackModelConfig);

  // Create AIPlayer instances
  const redPlayer = new AIPlayer({
    provider: redProvider,
    side: 'red',
    maxRetries: gameConfig.maxRetries,
    model: redModelConfig.model ?? redModelName,
  });

  const blackPlayer = new AIPlayer({
    provider: blackProvider,
    side: 'black',
    maxRetries: gameConfig.maxRetries,
    model: blackModelConfig.model ?? blackModelName,
  });

  // Create logger
  const matchId = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = new ChessLogger(projectRoot, matchId);

  // Create GameMaster with broadcast callback
  const gm = new GameMaster(
    {
      game: gameConfig,
      logger,
      onEvent: (event) => broadcast(event),
    },
    redPlayer,
    blackPlayer,
  );

  // Start server
  httpServer.listen(serverPort, () => {
    console.log(`[Live] Server running at http://localhost:${serverPort}/chess`);
    console.log(`[Live] WebSocket on ws://localhost:${serverPort}`);
    console.log(`[Live] Match: ${redModelConfig.model} (red) vs ${blackModelConfig.model} (black), BO${gameConfig.bo}`);
  });

  // Run match
  const result = await gm.runMatch();
  console.log(`\n[Match Complete] Winner: ${result.winner}`);
  console.log(`[Final Score] ${JSON.stringify(result.finalScore)}`);
  console.log(`[Logs] ${logger.getLogDir()}`);
}
