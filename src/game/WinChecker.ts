// WinChecker — 胜负判定

import type { GameState, Faction } from './GameState.js';
import { getAlivePlayers, getAliveWolves } from './GameState.js';

export interface WinResult {
  gameOver: boolean;
  winner?: Faction;
  reason?: string;
}

export function checkWin(state: GameState): WinResult {
  const aliveWolves = getAliveWolves(state);
  const alivePlayers = getAlivePlayers(state);
  const aliveGods = alivePlayers.filter((p) =>
    p.faction === 'villager' && ['seer', 'witch', 'hunter'].includes(p.role),
  );
  const aliveCivils = alivePlayers.filter((p) => p.role === 'villager');

  // 狼人全灭 → 好人胜
  if (aliveWolves.length === 0) {
    return {
      gameOver: true,
      winner: 'villager',
      reason: '所有狼人已被消灭，好人阵营获胜！',
    };
  }

  // 屠边：神职全死 或 平民全死 → 狼人胜
  if (aliveGods.length === 0) {
    return {
      gameOver: true,
      winner: 'werewolf',
      reason: '所有神职已阵亡，狼人阵营获胜！',
    };
  }
  if (aliveCivils.length === 0) {
    return {
      gameOver: true,
      winner: 'werewolf',
      reason: '所有平民已阵亡，狼人阵营获胜！',
    };
  }

  return { gameOver: false };
}
