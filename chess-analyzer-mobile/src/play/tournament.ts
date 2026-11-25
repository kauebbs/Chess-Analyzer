/**
 * Séries (MD1/MD3/MD5) e torneios (pontos corridos ou mata-mata), sem nada de interface.
 * O mesmo estado serve para o torneio local e para o online (guardado como JSON no Firebase).
 */

export type GameResult = '1-0' | '0-1' | '1/2-1/2';
export type Format = 'roundrobin' | 'knockout';
export type BestOf = 1 | 3 | 5;

export interface Participant {
  id: string;
  name: string;
  kind: 'human' | 'bot';
  rating?: number;
  /** Jogador online (Firebase uid). */
  uid?: string;
}

export interface SeriesGame {
  white: string;
  black: string;
  result: GameResult | null;
  reason?: string;
  pgn?: string;
}

export interface Match {
  id: string;
  round: number;
  a: string;
  /** null = folga */
  b: string | null;
  bestOf: BestOf;
  /** No mata-mata alguém precisa passar: empate na série vira jogo de desempate. */
  mustHaveWinner: boolean;
  games: SeriesGame[];
  /** id do vencedor, 'draw' (série empatada) ou null enquanto não termina */
  winner: string | null;
  done: boolean;
}

export interface Tournament {
  name: string;
  format: Format;
  bestOf: BestOf;
  participants: Participant[];
  rounds: Match[][];
  /** Pontos corridos: todos os pares de todas as rodadas, gerados no início. */
  schedule?: [string, string | null][][];
  current: number;
  finished: boolean;
  championId: string | null;
}

const MAX_TIEBREAK_GAMES = 4;

// ---------- Séries ----------

export function newMatch(
  id: string,
  round: number,
  a: string,
  b: string | null,
  bestOf: BestOf,
  mustHaveWinner: boolean
): Match {
  const m: Match = { id, round, a, b, bestOf, mustHaveWinner, games: [], winner: null, done: false };
  if (b === null) {
    m.winner = a;
    m.done = true;
  } else {
    m.games.push({ white: a, black: b, result: null });
  }
  return m;
}

/** Pontos de cada lado na série (vitória 1, empate ½). */
export function seriesScore(m: Match): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const g of m.games) {
    if (!g.result) continue;
    if (g.result === '1/2-1/2') {
      a += 0.5;
      b += 0.5;
    } else {
      const winner = g.result === '1-0' ? g.white : g.black;
      if (winner === m.a) a += 1;
      else b += 1;
    }
  }
  return { a, b };
}

function decide(m: Match): { done: boolean; winner: string | null } {
  if (m.b === null) return { done: true, winner: m.a };
  const { a, b } = seriesScore(m);
  const played = m.games.filter((g) => g.result).length;
  const half = m.bestOf / 2;
  if (played <= m.bestOf) {
    if (a > half) return { done: true, winner: m.a };
    if (b > half) return { done: true, winner: m.b };
  }
  if (played < m.bestOf) return { done: false, winner: null };
  // Depois da série regular: quem tem mais pontos vence; empate depende do formato
  if (a !== b) return { done: true, winner: a > b ? m.a : m.b };
  if (!m.mustHaveWinner) return { done: true, winner: 'draw' };
  if (played >= m.bestOf + MAX_TIEBREAK_GAMES) return { done: true, winner: m.a }; // cabeça de chave passa
  return { done: false, winner: null };
}

/** Registra o resultado de um jogo da série e cria o próximo jogo (cores invertidas). */
export function recordSeriesGame(m: Match, gameIndex: number, result: GameResult, extra?: { pgn?: string; reason?: string }): Match {
  const next: Match = JSON.parse(JSON.stringify(m));
  const g = next.games[gameIndex];
  if (!g || g.result) return next;
  g.result = result;
  if (extra?.pgn) g.pgn = extra.pgn;
  if (extra?.reason) g.reason = extra.reason;
  const d = decide(next);
  next.done = d.done;
  next.winner = d.winner;
  if (!next.done && next.b) {
    const last = next.games[next.games.length - 1];
    next.games.push({ white: last.black, black: last.white, result: null });
  }
  return next;
}

