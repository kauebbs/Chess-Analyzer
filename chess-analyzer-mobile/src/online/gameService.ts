import { Chess } from 'chess.js';
import { get, onDisconnect, onValue, ref, remove, runTransaction, set, update } from 'firebase/database';
import { database, ensureSignedIn, serverNow } from './firebase';
import { WEB_URL } from '../config/firebase';

export type Color = 'w' | 'b';
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type EndReason =
  | 'checkmate'
  | 'resign'
  | 'timeout'
  | 'agreement'
  | 'stalemate'
  | 'repetition'
  | 'insufficient'
  | 'fifty-moves';

export interface Seat {
  uid: string;
  name: string;
}

export interface OnlineGame {
  code: string;
  createdAt: number;
  status: GameStatus;
  white: Seat | null;
  black: Seat | null;
  moves: string; // lances em UCI separados por espaço
  clock: { initial: number; increment: number } | null;
  times: { w: number; b: number } | null; // tempo restante no momento do último lance (ms)
  lastMoveAt: number | null;
  result: '1-0' | '0-1' | '1/2-1/2' | null;
  reason: EndReason | null;
  drawOffer: Color | null;
  rematch: string | null; // código da revanche, quando alguém pede
  /** Série melhor de 3/5 contra um amigo: placar ANTES deste jogo, por uid. */
  series: OnlineSeries | null;
  /** Jogo de torneio online (o resultado volta para o torneio). */
  tournament: { code: string; key: string } | null;
  /** Bate-papo da sala (mais antigas primeiro). */
  chat: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  at: number;
}

export interface OnlineSeries {
  bestOf: 3 | 5;
  game: number;
  score: Record<string, number>;
}

export interface TimeControl {
  label: string;
  minutes: number;
  increment: number; // segundos
}

export const TIME_CONTROLS: (TimeControl | null)[] = [
  null,
  { label: '3+2', minutes: 3, increment: 2 },
  { label: '5+0', minutes: 5, increment: 0 },
  { label: '10+0', minutes: 10, increment: 0 },
  { label: '15+10', minutes: 15, increment: 10 },
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

export function inviteLink(code: string): string {
  return WEB_URL ? `${WEB_URL.replace(/\/$/, '')}/?jogo=${code}` : `chessanalyzer://jogo/${code}`;
}

/** Extrai o código da sala de um link (chessanalyzer://jogo/ABC123 ou https://...?jogo=ABC123). */
export function codeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const query = url.match(/[?&]jogo=([A-Za-z0-9]{4,10})/);
  if (query) return normalizeCode(query[1]);
  const path = url.match(/jogo\/([A-Za-z0-9]{4,10})/);
  return path ? normalizeCode(path[1]) : null;
}

const gameRef = (code: string) => ref(database(), `games/${code}`);

function fromSnapshot(code: string, v: any): OnlineGame | null {
  if (!v) return null;
  return {
    code,
    createdAt: v.createdAt ?? 0,
    status: v.status ?? 'waiting',
    white: v.white ?? null,
    black: v.black ?? null,
    moves: v.moves ?? '',
    clock: v.clock ?? null,
    times: v.times ?? null,
    lastMoveAt: v.lastMoveAt ?? null,
    result: v.result ?? null,
    reason: v.reason ?? null,
    drawOffer: v.drawOffer ?? null,
    rematch: v.rematch ?? null,
    series: v.series ? { bestOf: v.series.bestOf, game: v.series.game ?? 1, score: v.series.score ?? {} } : null,
    tournament: v.tournament ?? null,
    chat: Object.entries(v.chat ?? {})
      .map(([id, m]: [string, any]) => ({ id, uid: m.uid, name: m.name ?? '', text: String(m.text ?? ''), at: m.at ?? 0 }))
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
      .slice(-100),
  };
}

export const CHAT_MAX = 200;

