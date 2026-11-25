import { Chess } from 'chess.js';

export type GameSource = 'chesscom' | 'lichess';

export interface GameSummary {
  id: string;
  source: GameSource;
  pgn: string;
  white: string;
  black: string;
  whiteElo: string;
  blackElo: string;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  date: string; // dd/mm/aaaa
  speed: string; // bullet, blitz, rapid...
  timestamp: number;
}

export interface ParsedGame {
  startFen: string;
  moves: { san: string; from: string; to: string; uci: string; before: string; after: string }[];
  headers: Record<string, string>;
}

const MAX_GAMES = 30;

/** Lê o valor de uma tag do cabeçalho PGN, ex.: [White "Fulano"]. */
export function pgnTag(pgn: string, tag: string): string {
  const m = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`));
  return m ? m[1] : '';
}

/** Converte um PGN em posição inicial + lista de lances. Lança erro se o PGN for inválido. */
export function parsePgn(pgn: string): ParsedGame {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn.trim());
  } catch {
    throw new Error('PGN inválido. Confira se colou a partida inteira.');
  }
  const history = chess.history({ verbose: true });
  const startFen = history.length > 0 ? history[0].before : chess.fen();
  return {
    startFen,
    headers: chess.getHeaders(),
    moves: history.map((m) => ({
      san: m.san,
      from: m.from,
      to: m.to,
      uci: `${m.from}${m.to}${m.promotion ?? ''}`,
      before: m.before,
      after: m.after,
    })),
  };
}

function formatPgnDate(pgn: string, fallbackMs: number): string {
  const raw = pgnTag(pgn, 'UTCDate') || pgnTag(pgn, 'Date');
  const m = raw.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(fallbackMs);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function summaryFromPgn(
  source: GameSource,
  id: string,
  pgn: string,
  timestamp: number,
  speed: string
): GameSummary {
  return {
    id,
    source,
    pgn,
    white: pgnTag(pgn, 'White') || '?',
    black: pgnTag(pgn, 'Black') || '?',
    whiteElo: pgnTag(pgn, 'WhiteElo'),
    blackElo: pgnTag(pgn, 'BlackElo'),
    result: pgnTag(pgn, 'Result') || '*',
    date: formatPgnDate(pgn, timestamp),
    speed,
    timestamp,
  };
}

/**
 * Chess.com — API pública (https://www.chess.com/news/view/published-data-api).
 * Busca a lista de arquivos mensais e lê do mais recente para trás.
 */
export async function fetchChessComGames(username: string): Promise<GameSummary[]> {
  const user = username.trim().toLowerCase();
  if (!user) return [];

  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
  if (res.status === 404) throw new Error(`Usuário "${username}" não encontrado no Chess.com.`);
  if (!res.ok) throw new Error(`Chess.com respondeu ${res.status}. Tente de novo em instantes.`);

  const { archives = [] } = (await res.json()) as { archives?: string[] };
  const games: GameSummary[] = [];

  // Pedidos em série (a API limita requisições paralelas)
  for (const url of [...archives].reverse().slice(0, 4)) {
    const r = await fetch(url);
    if (!r.ok) continue;
    const data = (await r.json()) as { games?: any[] };
    const monthGames = (data.games ?? [])
      .filter((g) => g.pgn && (g.rules ?? 'chess') === 'chess')
      .sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0));

    for (const g of monthGames) {
      games.push(
        summaryFromPgn('chesscom', g.url ?? g.uuid ?? String(g.end_time), g.pgn, (g.end_time ?? 0) * 1000, g.time_class ?? '')
      );
      if (games.length >= MAX_GAMES) return games;
    }
  }
  return games;
}

/**
 * Lichess — exportação de partidas do usuário em NDJSON
 * (https://lichess.org/api#tag/Games/operation/apiGamesUser).
 */
export async function fetchLichessGames(username: string): Promise<GameSummary[]> {
  const user = username.trim();
  if (!user) return [];

  const params = [
    `max=${MAX_GAMES}`,
    'pgnInJson=true',
    'opening=true',
    'clocks=false',
    'evals=false',
    'perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence',
  ].join('&');

  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?${params}`, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (res.status === 404) throw new Error(`Usuário "${username}" não encontrado no Lichess.`);
  if (res.status === 429) throw new Error('Lichess pediu para esperar um minuto antes de buscar de novo.');
  if (!res.ok) throw new Error(`Lichess respondeu ${res.status}. Tente de novo em instantes.`);

  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return [];

  // NDJSON (esperado) — uma partida por linha
  if (trimmed.startsWith('{')) {
    return trimmed
      .split('\n')
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((g) => g && g.pgn)
      .map((g) => summaryFromPgn('lichess', g.id ?? String(g.createdAt), g.pgn, g.createdAt ?? 0, g.speed ?? ''));
  }

  // Se a API devolver PGN puro, separa as partidas pelo cabeçalho [Event
  return trimmed
    .split(/\n\s*\n(?=\[Event )/)
    .map((pgn, i) => summaryFromPgn('lichess', pgnTag(pgn, 'Site') || String(i), pgn, 0, ''));
}

export function fetchGames(source: GameSource, username: string) {
  return source === 'chesscom' ? fetchChessComGames(username) : fetchLichessGames(username);
}
