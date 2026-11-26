import { get, onValue, ref, remove, runTransaction, set, update } from 'firebase/database';
import { database, ensureSignedIn, serverNow } from './firebase';
import { WEB_URL } from '../config/firebase';
import { cancelWaitingGame, createGame, joinGame, normalizeCode, TimeControl } from './gameService';
import type { BestOf, Format, GameResult, Participant, Tournament } from '../play/tournament';

/**
 * Torneio online: `tournaments/{código}` no Realtime Database.
 * - O anfitrião é quem manda no estado (rodadas, chaves, classificação) e simula os jogos de bot x bot.
 * - Cada jogador escreve só a própria inscrição, o resultado dos seus jogos e o link da mesa.
 * - Jogo de pessoa x pessoa vira uma sala comum (games/…); pessoa x bot roda no aparelho da pessoa.
 */

export interface OnlinePlayer {
  id: string;
  name: string;
  kind: 'human' | 'bot';
  rating?: number;
  uid?: string;
  joinedAt: number;
}

export interface OnlineTournamentDoc {
  code: string;
  createdAt: number;
  host: string;
  name: string;
  status: 'lobby' | 'running' | 'finished';
  settings: { format: Format; bestOf: BestOf; tc: { minutes: number; increment: number } | null };
  players: Record<string, OnlinePlayer>;
  state: Tournament | null;
  results: Record<string, { result: GameResult; reason?: string; pgn?: string; by?: string }>;
  links: Record<string, string>;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const tRef = (code: string, path = '') => ref(database(), `tournaments/${code}${path ? `/${path}` : ''}`);

/** Erro de permissão do Firebase = regras antigas no banco (sem a parte de torneios). */
function friendly(e: any): Error {
  const msg = String(e?.message ?? e ?? '');
  if (/permission/i.test(msg)) {
    return new Error(
      'O Firebase bloqueou o torneio: as regras do banco estão desatualizadas. Publique o arquivo firebase/database.rules.json (veja ONLINE.md) e tente de novo.'
    );
  }
  return e instanceof Error ? e : new Error(msg || 'Erro desconhecido');
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw friendly(e);
  }
}

export const gameKey = (matchId: string, gameIndex: number) => `${matchId}_g${gameIndex}`;

export function tournamentLink(code: string) {
  return WEB_URL ? `${WEB_URL.replace(/\/$/, '')}/?torneio=${code}` : `chessanalyzer://torneio/${code}`;
}

/** chessanalyzer://torneio/ABC123 ou https://...?torneio=ABC123 */
export function tournamentCodeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const query = url.match(/[?&]torneio=([A-Za-z0-9]{4,10})/);
  if (query) return normalizeCode(query[1]);
  const path = url.match(/torneio\/([A-Za-z0-9]{4,10})/);
  return path ? normalizeCode(path[1]) : null;
}

function fromSnapshot(code: string, v: any): OnlineTournamentDoc | null {
  if (!v) return null;
  let state: Tournament | null = null;
  try {
    state = v.state ? JSON.parse(v.state) : null;
  } catch {
    state = null;
  }
  return {
    code,
    createdAt: v.createdAt ?? 0,
    host: v.host,
    name: v.name ?? 'Torneio',
    status: v.status ?? 'lobby',
    settings: {
      format: v.settings?.format ?? 'roundrobin',
      bestOf: v.settings?.bestOf ?? 1,
      tc: v.settings?.tc ?? null,
    },
    players: v.players ?? {},
    state,
    results: v.results ?? {},
    links: v.links ?? {},
  };
}

export async function createOnlineTournament(opts: {
  name: string;
  hostName: string;
  hostPlays: boolean;
  format: Format;
  bestOf: BestOf;
  tc: { minutes: number; increment: number } | null;
  bots: { name: string; rating: number }[];
}): Promise<string> {
  return guard(() => createOnlineTournamentRaw(opts));
}