/** Jogo da série que ainda precisa ser jogado. */
export function pendingGame(m: Match): { index: number; game: SeriesGame } | null {
  if (m.done) return null;
  const index = m.games.findIndex((g) => !g.result);
  return index >= 0 ? { index, game: m.games[index] } : null;
}

export const isTiebreak = (m: Match, index: number) => index >= m.bestOf;

// ---------- Torneio ----------

/** Ordem de chaveamento: 1×8, 4×5, 2×7, 3×6… (cabeças de chave só se cruzam no fim). */
function bracketOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/** Pontos corridos pelo método do círculo (com folga quando o número é ímpar). */
function roundRobinSchedule(ids: string[]): [string, string | null][][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: [string, string | null][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string | null][] = [];
    for (let i = 0; i < n / 2; i++) {
      let x = list[i];
      let y = list[n - 1 - i];
      if (x === null) [x, y] = [y, x];
      if (x === null) continue;
      // Alterna as cores para ninguém ficar sempre de brancas
      const swap = y !== null && (r + i) % 2 === 1;
      pairs.push(swap ? [y as string, x] : [x, y]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!); // gira todos menos o primeiro
  }
  return rounds;
}

const seedValue = (p: Participant) => p.rating ?? 1500;

export function createTournament(name: string, participants: Participant[], format: Format, bestOf: BestOf): Tournament {
  const t: Tournament = {
    name,
    format,
    bestOf,
    participants,
    rounds: [],
    current: 0,
    finished: false,
    championId: null,
  };
  if (format === 'roundrobin') {
    t.schedule = roundRobinSchedule(participants.map((p) => p.id));
    t.rounds.push(t.schedule[0].map(([a, b], i) => newMatch(`r1m${i + 1}`, 1, a, b, bestOf, false)));
  } else {
    const seeded = [...participants].sort((x, y) => seedValue(y) - seedValue(x));
    let size = 2;
    while (size < seeded.length) size *= 2;
    const order = bracketOrder(size);
    const matches: Match[] = [];
    for (let i = 0; i < order.length; i += 2) {
      const a = seeded[order[i] - 1];
      const b = seeded[order[i + 1] - 1];
      const first = a ?? b;
      const second = a && b ? b : undefined;
      matches.push(newMatch(`r1m${i / 2 + 1}`, 1, first.id, second ? second.id : null, bestOf, true));
    }
    t.rounds.push(matches);
  }
  return advance(t);
}

/** Registra o resultado de um jogo de uma partida do torneio. */
export function recordTournamentGame(
  t: Tournament,
  matchId: string,
  gameIndex: number,
  result: GameResult,
  extra?: { pgn?: string; reason?: string }
): Tournament {
  const next: Tournament = JSON.parse(JSON.stringify(t));
  for (const round of next.rounds) {
    const i = round.findIndex((m) => m.id === matchId);
    if (i >= 0) {
      round[i] = recordSeriesGame(round[i], gameIndex, result, extra);
      break;
    }
  }
  return advance(next);
}

/** Se a rodada atual terminou, cria a próxima (ou encerra o torneio). */
export function advance(t: Tournament): Tournament {
  let next = t;
  while (!next.finished) {
    const round = next.rounds[next.current];
    if (!round || !round.every((m) => m.done)) break;
    next = JSON.parse(JSON.stringify(next));
    const r = next.current + 1; // número da próxima rodada (base 1 = r + 1)
    if (next.format === 'roundrobin') {
      if (next.schedule && r < next.schedule.length) {
        next.rounds.push(next.schedule[r].map(([a, b], i) => newMatch(`r${r + 1}m${i + 1}`, r + 1, a, b, next.bestOf, false)));
        next.current = r;
      } else {
        next.finished = true;
        next.championId = standings(next)[0]?.id ?? null;
      }
    } else {
      const winners = round.map((m) => m.winner as string);
      if (winners.length <= 1) {
        next.finished = true;
        next.championId = winners[0] ?? null;
      } else {
        const matches: Match[] = [];
        for (let i = 0; i < winners.length; i += 2) {
          matches.push(newMatch(`r${r + 1}m${i / 2 + 1}`, r + 1, winners[i], winners[i + 1] ?? null, next.bestOf, true));
        }
        next.rounds.push(matches);
        next.current = r;
      }
    }
  }
  return next;
}

