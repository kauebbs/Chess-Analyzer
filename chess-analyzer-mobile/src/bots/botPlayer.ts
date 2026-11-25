import { Chess } from 'chess.js';
import { EvalData } from '../utils/moveClassifier';

/**
 * Bots por rating (400–3000). O Stockfish analisa a posição com várias linhas (MultiPV) e o bot
 * escolhe entre elas: quanto menor o rating, mais ele aceita lances piores (escolha "suave" pela
 * perda em centipeões) e mais chance tem de um lance aleatório (a capivarada clássica).
 */

export const MIN_RATING = 400;
export const MAX_RATING = 3000;
export const RATING_PRESETS = [400, 800, 1200, 1500, 1800, 2100, 2400, 2800];

export interface BotProfile {
  id: string;
  name: string;
  rating: number;
}

const BOT_NAMES = [
  'Peão Paulo',
  'Cavalo Caio',
  'Bispo Bento',
  'Torre Tânia',
  'Dama Dora',
  'Rei Rogério',
  'Roque Rita',
  'Gambito Gil',
  'Xeque Xavier',
  'Mate Marta',
  'Zugzwang Zé',
  'Passant Enzo',
  'Fianchetto Fê',
  'Siciliana Sil',
  'Catalão Cadu',
  'Escocês Edu',
];

export function botName(index: number) {
  return BOT_NAMES[index % BOT_NAMES.length];
}

/** Rótulo do nível (aparece embaixo do nome). */
export function ratingLabel(rating: number) {
  if (rating < 800) return 'Iniciante';
  if (rating < 1200) return 'Casual';
  if (rating < 1600) return 'Intermediário';
  if (rating < 2000) return 'Avançado';
  if (rating < 2400) return 'Mestre';
  return 'Grande mestre';
}

export const clampRating = (r: number) => Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(r / 50) * 50));

/** Interpolação linear numa tabela [rating, valor]. */
function lerpTable(table: [number, number][], r: number) {
  if (r <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [r1, v1] = table[i];
    const [r0, v0] = table[i - 1];
    if (r <= r1) return v0 + ((v1 - v0) * (r - r0)) / (r1 - r0);
  }
  return table[table.length - 1][1];
}

export interface BotSearch {
  depth: number;
  movetimeMs: number;
}

/** Quanto o motor pensa para esse rating. `fast` é usado ao simular partidas de bot x bot. */
export function searchFor(rating: number, fast = false): BotSearch {
  const depth = Math.round(lerpTable([[400, 6], [1200, 8], [1600, 10], [2000, 12], [2400, 14], [2800, 16]], rating));
  const movetimeMs = Math.round(lerpTable([[400, 150], [1600, 400], [2400, 800], [3000, 1300]], rating));
  return fast ? { depth: Math.min(depth, 10), movetimeMs: Math.min(movetimeMs, 160) } : { depth, movetimeMs };
}

/** "Temperatura" da escolha: perda (cp) que o bot ainda acha aceitável. */
const temperature = (r: number) =>
  lerpTable([[400, 320], [800, 200], [1200, 110], [1600, 55], [2000, 24], [2400, 9], [2800, 3], [3000, 1]], r);

/** Chance de jogar um lance qualquer, sem pensar. */
const blunderChance = (r: number) => lerpTable([[400, 0.22], [800, 0.11], [1200, 0.045], [1500, 0.012], [1800, 0]], r);

function moverScore(pv: { cp: number; mate: number | null }, sign: number) {
  if (pv.mate !== null) {
    const m = pv.mate * sign;
    return m > 0 ? 100000 - m * 100 : -100000 - m * 100;
  }
  return pv.cp * sign;
}

