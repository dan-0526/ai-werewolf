import { ChessBoard } from '../chinese/board.js';
import { ChessRules } from '../chinese/rules.js';
import { moveToNotation } from '../chinese/notation.js';
import { buildSystemPrompt } from '../chinese/prompts.js';
import { ChessLogger } from './ChessLogger.js';
import { AIPlayer } from './AIPlayer.js';
import type { GameConfig, Move, Side, WSEvent } from './types.js';
import { Piece } from './types.js';

export interface GameMasterConfig {
  game: GameConfig;
  logger: ChessLogger;
  onEvent?: (event: WSEvent) => void;
}

export interface MatchResult {
  winner: string;
  finalScore: Record<string, number>;
  games: GameResult[];
}

export interface GameResult {
  gameNum: number;
  winner: Side | 'draw';
  reason: string;
  moves: number;
}

export class GameMaster {
  private config: GameMasterConfig;
  private player1: AIPlayer;
  private player2: AIPlayer;

  constructor(config: GameMasterConfig, player1: AIPlayer, player2: AIPlayer) {
    this.config = config;
    this.player1 = player1;
    this.player2 = player2;
  }

  async runMatch(): Promise<MatchResult> {
    const { game, logger } = this.config;
    const score: Record<string, number> = {
      [this.player1.model]: 0,
      [this.player2.model]: 0,
    };
    const games: GameResult[] = [];
    const winTarget = Math.ceil(game.bo / 2);
    // Emit match_start
    const matchStartEvent: WSEvent = {
      type: 'match_start',
      bo: game.bo,
      players: { red: this.player1.model, black: this.player2.model },
    };
    this.emit(matchStartEvent);
    logger.logEvent(matchStartEvent);

    for (let gameNum = 1; gameNum <= game.bo; gameNum++) {
      // Alternate sides: even games swap
      const isEvenGame = gameNum % 2 === 0;
      const redPlayer = isEvenGame ? this.player2 : this.player1;
      const blackPlayer = isEvenGame ? this.player1 : this.player2;

      // Set sides and system prompts
      redPlayer.setSide('red');
      blackPlayer.setSide('black');
      redPlayer.clearHistory();
      blackPlayer.clearHistory();
      redPlayer.addSystemMessage(buildSystemPrompt('red'));
      blackPlayer.addSystemMessage(buildSystemPrompt('black'));

      const result = await this.runGame(gameNum, redPlayer, blackPlayer);
      games.push(result);

      // Update score
      if (result.winner === 'draw') {
        score[redPlayer.model] += 0.5;
        score[blackPlayer.model] += 0.5;
      } else {
        const winnerPlayer = result.winner === 'red' ? redPlayer : blackPlayer;
        score[winnerPlayer.model] += 1;
      }

      // Log game end
      const gameEndEvent: WSEvent = {
        type: 'game_end',
        game: gameNum,
        winner: result.winner,
        reason: result.reason,
        score,
      };
      this.emit(gameEndEvent);
      logger.logEvent(gameEndEvent);
      logger.logGameEnd(gameNum, result.winner, result.reason, score);

      // Check if match decided
      if (score[this.player1.model] >= winTarget || score[this.player2.model] >= winTarget) {
        break;
      }

      // Append separator between games
      redPlayer.appendSeparator(`--- 第 ${gameNum} 局结束 ---`);
      blackPlayer.appendSeparator(`--- 第 ${gameNum} 局结束 ---`);
    }
    // Determine match winner
    const winner = score[this.player1.model] >= score[this.player2.model]
      ? this.player1.model
      : this.player2.model;

    const matchEndEvent: WSEvent = {
      type: 'match_end',
      winner,
      finalScore: score,
    };
    this.emit(matchEndEvent);
    logger.logEvent(matchEndEvent);

    return { winner, finalScore: score, games };
  }

  private emit(event: WSEvent): void {
    this.config.onEvent?.(event);
  }

  private async runGame(gameNum: number, redPlayer: AIPlayer, blackPlayer: AIPlayer): Promise<GameResult> {
    const { game, logger } = this.config;
    const board = new ChessBoard();
    let currentSide: Side = 'red';
    let moveCount = 0;
    let lastNotation: string | null = null;

    // Log and emit game start
    const gameStartEvent: WSEvent = {
      type: 'game_start',
      game: gameNum,
      red: redPlayer.model,
      black: blackPlayer.model,
    };
    this.emit(gameStartEvent);
    logger.logEvent(gameStartEvent);
    logger.logGameStart(gameNum, redPlayer.model, blackPlayer.model);
    const maxMoves = 200;

    while (moveCount < maxMoves) {
      moveCount++;
      const currentPlayer = currentSide === 'red' ? redPlayer : blackPlayer;

      // Get move from AI
      const { move, thinking, raw } = await currentPlayer.makeMove(
        board.toText(),
        lastNotation,
        moveCount,
      );

      // Fill piece field from board
      move.piece = board.get(move.from);

      // Log raw AI interaction
      logger.logRaw({
        player: currentPlayer.model,
        side: currentSide,
        messages: currentPlayer.getHistory(),
        response: raw,
      });

      // Validate move
      if (move.piece === Piece.Empty || !ChessRules.isLegalMove(board, move, currentSide)) {
        const attemptStr = `[${move.from}]->[${move.to}]`;
        const reason = move.piece === Piece.Empty ? '起始位置无棋子' : '非法走法';
        const illegalEvent: WSEvent = {
          type: 'illegal_move',
          player: currentSide,
          attempt: attemptStr,
          reason,
          retry: 0,
        };
        this.emit(illegalEvent);
        logger.logEvent(illegalEvent);

        // Illegal move = immediate loss
        const winner: Side = currentSide === 'red' ? 'black' : 'red';
        return { gameNum, winner, reason: `${currentSide}方非法走子`, moves: moveCount };
      }
      // Generate notation and apply move
      const notation = moveToNotation(board, move, currentSide);
      board.applyMove(move);
      lastNotation = notation;

      // Emit move event
      const moveEvent: WSEvent = {
        type: 'move',
        player: currentSide,
        from: move.from,
        to: move.to,
        piece: board.pieceName(move.piece),
        notation,
        thinking,
      };
      this.emit(moveEvent);
      logger.logEvent(moveEvent);
      logger.logMove(moveCount, currentSide, notation, thinking);

      // Check checkmate/stalemate for opponent
      const opponentSide: Side = currentSide === 'red' ? 'black' : 'red';

      if (ChessRules.isCheckmate(board, opponentSide)) {
        return { gameNum, winner: currentSide, reason: '将杀', moves: moveCount };
      }

      if (ChessRules.isStalemate(board, opponentSide)) {
        return { gameNum, winner: currentSide, reason: '困毙', moves: moveCount };
      }

      // Delay between moves
      if (game.moveDelayMs > 0) {
        await this.delay(game.moveDelayMs);
      }

      // Switch sides
      currentSide = opponentSide;
    }

    // Max moves reached: draw
    return { gameNum, winner: 'draw', reason: '超过最大回合数', moves: maxMoves };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
