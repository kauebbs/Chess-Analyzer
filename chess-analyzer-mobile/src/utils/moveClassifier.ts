import { Chess, Square } from 'chess.js';
import { isBookPosition } from './openings';

export interface PvLine {
  move: string; // primeiro lance da linha (UCI)
  cp: number; // perspectiva das Brancas
  mate: number | null;
}

export interface EvalData {
  cp: number; // Sempre na perspectiva das Brancas
  mate: number | null;
  bestMove: string; // 1ª melhor opção (Ex: "e2e4")
  secondBestMove: string; // 2ª melhor opção (Ex: "d2d4")
  secondCp?: number; // avaliação da 2ª linha (perspectiva das Brancas)
  secondMate?: number | null;
  pvs?: PvLine[]; // todas as linhas do MultiPV (índice 0 = melhor)
  depth: number;
  result?: '1-0' | '0-1' | '½-½'; // Preenchido quando a partida terminou
}

export type MoveKind =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface MoveKindInfo {
  label: string;
  symbol: string; // usado na lista de lances
  color: string;
}

export const MOVE_KINDS: Record<MoveKind, MoveKindInfo> = {
  brilliant: { label: 'Brilhante', symbol: '!!', color: '#26c2a3' },
  great: { label: 'Ótimo', symbol: '!', color: '#5b8bd6' },
  best: { label: 'Melhor', symbol: '★', color: '#7cbf3f' },
  excellent: { label: 'Excelente', symbol: '👍', color: '#97c25a' },
  good: { label: 'Bom', symbol: '✓', color: '#9bb08a' },
  book: { label: 'Livro', symbol: '📖', color: '#c39a6b' },
  inaccuracy: { label: 'Imprecisão', symbol: '?!', color: '#f2c230' },
  mistake: { label: 'Erro', symbol: '?', color: '#f0903a' },
  miss: { label: 'Chance perdida', symbol: '✕', color: '#ee6b5f' },
  blunder: { label: 'Capivarada', symbol: '??', color: '#e5242b' },
};

