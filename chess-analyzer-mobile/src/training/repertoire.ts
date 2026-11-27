import { Chess } from 'chess.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parsePgn, GameSummary } from '../services/gameSources';
import { openingNameAt } from '../utils/openings';
import { explainMove, sanOf } from '../utils/moveExplainer';
import type { EvalData } from '../utils/moveClassifier';

/**
 * Treino de aberturas no estilo Lotus: o repertório sai das partidas da própria pessoa.
 * 1) monta a árvore dos lances dela nos primeiros lances (de brancas e de pretas);
 * 2) o Stockfish avalia as posições em que é a vez dela (quais lances são bons ali);
 * 3) vira um baralho de "qual é o seu lance aqui?", com repetição espaçada: o que ela erra volta logo.
 */

export type Side = 'w' | 'b';
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export interface RepMove {
  uci: string;
  san: string;
  count: number;
  /** Pontos que ela fez nas partidas com esse lance (1 vitória, ½ empate). */
  score: number;
}

export interface RepNode {
  key: string;
  fen: string;
  color: Side;
  /** Quantas partidas passaram por aqui. */
  reach: number;
  moves: RepMove[];
  /** Caminho até a posição (SAN), para mostrar a linha. */
  path: string[];
}

export interface DrillCard {
  key: string;
  fen: string;
  color: Side;
  path: string[];
  opening: string | null;
  reach: number;
  /** Lances aceitos (até 0,3 peão do melhor), em UCI; o primeiro é o melhor. */
  accepted: string[];
  bestSan: string;
  bestWhy: string[];
  /** Lance que ela mais jogou aqui, e se ele é ruim, o porquê. */
  usual: string;
  usualSan: string;
  usualOk: boolean;
  usualWhy: string[];
  /** Quantas vezes ela jogou um lance fora dos aceitos. */
  wrong: number;
}

export interface CardProgress {
  box: number; // 0 (novo/errou) … 5 (dominado)
  due: number; // quando revisar (ms)
  right: number;
  misses: number;
}

export interface TrainerData {
  user: string;
  source: 'chesscom' | 'lichess';
  games: number;
  builtAt: number;
  record: Record<Side, { games: number; score: number }>;
  cards: DrillCard[];
  progress: Record<string, CardProgress>;
}

/** Árvore dos lances da pessoa (os primeiros `maxMoves` lances dela em cada partida). */
export function buildTree(games: GameSummary[], user: string, maxMoves = 8) {
  const u = user.trim().toLowerCase();
  const nodes = new Map<string, RepNode>();
  const record: Record<Side, { games: number; score: number }> = { w: { games: 0, score: 0 }, b: { games: 0, score: 0 } };
  let used = 0;
  for (const g of games) {
    const color: Side | null = g.white.toLowerCase() === u ? 'w' : g.black.toLowerCase() === u ? 'b' : null;
    if (!color) continue;
    let parsed;
    try {
      parsed = parsePgn(g.pgn);
    } catch {
      continue;
    }
    used++;
    const score = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (color === 'w') ? 1 : 0;
    record[color].games++;
    record[color].score += score;
    const path: string[] = [];
    parsed.moves.slice(0, maxMoves * 2).forEach((m) => {
      const turn = m.before.split(' ')[1] as Side;
      if (turn === color) {
        const k = `${color}|${key(m.before)}`;
        const node = nodes.get(k) ?? { key: k, fen: m.before, color, reach: 0, moves: [], path: [...path] };
        node.reach++;
        const mv = node.moves.find((x) => x.uci === m.uci);
        if (mv) {
          mv.count++;
          mv.score += score;
        } else node.moves.push({ uci: m.uci, san: m.san, count: 1, score });
        nodes.set(k, node);
      }
      path.push(m.san);
    });
  }
  const list = [...nodes.values()].sort((a, b) => b.reach - a.reach);
  list.forEach((n) => n.moves.sort((a, b) => b.count - a.count));
  return { nodes: list, games: used, record };
}

/**
 * Transforma as posições avaliadas em cartas de treino.
 * `evalOf(fen)` devolve a avaliação (com MultiPV) da posição; `afterEval(fen)` a avaliação depois de um lance.
 */