/** Escolhe o lance do bot (UCI) a partir da análise da posição. */
export function pickMove(fen: string, ev: EvalData | null, rating: number, rng: () => number = Math.random): string | null {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return null;
  const uci = (m: { from: string; to: string; promotion?: string }) => `${m.from}${m.to}${m.promotion ?? ''}`;

  const randomMove = () => {
    // Iniciantes adoram capturar: metade das vezes o lance "aleatório" é uma captura
    const captures = legal.filter((m) => m.captured);
    const pool = captures.length > 0 && rng() < 0.5 ? captures : legal;
    return uci(pool[Math.floor(rng() * pool.length)]);
  };

  const pvs = (ev?.pvs ?? []).filter((p) => p && p.move);
  if (pvs.length === 0) return ev?.bestMove || randomMove();
  if (rng() < blunderChance(rating)) return randomMove();

  const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
  const scores = pvs.map((p) => moverScore(p, sign));
  const best = Math.max(...scores);
  const t = temperature(rating);
  const weights = scores.map((s) => {
    const loss = Math.min(3000, best - s);
    return Math.exp(-loss / t);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = rng() * total;
  for (let i = 0; i < pvs.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return pvs[i].move;
  }
  return pvs[0].move;
}

// ---------- Empates ----------

interface Material {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
  /** cor das casas dos bispos (0 = escura, 1 = clara) */
  bishopSquares: number[];
}

function material(fen: string): { w: Material; b: Material } {
  const make = (): Material => ({ p: 0, n: 0, b: 0, r: 0, q: 0, bishopSquares: [] });
  const out = { w: make(), b: make() };
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      const side = ch === ch.toUpperCase() ? out.w : out.b;
      const k = ch.toLowerCase() as keyof Omit<Material, 'bishopSquares'> | 'k';
      if (k !== 'k') side[k] += 1;
      if (k === 'b') side.bishopSquares.push((r + f) % 2);
      f += 1;
    }
  });
  return out;
}

const pieceValue = (m: Material) => m.n * 3 + m.b * 3 + m.r * 5 + m.q * 9;

/**
 * Finais conhecidos por serem empatados na prática: bispos de cores opostas, torres com no
 * máximo um peão de diferença, damas sem vantagem, e finais sem peões com material parecido.
 */
export function drawishEndgame(fen: string): string | null {
  const { w, b } = material(fen);
  const pawnDiff = Math.abs(w.p - b.p);
  const onlyBishop = (m: Material) => m.b === 1 && m.n + m.r + m.q === 0;
  const onlyRook = (m: Material) => m.r === 1 && m.n + m.b + m.q === 0;
  const onlyQueen = (m: Material) => m.q === 1 && m.n + m.b + m.r === 0;
  if (onlyBishop(w) && onlyBishop(b) && w.bishopSquares[0] !== b.bishopSquares[0] && pawnDiff <= 2) return 'bispos de cores opostas';
  if (onlyRook(w) && onlyRook(b) && pawnDiff <= 1) return 'final de torres';
  if (onlyQueen(w) && onlyQueen(b) && pawnDiff <= 1) return 'final de damas';
  if (w.p === 0 && b.p === 0 && Math.abs(pieceValue(w) - pieceValue(b)) <= 3 && pieceValue(w) + pieceValue(b) <= 16) return 'sem peões';
  return null;
}

/** Avaliação do ponto de vista de uma cor (centipeões; mate = ±9999). */
function scoreFor(ev: EvalData, color: 'w' | 'b') {
  const sign = color === 'w' ? 1 : -1;
  return ev.mate !== null ? (ev.mate * sign > 0 ? 9999 : -9999) : ev.cp * sign;
}

/** O bot quer propor empate? (posição empatada na teoria, ou igualdade total numa partida longa) */
export function botWantsDraw(fen: string, ev: EvalData | null, botColor: 'w' | 'b', plies: number): boolean {
  if (!ev || ev.mate !== null || plies < 40) return false;
  const score = scoreFor(ev, botColor);
  if (score > 120) return false; // está melhor: continua jogando
  if (drawishEndgame(fen) && Math.abs(score) <= 150) return true;
  return plies >= 100 && Math.abs(score) <= 20;
}

/** O bot aceita empate quando não está melhor (ou quando a posição é empatada na teoria). */
export function botAcceptsDraw(ev: EvalData | null, botColor: 'w' | 'b', plies: number, fen?: string) {
  if (!ev || plies < 30) return false;
  const score = scoreFor(ev, botColor);
  if (fen && drawishEndgame(fen) && score <= 150) return true;
  return score < 40;
}