/** Ordem usada no relatório. */
export const REPORT_ORDER: MoveKind[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

export interface MoveClassification extends MoveKindInfo {
  kind: MoveKind;
  accuracy: number;
}

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

const make = (kind: MoveKind, accuracy: number): MoveClassification => ({
  kind,
  accuracy,
  ...MOVE_KINDS[kind],
});

export function cpToWinPercent(cp: number, mate: number | null | undefined): number {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? 100 : 0;
  }
  if (Math.abs(cp) >= 10000) {
    return cp > 0 ? 100 : 0;
  }
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/**
 * % de vitória como o Lichess usa para precisão (WinPercent.fromCentiPawns): o mate vira
 * ±1000 centipeões, então um mate vale ~97,5%, não 100%. Isso evita punir quem troca
 * um mate longo por uma vantagem esmagadora.
 */
export function accuracyWinPercent(cp: number, mate: number | null | undefined): number {
  const c = mate !== null && mate !== undefined ? (mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/**
 * Precisão de um lance a partir da queda na % de vitória de quem jogou
 * (fórmula do Lichess, AccuracyPercent.scala, com o bônus de incerteza de +1).
 */
export function calculateAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const diff = winBefore - winAfter;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * diff) - 3.166924740191411 + 1;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Precisão da partida por cor, como no Lichess: média entre a média ponderada pela
 * volatilidade (desvio-padrão da % de vitória numa janela) e a média harmônica.
 * A harmônica é o que faz uma capivarada derrubar bastante a precisão da partida.
 *
 * `whiteWin[i]` = % de vitória das Brancas na posição i (null se não avaliada).
 */
export function gameAccuracy(whiteWin: (number | null)[], startColor: 'w' | 'b'): Record<'w' | 'b', number | null> {
  const n = whiteWin.length;
  if (n < 2) return { w: null, b: null };

  const windowSize = Math.min(8, Math.max(2, Math.floor((n - 1) / 10)));
  const firstWindow = whiteWin.slice(0, windowSize);
  const windows: (number | null)[][] = [];
  for (let k = 0; k < Math.min(windowSize, n) - 2; k++) windows.push(firstWindow);
  for (let i = 0; i + windowSize <= n; i++) windows.push(whiteWin.slice(i, i + windowSize));

  const weights = windows.map((w) => {
    if (w.some((x) => x === null)) return null;
    const vals = w as number[];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    return Math.min(12, Math.max(0.5, sd));
  });

  const per: Record<'w' | 'b', { acc: number; weight: number }[]> = { w: [], b: [] };
  for (let i = 0; i < n - 1; i++) {
    const color: 'w' | 'b' = (i % 2 === 0) === (startColor === 'w') ? 'w' : 'b';
    const prev = whiteWin[i];
    const next = whiteWin[i + 1];
    const weight = weights[i];
    if (prev === null || next === null || weight === null || weight === undefined) continue;
    const acc = color === 'w' ? calculateAccuracy(prev, next) : calculateAccuracy(100 - prev, 100 - next);
    per[color].push({ acc, weight });
  }

  const combine = (list: { acc: number; weight: number }[]) => {
    if (list.length === 0) return null;
    const weighted = list.reduce((a, x) => a + x.acc * x.weight, 0) / list.reduce((a, x) => a + x.weight, 0);
    const harmonic = list.length / list.reduce((a, x) => a + 1 / Math.max(1, x.acc), 0);
    return Math.round(((weighted + harmonic) / 2) * 10) / 10;
  };

  return { w: combine(per.w), b: combine(per.b) };
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

type BoardPiece = NonNullable<ReturnType<Chess['get']>>;
type BoardSquarePiece = NonNullable<ReturnType<Chess['board']>[number][number]>;

const piecesOn = (board: Chess, squares: Square[]) =>
  squares.map((sq) => board.get(sq)).filter((p): p is BoardPiece => !!p);

/**
 * A peça em `square` está pendurada? (Ideia inspirada no WintrChess, reescrita aqui.)
 * - Não, se ela acabou de capturar uma peça de valor igual ou maior (troca boa).
 * - Sim, se algum atacante vale menos que ela.
 * - Sim, se tem mais atacantes que defensores (com exceções para trocas que seriam
 *   ruins para quem captura e para peças defendidas por peão).
 */
function isPieceHanging(prevBoard: Chess, board: Chess, square: Square): boolean {
  const piece = board.get(square);
  if (!piece) return false;
  const value = PIECE_VALUE[piece.type];
  const opponent = piece.color === 'w' ? 'b' : 'w';
  const prev = prevBoard.get(square);

  if (prev && prev.color !== piece.color && PIECE_VALUE[prev.type] >= value) return false;

  const defenders = piecesOn(board, board.attackers(square, piece.color));
  const attackers = piecesOn(board, board.attackers(square, opponent)).filter(
    (a) => !(a.type === 'k' && defenders.length > 0) // o rei não captura peça defendida
  );
  if (attackers.length === 0) return false;

  // Torre que capturou uma peça menor defendida por uma única peça menor: troca favorável
  if (
    piece.type === 'r' &&
    prev &&
    PIECE_VALUE[prev.type] === 3 &&
    attackers.length === 1 &&
    PIECE_VALUE[attackers[0].type] === 3
  ) {
    return false;
  }

  if (attackers.some((a) => PIECE_VALUE[a.type] < value)) return true;

  if (attackers.length > defenders.length) {
    const minAttacker = Math.min(...attackers.map((a) => PIECE_VALUE[a.type]));
    // Capturar seria um sacrifício do próprio atacante: não está pendurada
    if (value < minAttacker && defenders.some((d) => PIECE_VALUE[d.type] < minAttacker)) return false;
    // Defendida por peão: quem "se sacrifica" de verdade é o peão
    if (defenders.some((d) => d.type === 'p')) return false;
    return true;
  }
  return false;
}

/**
 * Sacrifício de peça no sentido do Chess.com ("a good piece sacrifice"): depois do lance,
 * alguma peça (cavalo, bispo, torre ou dama) de quem jogou fica pendurada — a que se moveu
 * ou outra (ignorar uma ameaça, tirar um defensor) — e o adversário pode mesmo capturá-la:
 * a captura não leva a mate em 1 (para peças menores que torre) nem deixa pendurada uma peça
 * adversária de valor igual ou maior (atacante cravado).
 */
function isPieceSacrifice(fenBefore: string, ply: PlyInput): boolean {
  if (ply.uci.length > 4) return false; // promoção não conta
  const before = new Chess(fenBefore);
  if (before.inCheck()) return false; // lance forçado por xeque
  const mover = before.turn();
  const captured = before.get(ply.to as Square);
  const capturedValue = captured ? PIECE_VALUE[captured.type] : 0;

  const after = new Chess(fenBefore);
  try {
    after.move({ from: ply.from, to: ply.to, promotion: ply.uci[4] });
  } catch {
    return false;
  }

  const sacrificed: BoardSquarePiece[] = [];
  for (const row of after.board()) {
    for (const p of row) {
      if (!p || p.color !== mover || p.type === 'k' || p.type === 'p') continue;
      // Acabou de capturar algo de valor igual ou maior: é troca, não sacrifício
      if (capturedValue >= PIECE_VALUE[p.type]) continue;
      if (isPieceHanging(before, after, p.square)) sacrificed.push(p);
    }
  }
  if (sacrificed.length === 0) return false;

  const maxSacrificed = Math.max(...sacrificed.map((p) => PIECE_VALUE[p.type]));
  for (const piece of sacrificed) {
    for (const capture of after.moves({ verbose: true }).filter((m) => m.to === piece.square)) {
      const test = new Chess(after.fen());
      test.move(capture.san);

      // O atacante estava cravado? (capturar pendura uma peça dele de valor igual ou maior)
      let attackerPinned = false;
      for (const row of test.board()) {
        for (const enemy of row) {
          if (!enemy || enemy.color === mover || enemy.type === 'k' || enemy.type === 'p') continue;
          if (PIECE_VALUE[enemy.type] >= maxSacrificed && isPieceHanging(after, test, enemy.square)) {
            attackerPinned = true;
            break;
          }
        }
        if (attackerPinned) break;
      }
      if (attackerPinned) continue;

      // Torre ou dama: vale mesmo que a captura leve a mate. Peças menores: só se não houver mate em 1
      if (PIECE_VALUE[piece.type] >= 5) return true;
      if (!test.moves().some((m) => m.endsWith('#'))) return true;
    }
  }
  return false;
}

/** 2ª linha do motor (MultiPV), se houver. */
export function secondLine(ev: EvalData): PvLine | null {
  if (ev.pvs && ev.pvs.length > 1 && ev.pvs[1].move !== ev.pvs[0].move) return ev.pvs[1];
  if (ev.secondBestMove && ev.secondCp !== undefined)
    return { move: ev.secondBestMove, cp: ev.secondCp, mate: ev.secondMate ?? null };
  return null;
}

/** % de vitória a partir da qual a posição é considerada ganha. */
const WINNING = 75;
/** "Completamente ganho mesmo sem o lance": a 2ª melhor linha já dava +7 (ou mate). */
const WINNING_ANYWAY_CP = 700;

export interface PlyInput {
  uci: string;
  from: string;
  to: string;
  san: string;
}

/**
 * Classifica todos os lances de uma linha. `evalAt(i)` é a avaliação da posição i
 * (0 = inicial). Lances sem avaliação suficiente ficam `null` (exceto lances de livro).
 */
export function classifyGame(
  positions: string[],
  plies: PlyInput[],
  evalAt: (i: number) => EvalData | null,
  minDepth: number
): (MoveClassification | null)[] {
  const out: (MoveClassification | null)[] = [];
  let stillBook = true;

  for (let i = 0; i < plies.length; i++) {
    const ply = plies[i];

    const before = evalAt(i);
    const after = evalAt(i + 1);
    const evaluated = !!before && !!after && before.depth >= minDepth && after.depth >= minDepth;

    // Livro (como no Chess.com): lance da teoria desde o início da partida — mas se o motor
    // considerar o lance impreciso (ou pior), ele deixa de contar como livro.
    if (stillBook && isBookPosition(positions[i + 1])) {
      if (!evaluated) {
        out.push(make('book', 100));
        continue;
      }
      const t = positions[i].split(' ')[1] as 'w' | 'b';
      const pov = (pct: number) => (t === 'w' ? pct : 100 - pct);
      const loss = pov(accuracyWinPercent(before!.cp, before!.mate)) - pov(accuracyWinPercent(after!.cp, after!.mate));
      if (loss <= 5) {
        out.push(make('book', 100));
        continue;
      }
    }
    stillBook = false;

    if (!evaluated || !before || !after) {
      out.push(null);
      continue;
    }

    const turn = positions[i].split(' ')[1] as 'w' | 'b';
    const forMover = (pct: number) => (turn === 'w' ? pct : 100 - pct);
    const winBefore = forMover(accuracyWinPercent(before.cp, before.mate));
    const winAfter = forMover(accuracyWinPercent(after.cp, after.mate));
    const winLoss = Math.max(0, winBefore - winAfter);
    const accuracy = Math.round(calculateAccuracy(winBefore, winAfter) * 10) / 10;
    const isTop = before.bestMove === ply.uci;

    let kind: MoveKind;
    if (isTop || winLoss <= 1) kind = 'best';
    else if (winLoss <= 2) kind = 'excellent';
    else if (winLoss <= 5) kind = 'good';
    else if (winLoss <= 10) kind = 'inaccuracy';
    else if (winLoss <= 20) kind = 'mistake';
    else kind = 'blunder';

    // Chance perdida (Chess.com): não aproveitou o erro do adversário (ou um mate) e deixou
    // escapar a posição vencedora, geralmente terminando igual ou pior.
    const prev = out[i - 1];
    const opponentErred = !!prev && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(prev.kind);
    const hadMate = before.mate !== null && forMover(before.mate > 0 ? 100 : 0) === 100;
    if (
      (opponentErred || hadMate) &&
      winBefore >= WINNING &&
      winAfter < WINNING - 10 &&
      (kind === 'inaccuracy' || kind === 'mistake' || kind === 'blunder')
    ) {
      kind = 'miss';
    }

    // Brilhante (regras do Chess.com): melhor ou quase melhor lance, com um bom sacrifício
    // de peça, sem ficar mal depois e sem estar completamente ganho com outro lance.
    const moverCp = (cp: number, mate: number | null | undefined) =>
      mate !== null && mate !== undefined ? (mate > 0 === (turn === 'w') ? 100000 : -100000) : turn === 'w' ? cp : -cp;
    const alternatives = (before.pvs ?? []).filter((pv) => pv && pv.move !== ply.uci);
    const topIsMate = before.mate !== null && moverCp(before.cp, before.mate) > 0;
    const winningAnyway = alternatives.some((pv) => {
      const v = moverCp(pv.cp, pv.mate);
      return pv.mate !== null && pv.mate !== undefined ? topIsMate && v > 0 : v >= WINNING_ANYWAY_CP;
    });
    const notWorseAfter = moverCp(after.cp, after.mate) >= 0;

    if (
      (kind === 'best' || kind === 'excellent') &&
      notWorseAfter &&
      !winningAnyway &&
      isPieceSacrifice(positions[i], ply)
    ) {
      kind = 'brilliant';
    } else if (kind === 'best' && isTop && secondLine(before)) {
      // Ótimo (Chess.com: "crítico para o resultado" ou "o único lance bom"): a 2ª opção do
      // motor era bem pior. Recapturas óbvias não contam.
      const second = secondLine(before)!;
      const winSecond = forMover(accuracyWinPercent(second.cp, second.mate));
      const prevPly = plies[i - 1];
      const isRecapture = !!prevPly && prevPly.san.includes('x') && prevPly.to === ply.to;
      const cpGap = moverCp(before.cp, before.mate) - moverCp(second.cp, second.mate);
      const punishesBlunder = !!prev && ['mistake', 'blunder'].includes(prev.kind) && cpGap >= 150;
      if ((winBefore - winSecond >= 15 || punishesBlunder) && !isRecapture) kind = 'great';
    }

    out.push(make(kind, accuracy));
  }
  return out;
}

/** Avaliação "exata" de posições finais (mate/empate), sem precisar do motor. */
export function terminalEval(chess: {
  isCheckmate(): boolean;
  isDraw(): boolean;
  isStalemate(): boolean;
  turn(): 'w' | 'b';
}): EvalData | null {
  if (chess.isCheckmate()) {
    const whiteWon = chess.turn() === 'b';
    return {
      cp: whiteWon ? 10000 : -10000,
      mate: null,
      bestMove: '',
      secondBestMove: '',
      depth: 99,
      result: whiteWon ? '1-0' : '0-1',
    };
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return { cp: 0, mate: null, bestMove: '', secondBestMove: '', depth: 99, result: '½-½' };
  }
  return null;
}

/** Média de precisão dos lances classificados. */
export function averageAccuracy(list: (MoveClassification | null)[]): number | null {
  const values = list.filter((c): c is MoveClassification => !!c).map((c) => c.accuracy);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** Fase de cada lance: abertura até sair do livro (mín. 8 lances), final com poucas peças. */
export function gamePhases(positions: string[], classifications: (MoveClassification | null)[]): GamePhase[] {
  let lastBook = -1;
  classifications.forEach((c, i) => {
    if (c?.kind === 'book') lastBook = i;
  });
  const openingEnd = Math.min(Math.max(lastBook + 1, 16), 30);

  return classifications.map((_, i) => {
    const board = positions[i + 1].split(' ')[0];
    const pieces = board.replace(/[^nbrqNBRQ]/g, '').length;
    if (pieces <= 6) return 'endgame';
    if (i < openingEnd) return 'opening';
    return 'middlegame';
  });
}

/** Rating aproximado a partir da precisão (estimativa simples, não oficial). */
export function estimateRating(accuracy: number | null): number | null {
  if (accuracy === null) return null;
  const points: [number, number][] = [
    [30, 250],
    [50, 600],
    [60, 900],
    [70, 1200],
    [80, 1600],
    [85, 1900],
    [90, 2200],
    [95, 2600],
    [98, 2900],
    [100, 3100],
  ];
  if (accuracy <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [a1, r1] = points[i];
    const [a0, r0] = points[i - 1];
    if (accuracy <= a1) return Math.round((r0 + ((accuracy - a0) / (a1 - a0)) * (r1 - r0)) / 50) * 50;
  }
  return 3100;
}

/** Ícone que resume uma fase da partida a partir da precisão nela. */
export function phaseKind(accuracy: number | null): MoveKind | null {
  if (accuracy === null) return null;
  if (accuracy >= 95) return 'great';
  if (accuracy >= 88) return 'best';
  if (accuracy >= 80) return 'excellent';
  if (accuracy >= 70) return 'good';
  if (accuracy >= 55) return 'inaccuracy';
  if (accuracy >= 40) return 'mistake';
  return 'blunder';
}