export function makeCards(
  nodes: RepNode[],
  evalOf: (fen: string) => EvalData | null,
  afterEval: (fen: string) => EvalData | null
): DrillCard[] {
  const cards: DrillCard[] = [];
  for (const n of nodes) {
    const ev = evalOf(n.fen);
    if (!ev || !ev.bestMove) continue;
    const sign = n.color === 'w' ? 1 : -1;
    const val = (cp: number, mate: number | null | undefined) => (mate ? 10000 * Math.sign(mate) : cp) * sign;
    const best = val(ev.cp, ev.mate);
    const accepted = [ev.bestMove, ...(ev.pvs ?? []).slice(1).filter((p) => best - val(p.cp, p.mate) <= 30).map((p) => p.move)];
    const usual = n.moves[0];
    let usualOk = accepted.includes(usual.uci);
    let usualWhy: string[] = [];
    if (!usualOk) {
      const c = new Chess(n.fen);
      c.move({ from: usual.uci.slice(0, 2), to: usual.uci.slice(2, 4), promotion: (usual.uci[4] as any) ?? 'q' });
      const ea = afterEval(c.fen());
      if (ea) {
        const loss = best - val(ea.cp, ea.mate);
        if (loss <= 30) {
          usualOk = true; // o motor não listou, mas avalia igual
          accepted.push(usual.uci);
        } else {
          const kind = loss >= 200 ? 'blunder' : loss >= 90 ? 'mistake' : 'inaccuracy';
          usualWhy = explainMove({ fenBefore: n.fen, played: usual.uci, kind, before: ev, after: ea }).reasons;
        }
      }
    }
    const bestWhy = explainMove({ fenBefore: n.fen, played: ev.bestMove, kind: 'best', before: ev, after: null }).reasons.filter(
      (r) => !/motor escolhe/.test(r)
    );
    let opening: string | null = null;
    try {
      const c = new Chess(n.fen);
      c.move({ from: ev.bestMove.slice(0, 2), to: ev.bestMove.slice(2, 4), promotion: (ev.bestMove[4] as any) ?? 'q' });
      opening = openingNameAt(c.fen()) ?? openingNameAt(n.fen);
    } catch {
      opening = openingNameAt(n.fen);
    }
    cards.push({
      key: n.key,
      fen: n.fen,
      color: n.color,
      path: n.path,
      opening,
      reach: n.reach,
      accepted: [...new Set(accepted)],
      bestSan: sanOf(n.fen, ev.bestMove),
      bestWhy,
      usual: usual.uci,
      usualSan: usual.san,
      usualOk,
      usualWhy,
      wrong: n.moves.filter((m) => !accepted.includes(m.uci)).reduce((s, m) => s + m.count, 0),
    });
  }
  return cards;
}

// ---------------------------------------------------------------- repetição espaçada

const DAY = 24 * 3600 * 1000;
const INTERVAL = [0, 10 * 60 * 1000, DAY, 3 * DAY, 7 * DAY, 21 * DAY];

export const isMastered = (p?: CardProgress) => !!p && p.box >= 4;

/** Próxima carta: primeiro as vencidas (as que ela erra nas partidas antes), depois as novas. */
export function nextCard(data: TrainerData, now = Date.now(), skip?: string): DrillCard | null {
  const scored = data.cards
    .filter((c) => c.key !== skip)
    .map((c) => {
      const p = data.progress[c.key];
      const due = !p || p.due <= now;
      const priority = c.wrong * 3 + c.reach + (p ? (5 - p.box) * 2 : 4);
      return { c, due, priority, isNew: !p };
    })
    .filter((x) => x.due)
    .sort((a, b) => b.priority - a.priority);
  return scored[0]?.c ?? null;
}

export function grade(data: TrainerData, card: DrillCard, correct: boolean, now = Date.now()): TrainerData {
  const p = data.progress[card.key] ?? { box: 0, due: now, right: 0, misses: 0 };
  const box = correct ? Math.min(5, p.box + 1) : 0;
  return {
    ...data,
    progress: {
      ...data.progress,
      [card.key]: { box, due: now + INTERVAL[box], right: p.right + (correct ? 1 : 0), misses: p.misses + (correct ? 0 : 1) },
    },
  };
}

// ---------------------------------------------------------------- armazenamento

const STORE = 'opening-trainer-v1';

export async function loadTrainer(): Promise<TrainerData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as TrainerData) : null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveTrainer(data: TrainerData) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(STORE, JSON.stringify(data)).catch(() => {});
  }, 400);
}

export async function clearTrainer() {
  await AsyncStorage.removeItem(STORE).catch(() => {});
}