/** Envia uma mensagem no bate-papo da sala (só quem está jogando pode escrever). */
export async function sendChat(code: string, name: string, text: string) {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!clean) return;
  const uid = await ensureSignedIn();
  const at = serverNow();
  const id = `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await set(ref(database(), `games/${code}/chat/${id}`), { uid, name: name || 'Jogador', text: clean, at });
}

/** Placar da série contando o jogo atual (se já terminou) e se ela já foi decidida. */
export function seriesAfter(game: OnlineGame) {
  if (!game.series) return null;
  const score: Record<string, number> = { ...game.series.score };
  const w = game.white?.uid;
  const b = game.black?.uid;
  if (w && !(w in score)) score[w] = 0;
  if (b && !(b in score)) score[b] = 0;
  if (game.status === 'finished' && game.result && w && b) {
    if (game.result === '1-0') score[w] += 1;
    else if (game.result === '0-1') score[b] += 1;
    else {
      score[w] += 0.5;
      score[b] += 0.5;
    }
  }
  const half = game.series.bestOf / 2;
  const played = game.series.game - (game.status === 'finished' ? 0 : 1);
  const leader = Object.entries(score).sort((x, y) => y[1] - x[1])[0];
  const decided = (leader && leader[1] > half) || played >= game.series.bestOf;
  const tied = w && b ? score[w] === score[b] : false;
  return {
    score,
    decided,
    winnerUid: decided ? (tied ? 'draw' : leader?.[0] ?? null) : null,
    played,
  };
}

/** Reconstrói a partida com chess.js a partir da lista de lances. */
export function replay(moves: string): Chess {
  const chess = new Chess();
  for (const uci of moves.split(' ').filter(Boolean)) {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return chess;
}

export function myColor(game: OnlineGame, uid: string): Color | null {
  if (game.white?.uid === uid) return 'w';
  if (game.black?.uid === uid) return 'b';
  return null;
}

/** Tempo restante de cada lado agora (o relógio só corre depois do 1º lance de cada um). */
export function remainingTimes(game: OnlineGame, now = serverNow()): { w: number; b: number } | null {
  if (!game.clock || !game.times) return null;
  const plies = game.moves.split(' ').filter(Boolean).length;
  // O relógio das brancas começa a correr assim que a partida começa (quando o segundo jogador entra)
  const ticking = game.status === 'playing' && game.lastMoveAt !== null;
  const turn: Color = plies % 2 === 0 ? 'w' : 'b';
  const elapsed = ticking ? Math.max(0, now - (game.lastMoveAt ?? now)) : 0;
  return {
    w: Math.max(0, game.times.w - (turn === 'w' ? elapsed : 0)),
    b: Math.max(0, game.times.b - (turn === 'b' ? elapsed : 0)),
  };
}

export async function createGame(
  name: string,
  color: Color | 'random',
  timeControl: TimeControl | null,
  extra?: { series?: OnlineSeries; tournament?: { code: string; key: string } }
): Promise<string> {
  const uid = await ensureSignedIn();
  const seat: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
  const me: Seat = { uid, name: name || 'Jogador' };
  const clock = timeControl ? { initial: timeControl.minutes * 60000, increment: timeControl.increment * 1000 } : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const result = await runTransaction(gameRef(code), (current) => {
      if (current) return; // código já usado: aborta e tenta outro
      return {
        createdAt: serverNow(),
        createdBy: uid,
        status: 'waiting',
        white: seat === 'w' ? me : null,
        black: seat === 'b' ? me : null,
        moves: '',
        clock,
        times: clock ? { w: clock.initial, b: clock.initial } : null,
        lastMoveAt: null,
        result: null,
        reason: null,
        drawOffer: null,
        rematch: null,
        ...(extra?.series ? { series: extra.series } : {}),
        ...(extra?.tournament ? { tournament: extra.tournament } : {}),
      };
    });
    if (result.committed) return code;
  }
  throw new Error('Não foi possível criar a sala. Tente de novo.');
}

/** Entra numa sala: ocupa a cadeira livre, ou volta para a sua se já estiver nela. */
export async function joinGame(code: string, name: string): Promise<Color> {
  const uid = await ensureSignedIn();
  const snap = await get(gameRef(code));
  const game = fromSnapshot(code, snap.val());
  if (!game) throw new Error(`Sala ${code} não encontrada.`);

  const mine = myColor(game, uid);
  if (mine) return mine;
  if (game.status !== 'waiting') throw new Error('Essa partida já começou com outros jogadores.');

  const seat: Color = game.white ? 'b' : 'w';
  const key = seat === 'w' ? 'white' : 'black';
  // No Realtime Database a 1ª chamada pode vir com o cache vazio (null): devolver null faz o
  // servidor responder com o valor real e a transação rodar de novo.
  const result = await runTransaction(gameRef(code), (current) => {
    if (current === null) return null;
    if (current.status !== 'waiting' || current[key]) return;
    return { ...current, [key]: { uid, name: name || 'Jogador' }, status: 'playing', lastMoveAt: serverNow() };
  });
  if (!result.committed || result.snapshot.val()?.[key]?.uid !== uid) {
    throw new Error('Alguém entrou na sala antes de você.');
  }
  return seat;
}

export function subscribeGame(code: string, onChange: (game: OnlineGame | null) => void): () => void {
  return onValue(gameRef(code), (snap) => onChange(fromSnapshot(code, snap.val())));
}

/** Marca o jogador como conectado (some sozinho quando o app fecha ou perde a conexão). */
export async function trackPresence(code: string): Promise<() => void> {
  const uid = await ensureSignedIn();
  const presence = ref(database(), `presence/${code}/${uid}`);
  await onDisconnect(presence).remove();
  await set(presence, true);
  return () => {
    remove(presence).catch(() => {});
  };
}

export function subscribePresence(code: string, onChange: (online: Record<string, boolean>) => void) {
  return onValue(ref(database(), `presence/${code}`), (snap) => onChange(snap.val() ?? {}));
}

function finishFields(chess: Chess): Partial<OnlineGame> | null {
  if (chess.isCheckmate()) return { status: 'finished', result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
  if (chess.isStalemate()) return { status: 'finished', result: '1/2-1/2', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { status: 'finished', result: '1/2-1/2', reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { status: 'finished', result: '1/2-1/2', reason: 'repetition' };
  if (chess.isDraw()) return { status: 'finished', result: '1/2-1/2', reason: 'fifty-moves' };
  return null;
}

/** Joga um lance (validado de novo dentro da transação, com o relógio atualizado). */
export async function playMove(code: string, uci: string): Promise<void> {
  const uid = await ensureSignedIn();
  await runTransaction(gameRef(code), (current) => {
    if (current === null) return null; // cache vazio: o servidor manda o valor real e repete
    const game = fromSnapshot(code, current);
    if (!game || game.status !== 'playing') return;
    const color = myColor(game, uid);
    const chess = replay(game.moves);
    if (!color || chess.turn() !== color) return;
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      return; // lance ilegal
    }

    const now = serverNow();
    const next: any = { ...current, moves: game.moves ? `${game.moves} ${uci}` : uci, lastMoveAt: now };
    if (game.drawOffer && game.drawOffer !== color) next.drawOffer = null; // jogar recusa o empate

    if (game.clock && game.times) {
      const times = remainingTimes(game, now)!;
      if (times[color] <= 0) {
        return { ...current, status: 'finished', result: color === 'w' ? '0-1' : '1-0', reason: 'timeout', times };
      }
      times[color] += game.clock.increment;
      next.times = times;
    }

    const end = finishFields(chess);
    return end ? { ...next, ...end } : next;
  });
}

async function endGame(code: string, build: (game: OnlineGame, color: Color) => Partial<OnlineGame> | null) {
  const uid = await ensureSignedIn();
  await runTransaction(gameRef(code), (current) => {
    if (current === null) return null; // cache vazio: o servidor manda o valor real e repete
    const game = fromSnapshot(code, current);
    if (!game || game.status === 'finished') return;
    const color = myColor(game, uid);
    if (!color) return;
    const patch = build(game, color);
    return patch ? { ...current, ...patch } : undefined;
  });
}

export const resign = (code: string) =>
  endGame(code, (game, color) =>
    game.status === 'waiting'
      ? null
      : { status: 'finished', result: color === 'w' ? '0-1' : '1-0', reason: 'resign', times: remainingTimes(game) }
  );

export const offerDraw = (code: string) =>
  endGame(code, (game, color) => (game.status === 'playing' ? { drawOffer: color } : null));

export const answerDraw = (code: string, accept: boolean) =>
  endGame(code, (game, color) => {
    if (!game.drawOffer || game.drawOffer === color) return null;
    return accept
      ? { status: 'finished', result: '1/2-1/2', reason: 'agreement', drawOffer: null, times: remainingTimes(game) }
      : { drawOffer: null };
  });

/** Qualquer um dos dois pode encerrar quando o relógio de quem joga zera. */
export const claimTimeout = (code: string) =>
  endGame(code, (game) => {
    const times = remainingTimes(game);
    if (!times || game.status !== 'playing') return null;
    const turn: Color = game.moves.split(' ').filter(Boolean).length % 2 === 0 ? 'w' : 'b';
    if (times[turn] > 0) return null;
    return { status: 'finished', result: turn === 'w' ? '0-1' : '1-0', reason: 'timeout', times };
  });

/** Cancela uma sala que ainda está esperando adversário. */
export async function cancelWaitingGame(code: string) {
  const snap = await get(gameRef(code));
  if (snap.val()?.status === 'waiting') await remove(gameRef(code));
}

/** Pede revanche: cria uma sala nova com as cores invertidas e avisa na sala antiga. */
export async function requestRematch(game: OnlineGame, uid: string, name: string): Promise<string> {
  if (game.rematch) {
    await joinGame(game.rematch, name);
    return game.rematch;
  }
  const color = myColor(game, uid);
  const tc = game.clock
    ? { label: '', minutes: game.clock.initial / 60000, increment: game.clock.increment / 1000 }
    : null;
  // Série: o próximo jogo leva o placar (ou começa uma série nova se esta acabou)
  const after = seriesAfter(game);
  const series: OnlineSeries | undefined =
    game.series && after
      ? after.decided
        ? { bestOf: game.series.bestOf, game: 1, score: {} }
        : { bestOf: game.series.bestOf, game: game.series.game + 1, score: after.score }
      : undefined;
  const code = await createGame(name, color === 'w' ? 'b' : 'w', tc, series ? { series } : undefined);
  await update(gameRef(game.code), { rematch: code });
  return code;
}

/** PGN da partida online (para abrir na análise). */
export function onlinePgn(game: OnlineGame): string {
  const chess = replay(game.moves);
  const d = new Date(game.createdAt || Date.now());
  chess.setHeader('Event', 'Partida online');
  chess.setHeader('Site', 'Chess Analyzer');
  chess.setHeader('Date', `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
  chess.setHeader('White', game.white?.name ?? 'Brancas');
  chess.setHeader('Black', game.black?.name ?? 'Pretas');
  chess.setHeader('Result', game.result ?? '*');
  if (game.reason) {
    const names: Record<EndReason, string> = {
      checkmate: 'checkmate',
      resign: 'resignation',
      timeout: 'time forfeit',
      agreement: 'draw by agreement',
      stalemate: 'stalemate',
      repetition: 'threefold repetition',
      insufficient: 'insufficient material',
      'fifty-moves': '50-move rule',
    };
    chess.setHeader('Termination', names[game.reason]);
  }
  return chess.pgn();
}
