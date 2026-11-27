// openingData tem ~280 KB: só é carregado na primeira consulta (não na abertura do app)
type OpeningData = typeof import('./openingData');

let bookSet: Set<string> | null = null;
let namedMap: Map<string, string> | null = null;

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Posição sem os contadores de lance (o que importa para teoria). */
const epdKey = (fen: string) => fnv(fen.split(' ').slice(0, 4).join(' '));

function init() {
  if (bookSet && namedMap) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BOOK_POSITIONS, NAMED_POSITIONS, OPENING_NAMES }: OpeningData = require('./openingData');
  bookSet = new Set(BOOK_POSITIONS.split(','));
  namedMap = new Map(
    NAMED_POSITIONS.split(',').map((entry) => {
      const [k, idx] = entry.split(':');
      return [k, OPENING_NAMES[parseInt(idx, 36)]] as [string, string];
    })
  );
}

/** A posição faz parte da teoria de aberturas (base lichess-org/chess-openings, CC0). */
export function isBookPosition(fen: string): boolean {
  init();
  return bookSet!.has(epdKey(fen));
}

/** Nome da abertura (com código ECO) se a posição tiver um nome conhecido. */
export function openingNameAt(fen: string): string | null {
  init();
  return namedMap!.get(epdKey(fen)) ?? null;
}
