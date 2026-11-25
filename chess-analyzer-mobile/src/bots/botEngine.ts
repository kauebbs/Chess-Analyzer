import { Chess } from 'chess.js';
import type { StockfishHandle } from '../engine/StockfishBridge';
import type { EvalData } from '../utils/moveClassifier';
import { botAcceptsDraw, botWantsDraw, pickMove, searchFor } from './botPlayer';
import { localPgn, LocalEndReason, ruleResult } from '../play/gameRules';
import type { GameResult } from '../play/tournament';

export interface BotThought {
  move: string | null;
  ev: EvalData | null;
}

export interface BotEngine {
  /** Lance do bot nessa posição. `fast` pensa menos (simulação de bot x bot). */
  think: (fen: string, rating: number, fast?: boolean) => Promise<BotThought>;
}

const THINK_TIMEOUT_MS = 10000;

/**
 * Cria o "cérebro" dos bots em cima de um Stockfish. As buscas entram numa fila (o motor faz
 * uma de cada vez); se o motor travar, o bot joga um lance qualquer para a partida não parar.
 */
export function createBotEngine(getHandle: () => StockfishHandle | null): BotEngine {
  let queue: Promise<unknown> = Promise.resolve();

  const think = (fen: string, rating: number, fast = false) => {
    const run = async (): Promise<BotThought> => {
      const handle = getHandle();
      if (!handle) return { move: pickMove(fen, null, rating), ev: null };
      let ev: EvalData | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), THINK_TIMEOUT_MS);
      });
      const done = handle.analyzePositions([fen], searchFor(rating, fast), (_, data) => {
        ev = data;
      });
      const outcome = await Promise.race([done, timeout]);
      if (timer) clearTimeout(timer);
      if (outcome === 'timeout') handle.cancelReview();
      return { move: pickMove(fen, ev, rating), ev };
    };
    const p = queue.then(run, run);
    queue = p.catch(() => null);
    return p;
  };

  return { think };
}

export interface SimSide {
  name: string;
  rating: number;
}

export interface SimResult {
  result: GameResult;
  reason: LocalEndReason;
  pgn: string;
  plies: number;
}

/**
 * Joga uma partida inteira de bot x bot sem tabuleiro (torneios). Os bots desistem quando a
 * posição fica perdida demais, como acontece em partidas de verdade.
 */
export async function simulateGame(
  engine: BotEngine,
  white: SimSide,
  black: SimSide,
  opts: { event: string; isCancelled?: () => boolean; onPly?: (plies: number) => void }
): Promise<SimResult | null> {
  const chess = new Chess();
  const moves: string[] = [];
  const lostStreak = { w: 0, b: 0 };
  let lastOffer = -99;
  for (;;) {
    if (opts.isCancelled?.()) return null;
    const end = ruleResult(chess);
    if (end) {
      return { ...end, pgn: localPgn(moves, { event: opts.event, white: white.name, black: black.name, ...end }), plies: moves.length };
    }
    const turn = chess.turn();
    const side = turn === 'w' ? white : black;
    const { move, ev } = await engine.think(chess.fen(), side.rating, true);

    // Desistência: avaliação muito ruim para quem joga por 3 lances seguidos
    if (ev && moves.length > 30 && side.rating >= 1000) {
      const sign = turn === 'w' ? 1 : -1;
      const score = ev.mate !== null ? (ev.mate * sign > 0 ? 9999 : -9999) : ev.cp * sign;
      lostStreak[turn] = score < -900 ? lostStreak[turn] + 1 : 0;
      if (lostStreak[turn] >= 3) {
        const result: GameResult = turn === 'w' ? '0-1' : '1-0';
        const reason: LocalEndReason = 'resign';
        return { result, reason, pgn: localPgn(moves, { event: opts.event, white: white.name, black: black.name, result, reason }), plies: moves.length };
      }
    }

    // Empate combinado em posições empatadas (o outro bot aceita se não estiver melhor)
    if (ev && moves.length - lastOffer >= 12 && botWantsDraw(chess.fen(), ev, turn, moves.length)) {
      lastOffer = moves.length;
      if (botAcceptsDraw(ev, turn === 'w' ? 'b' : 'w', moves.length, chess.fen())) {
        const result: GameResult = '1/2-1/2';
        const reason: LocalEndReason = 'agreement';
        return { result, reason, pgn: localPgn(moves, { event: opts.event, white: white.name, black: black.name, result, reason }), plies: moves.length };
      }
    }

    const legal = chess.moves({ verbose: true });
    const chosen = move && legal.find((m) => `${m.from}${m.to}${m.promotion ?? ''}` === move) ? move : null;
    const uci = chosen ?? (legal.length ? `${legal[0].from}${legal[0].to}${legal[0].promotion ?? ''}` : null);
    if (!uci) return null;
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    moves.push(uci);
    opts.onPly?.(moves.length);
  }
}
