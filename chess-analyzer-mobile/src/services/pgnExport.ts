const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface SimplePly {
  san: string;
}

/**
 * Monta o PGN da partida. Se houver variante, ela entra como linha alternativa entre
 * parênteses no lance em que a partida foi desviada (formato padrão PGN, aceito por
 * Chess.com e Lichess).
 */
export function buildPgn(
  headers: Record<string, string> | null,
  startFen: string,
  mainline: SimplePly[],
  variation: { from: number; plies: SimplePly[] } | null
): string {
  const today = new Date();
  const date = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const tags: Record<string, string> = headers
    ? { ...headers }
    : { Event: 'Análise', Site: 'Noxari Chess', Date: date, White: 'Brancas', Black: 'Pretas', Result: '*' };
  if (startFen !== START_FEN) {
    tags.SetUp = '1';
    tags.FEN = startFen;
  }
  const result = tags.Result || '*';

  const [, turn, , , , fullmove] = startFen.split(' ');
  const blackStarts = turn === 'b';
  const firstNo = parseInt(fullmove || '1', 10) || 1;

  /** Texto de um lance pelo índice absoluto (0 = primeiro lance a partir da posição inicial). */
  const token = (ply: number, san: string, forceNumber: boolean) => {
    const abs = ply + (blackStarts ? 1 : 0);
    const no = firstNo + Math.floor(abs / 2);
    const white = abs % 2 === 0;
    if (white) return `${no}. ${san}`;
    return forceNumber ? `${no}... ${san}` : san;
  };

  const parts: string[] = [];
  let forceNext = true;
  mainline.forEach((p, i) => {
    parts.push(token(i, p.san, forceNext));
    forceNext = false;
    if (variation && variation.from === i && variation.plies.length > 0) {
      const alt = variation.plies.map((v, k) => token(i + k, v.san, k === 0)).join(' ');
      parts.push(`(${alt})`);
      forceNext = true; // depois da variante, o lance das pretas volta a ter número
    }
  });
  // Variante depois do fim da partida: vai como comentário
  if (variation && variation.from >= mainline.length && variation.plies.length > 0) {
    const alt = variation.plies.map((v, k) => token(variation.from + k, v.san, k === 0)).join(' ');
    parts.push(`{Variante: ${alt}}`);
  }
  parts.push(result);

  const header = Object.entries(tags)
    .map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`)
    .join('\n');

  // Quebra o texto dos lances em linhas de até ~80 caracteres
  const lines: string[] = [];
  let line = '';
  for (const t of parts.join(' ').split(' ')) {
    if ((line + ' ' + t).trim().length > 80) {
      lines.push(line.trim());
      line = t;
    } else line += ' ' + t;
  }
  if (line.trim()) lines.push(line.trim());

  return `${header}\n\n${lines.join('\n')}\n`;
}