async function createOnlineTournamentRaw(opts: Parameters<typeof createOnlineTournament>[0]): Promise<string> {
  const uid = await ensureSignedIn();
  const now = serverNow();
  const players: Record<string, OnlinePlayer> = {};
  if (opts.hostPlays) players[uid] = { id: uid, name: opts.hostName || 'Anfitrião', kind: 'human', uid, joinedAt: now };
  opts.bots.forEach((b, i) => {
    const id = `bot${i + 1}_${Math.random().toString(36).slice(2, 7)}`;
    players[id] = { id, name: b.name, kind: 'bot', rating: b.rating, joinedAt: now + i + 1 };
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const res = await runTransaction(tRef(code), (current) => {
      if (current) return; // código em uso
      return {
        createdAt: now,
        host: uid,
        name: opts.name || 'Torneio',
        status: 'lobby',
        settings: { format: opts.format, bestOf: opts.bestOf, tc: opts.tc },
        players,
      };
    });
    if (res.committed) return code;
  }
  throw new Error('Não foi possível criar o torneio. Tente de novo.');
}

export async function joinOnlineTournament(code: string, name: string): Promise<OnlineTournamentDoc> {
  return guard(() => joinOnlineTournamentRaw(code, name));
}

async function joinOnlineTournamentRaw(code: string, name: string): Promise<OnlineTournamentDoc> {
  const uid = await ensureSignedIn();
  const snap = await get(tRef(code));
  const doc = fromSnapshot(code, snap.val());
  if (!doc) throw new Error(`Torneio ${code} não encontrado.`);
  // Depois que começou, quem não está inscrito entra só para acompanhar
  if (!doc.players[uid] && doc.status === 'lobby') {
    await set(tRef(code, `players/${uid}`), { id: uid, name: name || 'Jogador', kind: 'human', uid, joinedAt: serverNow() });
  }
  return doc;
}

export function subscribeTournament(code: string, onChange: (doc: OnlineTournamentDoc | null) => void) {
  return onValue(tRef(code), (snap) => onChange(fromSnapshot(code, snap.val())));
}

export async function addBotPlayer(code: string, name: string, rating: number) {
  const id = `bot_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  await set(tRef(code, `players/${id}`), { id, name, kind: 'bot', rating, joinedAt: serverNow() });
}

export const removePlayer = (code: string, id: string) => remove(tRef(code, `players/${id}`));

export const leaveLobby = async (code: string) => {
  const uid = await ensureSignedIn();
  await remove(tRef(code, `players/${uid}`));
};

/** Só o anfitrião: grava o estado do torneio. */
export async function writeState(code: string, state: Tournament) {
  await update(tRef(code), {
    state: JSON.stringify(state),
    status: state.finished ? 'finished' : 'running',
  });
}

export async function reportResult(code: string, key: string, result: GameResult, extra?: { reason?: string; pgn?: string }) {
  const uid = await ensureSignedIn();
  await runTransaction(tRef(code, `results/${key}`), (current) => {
    if (current) return; // o primeiro resultado vale
    return { result, reason: extra?.reason ?? null, pgn: extra?.pgn ?? null, by: uid };
  });
}

export async function deleteTournament(code: string) {
  await remove(tRef(code));
}

export function participantsOf(doc: OnlineTournamentDoc): Participant[] {
  return Object.values(doc.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({ id: p.id, name: p.name, kind: p.kind, rating: p.rating, uid: p.uid }));
}

/**
 * Abre (ou cria) a mesa online de um jogo pessoa x pessoa do torneio. Quem chegar primeiro
 * cria a sala com a sua cor; o outro entra nela.
 */
export async function openTournamentTable(
  doc: OnlineTournamentDoc,
  key: string,
  myColor: 'w' | 'b',
  name: string,
  opponentName?: string
): Promise<string> {
  const existing = doc.links[key];
  if (existing) {
    await joinGame(existing, name);
    return existing;
  }
  const tc: TimeControl | null = doc.settings.tc ? { label: '', ...doc.settings.tc } : null;
  const mine = await createGame(name, myColor, tc, {
    tournament: { code: doc.code, key, ...(opponentName ? { vs: opponentName } : {}) },
  });
  const res = await runTransaction(tRef(doc.code, `links/${key}`), (current) => current ?? mine);
  const winner = res.snapshot.val() as string;
  if (winner !== mine) {
    await cancelWaitingGame(mine).catch(() => {});
    await joinGame(winner, name);
    return winner;
  }
  return mine;
}