export interface PendingGame {
  matchId: string;
  gameIndex: number;
  white: string;
  black: string;
  tiebreak: boolean;
}

/** Jogos que podem ser jogados agora (rodada atual). */
export function pendingGames(t: Tournament): PendingGame[] {
  if (t.finished) return [];
  const out: PendingGame[] = [];
  for (const m of t.rounds[t.current] ?? []) {
    const p = pendingGame(m);
    if (p) out.push({ matchId: m.id, gameIndex: p.index, white: p.game.white, black: p.game.black, tiebreak: isTiebreak(m, p.index) });
  }
  return out;
}

export interface StandingRow {
  id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  gamePoints: number;
  tiebreak: number;
}

/** Classificação: pontos por confronto (V=1, E=½), depois pontos em jogos e Sonneborn-Berger. */
export function standings(t: Tournament): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    t.participants.map((p) => [p.id, { id: p.id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, gamePoints: 0, tiebreak: 0 }])
  );
  const finished: Match[] = t.rounds.flat().filter((m) => m.done && m.b !== null);
  for (const m of finished) {
    const ra = rows.get(m.a)!;
    const rb = rows.get(m.b!)!;
    const s = seriesScore(m);
    ra.played += 1;
    rb.played += 1;
    ra.gamePoints += s.a;
    rb.gamePoints += s.b;
    if (m.winner === 'draw') {
      ra.draws += 1;
      rb.draws += 1;
      ra.points += 0.5;
      rb.points += 0.5;
    } else if (m.winner === m.a) {
      ra.wins += 1;
      rb.losses += 1;
      ra.points += 1;
    } else {
      rb.wins += 1;
      ra.losses += 1;
      rb.points += 1;
    }
  }
  for (const m of finished) {
    const ra = rows.get(m.a)!;
    const rb = rows.get(m.b!)!;
    if (m.winner === 'draw') {
      ra.tiebreak += rb.points / 2;
      rb.tiebreak += ra.points / 2;
    } else if (m.winner === m.a) ra.tiebreak += rb.points;
    else rb.tiebreak += ra.points;
  }
  const rating = (id: string) => seedValue(t.participants.find((p) => p.id === id)!);
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points || y.gamePoints - x.gamePoints || y.tiebreak - x.tiebreak || rating(y.id) - rating(x.id)
  );
}

export const participantOf = (t: Tournament, id: string | null | undefined) =>
  id ? t.participants.find((p) => p.id === id) ?? null : null;

/** Nome da rodada no mata-mata (Final, Semifinal…). */
export function roundName(t: Tournament, roundIdx: number) {
  if (t.format === 'roundrobin') return `Rodada ${roundIdx + 1}`;
  const firstRoundMatches = t.rounds[0]?.length ?? 1;
  const remaining = firstRoundMatches / 2 ** roundIdx; // partidas nessa rodada
  if (remaining <= 1) return 'Final';
  if (remaining <= 2) return 'Semifinal';
  if (remaining <= 4) return 'Quartas de final';
  if (remaining <= 8) return 'Oitavas de final';
  return `Rodada ${roundIdx + 1}`;
}

export const totalRounds = (t: Tournament) =>
  t.format === 'roundrobin' ? t.schedule?.length ?? 1 : Math.max(1, Math.ceil(Math.log2(Math.max(2, t.participants.length))));

export const bestOfLabel = (b: BestOf) => (b === 1 ? 'Partida única' : `Melhor de ${b}`);
export const formatLabel = (f: Format) => (f === 'roundrobin' ? 'Pontos corridos' : 'Mata-mata');
