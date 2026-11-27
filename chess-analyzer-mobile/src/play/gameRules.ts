import { Chess } from 'chess.js';
import type { GameResult } from './tournament';

export type LocalEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'insufficient'
  | 'fifty-moves'
  | 'resign'
  | 'timeout'
  | 'agreement'
  | 'adjudication';

export const END_TEXT: Record<LocalEndReason, string> = {
  checkmate: 'XEQUE-MATE',
  stalemate: 'AFOGAMENTO',
  repetition: 'REPETIÇÃO',
  insufficient: 'MATERIAL INSUFICIENTE',
  'fifty-moves': 'REGRA DOS 50 LANCES',
  resign: 'ABANDONO',
  timeout: 'TEMPO ESGOTADO',
  agreement: 'EMPATE COMBINADO',
  adjudication: 'LIMITE DE LANCES',
};

const PGN_TERMINATION: Record<LocalEndReason, string> = {
  checkmate: 'checkmate',
  stalemate: 'stalemate',
  repetition: 'threefold repetition',
  insufficient: 'insufficient material',
  'fifty-moves': '50-move rule',
  resign: 'resignation',
  timeout: 'time forfeit',
  agreement: 'draw by agreement',
  adjudication: 'adjudication',
};

/** Partidas de bot x bot param aqui (evita partidas infinitas em finais mortos). */
export const MAX_PLIES = 300;

/** Reconstrói a partida a partir dos lances em UCI. */
export function replayUci(moves: string[]): Chess {
  const chess = new Chess();
  for (const uci of moves) {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return chess;
}

/** Resultado da posição, se a partida acabou pelas regras. */
export function ruleResult(chess: Chess): { result: GameResult; reason: LocalEndReason } | null {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'repetition' };
  if (chess.isDraw()) return { result: '1/2-1/2', reason: 'fifty-moves' };
  if (chess.history().length >= MAX_PLIES) return { result: '1/2-1/2', reason: 'adjudication' };
  return null;
}

export function localPgn(
  moves: string[],
  info: { event: string; white: string; black: string; result: GameResult | null; reason?: LocalEndReason | null }
): string {
  const chess = replayUci(moves);
  const d = new Date();
  chess.setHeader('Event', info.event);
  chess.setHeader('Site', 'Noxari Chess');
  chess.setHeader('Date', `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
  chess.setHeader('White', info.white);
  chess.setHeader('Black', info.black);
  chess.setHeader('Result', info.result ?? '*');
  if (info.reason) chess.setHeader('Termination', PGN_TERMINATION[info.reason]);
  return chess.pgn();
}
