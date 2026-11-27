import { Chess, Square } from 'chess.js';
import type { EvalData, MoveKind } from './moveClassifier';

/**
 * Explica POR QUE um lance foi bom ou ruim, em português, a partir do que o Stockfish já calculou
 * (a linha do melhor lance antes e a melhor resposta do adversário depois).
 *
 * Tudo aqui é determinístico: os motivos (peça solta, garfo, cravada, espeto, ataque descoberto,
 * mate, material) saem do tabuleiro, não de uma IA. A IA local, se houver, só reescreve o texto.
 * O mesmo arquivo é usado pelas skills (scripts) para as explicações baterem com o app.
 */

type Color = 'w' | 'b';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<PieceType, string> = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' };
const ART: Record<PieceType, string> = { p: 'o', n: 'o', b: 'o', r: 'a', q: 'a', k: 'o' };

const the = (t: PieceType) => `${ART[t]} ${NAME[t]}`;
const theAt = (t: PieceType, sq: string) => `${the(t)} de ${sq}`;
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export type Motif =
  | 'mate'
  | 'allows-mate'
  | 'missed-mate'
  | 'hanging'
  | 'bad-trade'
  | 'removed-defender'
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'discovered'
  | 'wins-material'
  | 'loses-material'
  | 'castle'
  | 'king-walk'
  | 'development'
  | 'threat'
  | 'check'
  | 'sacrifice'
  | 'only-move'
  | 'positional';

export interface MoveExplanation {
  /** "7. d3 é uma imprecisão" */
  headline: string;
  /** Frases curtas do porquê (1 a 3). */
  reasons: string[];
  /** Melhor lance (SAN) quando o jogado não foi ele. */
  bestSan: string | null;
  /** Melhor linha (UCI) a partir da posição antes do lance. */
  bestLine: string[];
  /** Melhor resposta do adversário depois do lance jogado (UCI). */
  reply: string[];
  motifs: Motif[];
}

export interface ExplainInput {
  fenBefore: string;
  /** Lance jogado (UCI). */
  played: string;
  kind: MoveKind;
  /** Avaliação da posição antes do lance (com `pvs[0].line`). */
  before: EvalData | null;
  /** Avaliação da posição depois do lance (com a melhor resposta do adversário). */
  after: EvalData | null;
  /** Segunda melhor opção (para lances únicos). */
  secondSan?: string | null;
}

// ---------------------------------------------------------------- utilidades de tabuleiro

function play(fen: string, uci: string): Chess | null {
  try {
    const c = new Chess(fen);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as any) ?? 'q' });
    return c;
  } catch {
    return null;
  }
}

export function sanOf(fen: string, uci: string) {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as any) ?? 'q' })?.san ?? uci;
  } catch {
    return uci;
  }
}

/** "8. dxe5 Qxd1+ 9. Kxd1" — linha em SAN com numeração. */
export function lineSan(fen: string, ucis: string[], max = 6) {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of ucis.slice(0, max)) {
    const n = c.moveNumber();
    const turn = c.turn();
    let san: string;
    try {
      san = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] as any) ?? 'q' }).san;
    } catch {
      break;
    }
    if (turn === 'w') out.push(`${n}. ${san}`);
    else out.push(out.length === 0 ? `${n}... ${san}` : san);
  }
  return out.join(' ');
}

function material(c: Chess, color: Color) {
  let sum = 0;
  for (const row of c.board()) for (const p of row) if (p && p.color === color && p.type !== 'k') sum += VALUE[p.type as PieceType];
  return sum;
}
const balance = (c: Chess, color: Color) => material(c, color) - material(c, other(color));

/** Variação de material (do ponto de vista de `color`) ao jogar a linha. */
function materialSwing(fen: string, line: string[], color: Color, maxPlies = 8) {
  const c = new Chess(fen);
  const start = balance(c, color);
  let played = 0;
  for (let i = 0; i < line.length; i++) {
    const u = line[i];
    // Passou do limite: só continua enquanto o próximo lance for captura (não corta a troca no meio)
    if (i >= maxPlies && !c.get(u.slice(2, 4) as Square)) break;
    try {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] as any) ?? 'q' });
      played++;
    } catch {
      break;
    }
  }
  return { delta: balance(c, color) - start, plies: played };
}

function amountText(points: number) {
  const p = Math.round(Math.abs(points));
  if (p <= 0) return 'material';
  if (p === 1) return 'um peão';
  if (p === 2) return 'dois peões (ou a qualidade)';
  if (p === 3) return 'uma peça';
  if (p === 4) return 'uma peça e um peão';
  if (p === 5) return 'uma torre';
  if (p >= 8) return 'a dama (ou material equivalente)';
  return `${p} pontos de material`;
}

/** Peças de `color` que atacam `sq` (independente de quem está lá). */
const attackers = (c: Chess, sq: Square, color: Color) => c.attackers(sq, color) as Square[];

function pieceSquares(c: Chess, color: Color) {
  const out: { sq: Square; type: PieceType }[] = [];
  for (const row of c.board()) for (const p of row) if (p && p.color === color) out.push({ sq: p.square as Square, type: p.type as PieceType });
  return out;
}

/** Alvos valiosos atacados pela peça em `sq` (rei, peças mais valiosas que ela, ou peças sem defesa). */
function targetsOf(c: Chess, sq: Square) {
  const me = c.get(sq);
  if (!me) return [];
  const enemy = other(me.color as Color);
  return pieceSquares(c, enemy).filter(({ sq: t, type }) => {
    if (type === 'p') return false;
    if (!attackers(c, t, me.color as Color).includes(sq)) return false;
    return type === 'k' || VALUE[type] > VALUE[me.type as PieceType] || attackers(c, t, enemy).length === 0;
  });
}

const DIRS: Record<string, [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};
const FILES = 'abcdefgh';

/** Cravada ou espeto criados pela peça de longo alcance em `sq`. */
function lineMotif(c: Chess, sq: Square): { kind: 'pin' | 'skewer'; front: { sq: string; type: PieceType }; back: { sq: string; type: PieceType } } | null {
  const me = c.get(sq);
  if (!me || !DIRS[me.type]) return null;
  const f0 = FILES.indexOf(sq[0]);
  const r0 = Number(sq[1]);
  for (const [df, dr] of DIRS[me.type]) {
    const found: { sq: string; type: PieceType; color: Color }[] = [];
    for (let k = 1; k < 8 && found.length < 2; k++) {
      const f = f0 + df * k;
      const r = r0 + dr * k;
      if (f < 0 || f > 7 || r < 1 || r > 8) break;
      const s = `${FILES[f]}${r}` as Square;
      const p = c.get(s);
      if (p) found.push({ sq: s, type: p.type as PieceType, color: p.color as Color });
    }
    if (found.length < 2 || found[0].color === me.color || found[1].color === me.color) continue;
    const [front, back] = found;
    if (front.type === 'p') continue; // cravar peão quase nunca é o ponto
    if (back.type === 'k' || (VALUE[back.type] > VALUE[front.type] && VALUE[back.type] > VALUE[me.type as PieceType])) {
      return { kind: 'pin', front, back };
    }
    if ((front.type === 'k' || VALUE[front.type] > VALUE[back.type]) && back.type !== 'p') return { kind: 'skewer', front, back };
  }
  return null;
}

/** Peças valiosas que passaram a ser atacadas por OUTRA peça (o lance abriu a linha). */
function discovered(before: Chess, after: Chess, moverTo: Square, color: Color) {
  const enemy = other(color);
  return pieceSquares(after, enemy)
    .filter(({ type }) => type !== 'p')
    .filter(({ sq, type }) => {
      const now = attackers(after, sq, color).filter((a) => a !== moverTo);
      if (now.length === 0) return false;
      const was = before.get(sq) ? attackers(before, sq, color) : [];
      const isNew = now.some((a) => !was.includes(a));
      return isNew && (type === 'k' || attackers(after, sq, enemy).length === 0 || now.some((a) => VALUE[(after.get(a)?.type ?? 'q') as PieceType] < VALUE[type]));
    });
}

/** O que um lance (bom) faz, como verbo: "desenvolve o cavalo". Vira "Nf3 desenvolve…" ou "Melhor era Nf3, que desenvolve…". */
function whatItDoes(fen: string, uci: string, line: string[], ev: EvalData | null, color: Color): { text: string; motif: Motif } | null {
  const before = new Chess(fen);
  const c = play(fen, uci);
  if (!c) return null;
  const san = sanOf(fen, uci);
  const to = uci.slice(2, 4) as Square;
  const moved = c.get(to);
  const captured = before.get(to);

  if (c.isCheckmate()) return { text: 'dá xeque-mate', motif: 'mate' };
  const sign = color === 'w' ? 1 : -1;
  if (ev?.mate && ev.mate * sign > 0) return { text: `força mate em ${Math.abs(ev.mate)} (${lineSan(fen, line, 7)})`, motif: 'mate' };

  const tg = targetsOf(c, to);
  if (tg.length >= 2) {
    const names = tg.slice(0, 2).map((t) => theAt(t.type, t.sq));
    return { text: `faz um garfo: ataca ${names.join(' e ')} ao mesmo tempo`, motif: 'fork' };
  }
  const lm = lineMotif(c, to);
  if (lm?.kind === 'pin')
    return { text: `crava ${theAt(lm.front.type, lm.front.sq)}${lm.back.type === 'k' ? ' no rei' : ` contra ${the(lm.back.type)}`}`, motif: 'pin' };
  if (lm?.kind === 'skewer')
    return { text: `faz um espeto: ${theAt(lm.front.type, lm.front.sq)} precisa sair e ${theAt(lm.back.type, lm.back.sq)} fica exposto`, motif: 'skewer' };
  const disc = discovered(before, c, to, color);
  if (disc.length) return { text: `abre um ataque descoberto contra ${theAt(disc[0].type, disc[0].sq)}`, motif: 'discovered' };

  const swing = materialSwing(fen, line.length && line[0] === uci ? line : [uci, ...line], color);
  if (captured && captured.color !== color) {
    const free = attackers(before, to, other(color)).length === 0;
    if (free || VALUE[captured.type as PieceType] > VALUE[(moved?.type ?? 'p') as PieceType])
      return { text: `ganha ${theAt(captured.type as PieceType, to)}${free ? ', que estava sem defesa' : ''}`, motif: 'wins-material' };
  }
  if (swing.delta >= 1) return { text: `ganha ${amountText(swing.delta)} (${lineSan(fen, line.length ? line : [uci], 6)})`, motif: 'wins-material' };
  if (/^O-O/.test(san)) return { text: 'roca e tira o rei do centro', motif: 'castle' };
  if (c.inCheck()) return { text: 'dá xeque e ganha tempo', motif: 'check' };
  if (moved && ['n', 'b'].includes(moved.type) && (uci[1] === '1' || uci[1] === '8') && before.moveNumber() <= 12)
    return { text: `desenvolve ${the(moved.type as PieceType)}`, motif: 'development' };
  if (tg.length === 1) return { text: `ameaça ${theAt(tg[0].type, tg[0].sq)}`, motif: 'threat' };
  return null;
}

// ---------------------------------------------------------------- texto

const HEADLINE: Record<MoveKind, string> = {
  brilliant: 'é um lance brilhante!!',
  great: 'é um ótimo lance!',
  best: 'é o melhor lance',
  excellent: 'é excelente',
  good: 'é bom',
  book: 'é teoria de abertura',
  inaccuracy: 'é uma imprecisão',
  mistake: 'é um erro',
  miss: 'é uma chance perdida',
  blunder: 'é uma capivarada',
};

function pawns(ev: EvalData | null, color: Color) {
  if (!ev) return null;
  const s = color === 'w' ? 1 : -1;
  if (ev.mate !== null && ev.mate !== undefined) return ev.mate * s > 0 ? `mate em ${Math.abs(ev.mate)}` : `mate em ${Math.abs(ev.mate)} contra`;
  const v = (ev.cp * s) / 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}`;
}

export function moveLabel(fen: string, uci: string) {
  const n = fen.split(' ')[5] ?? '1';
  const side = fen.split(' ')[1];
  return `${n}${side === 'w' ? '.' : '...'} ${sanOf(fen, uci)}`;
}

const BAD: MoveKind[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];

/** A explicação de um lance. */
export function explainMove(input: ExplainInput): MoveExplanation {
  const { fenBefore, played, kind, before, after } = input;
  const color = fenBefore.split(' ')[1] as Color;
  const enemy = other(color);
  const sign = color === 'w' ? 1 : -1;
  const label = moveLabel(fenBefore, played);
  const bestLine = before?.pvs?.[0]?.line ?? (before?.bestMove ? [before.bestMove] : []);
  const bestUci = bestLine[0] ?? before?.bestMove ?? null;
  const fenAfter = play(fenBefore, played)?.fen() ?? fenBefore;
  const reply = after?.pvs?.[0]?.line ?? (after?.bestMove ? [after.bestMove] : []);
  const isBest = !!bestUci && bestUci === played;
  const bestSan = bestUci && !isBest && kind !== 'book' ? sanOf(fenBefore, bestUci) : null;
  const reasons: string[] = [];
  const motifs: Motif[] = [];
  const add = (m: Motif, text: string) => {
    if (!motifs.includes(m)) motifs.push(m);
    // Maiúscula no começo, exceto quando a frase começa com um lance de peão ("bxc6")
    const t = /^[a-h](x|[1-8])/.test(text) ? text : text.charAt(0).toUpperCase() + text.slice(1);
    reasons.push(t.endsWith('.') || t.endsWith('!') ? t : `${t}.`);
  };

  const cAfter = new Chess(fenAfter);
  const san = sanOf(fenBefore, played);

  // ------------------------------------------------ lances bons
  if (!BAD.includes(kind)) {
    if (cAfter.isCheckmate()) add('mate', 'Xeque-mate! Fim de jogo');
    else if (kind === 'book') add('positional', 'Lance conhecido da teoria: segue os princípios da abertura');
    else {
      const does = whatItDoes(fenBefore, played, isBest ? bestLine : [played, ...reply], after, color);
      if (does) add(does.motif, `${san} ${does.text}`);
      const swing = materialSwing(fenBefore, isBest ? bestLine : [played, ...reply], color, 4);
      if (kind === 'brilliant' || (swing.delta <= -2 && ['great', 'best'].includes(kind))) {
        add('sacrifice', `Entrega material de propósito, mas a posição compensa (${pawns(after, color)})`);
      }
      if (kind === 'great' || kind === 'brilliant') {
        add('only-move', input.secondSan ? `Era o único lance forte: a segunda opção (${input.secondSan}) era bem pior` : 'Era o único lance que mantinha a vantagem');
      }
      if (!does && reasons.length === 0) {
        add('positional', isBest ? 'É o lance que o motor escolhe: melhora a posição sem dar contrajogo' : `Mantém a avaliação (${pawns(after, color)})`);
      }
    }
    return { headline: `${label} ${HEADLINE[kind]}`, reasons: reasons.slice(0, 3), bestSan, bestLine, reply, motifs };
  }

  // ------------------------------------------------ lances ruins: o que o adversário faz agora
  const replyMove = reply[0];
  const evB = pawns(before, color);
  const evA = pawns(after, color);

  if (after?.mate !== null && after?.mate !== undefined && after.mate * sign < 0) {
    add('allows-mate', `Permite mate em ${Math.abs(after.mate)}: ${lineSan(fenAfter, reply, Math.abs(after.mate) * 2)}`);
  } else if (before?.mate && before.mate * sign > 0 && !(after?.mate && after.mate * sign > 0)) {
    add('missed-mate', `Havia mate em ${Math.abs(before.mate)}${bestSan ? ` começando com ${bestSan}` : ''}`);
  } else if (replyMove) {
    const cR = play(fenAfter, replyMove);
    const rTo = replyMove.slice(2, 4) as Square;
    const victim = cAfter.get(rTo);
    const rSan = sanOf(fenAfter, replyMove);
    // Material do lance jogado + resposta (assim uma troca justa não conta como perda)
    const swing = materialSwing(fenBefore, [played, ...reply], color);
    const playedTo = played.slice(2, 4);

    if (cR) {
      const tg = targetsOf(cR, rTo);
      const lm = lineMotif(cR, rTo);
      const disc = discovered(cAfter, cR, rTo, enemy);
      if (victim && victim.color === color) {
        const defended = attackers(cAfter, rTo, color).length > 0;
        const attackerType = (cAfter.get(replyMove.slice(0, 2) as Square)?.type ?? 'p') as PieceType;
        if (rTo === playedTo && !defended && swing.delta <= -1) add('hanging', `${the(victim.type as PieceType)} foi para ${rTo}, uma casa atacada e sem defesa: ${rSan} ganha ${victim.type === 'p' ? 'o peão' : 'a peça'}`);
        else if (!defended && rTo !== playedTo && swing.delta <= -1) {
          // O lance tirou a defesa?
          const wasDefended = attackers(new Chess(fenBefore), rTo, color).includes(played.slice(0, 2) as Square);
          if (wasDefended) add('removed-defender', `A peça que saiu de ${played.slice(0, 2)} defendia ${theAt(victim.type as PieceType, rTo)}: agora ${rSan} ganha material`);
          else add('hanging', `Deixa ${theAt(victim.type as PieceType, rTo)} sem defesa: ${rSan}`);
        } else if (VALUE[attackerType] < VALUE[victim.type as PieceType] && swing.delta <= -1) {
          add('bad-trade', `${rSan}: ${the(attackerType)} captura ${theAt(victim.type as PieceType, rTo)}, que vale mais`);
        }
      }
      if (reasons.length === 0 && tg.length >= 2)
        add('fork', `Permite um garfo: ${rSan} ataca ${tg.slice(0, 2).map((t) => theAt(t.type, t.sq)).join(' e ')}`);
      if (reasons.length === 0 && lm?.kind === 'pin')
        add('pin', `Permite uma cravada: ${rSan} crava ${theAt(lm.front.type, lm.front.sq)}${lm.back.type === 'k' ? ' no rei' : ` contra ${the(lm.back.type)}`}`);
      if (reasons.length === 0 && lm?.kind === 'skewer')
        add('skewer', `Permite um espeto: ${rSan} ataca ${theAt(lm.front.type, lm.front.sq)} e, quando ela sair, ${theAt(lm.back.type, lm.back.sq)} cai`);
      if (reasons.length === 0 && disc.length)
        add('discovered', `Permite um ataque descoberto: depois de ${rSan}, ${theAt(disc[0].type, disc[0].sq)} fica ${ART[disc[0].type] === 'a' ? 'atacada' : 'atacado'}`);
    }
    if (swing.delta <= -1) {
      const seq = lineSan(fenAfter, reply, Math.min(8, Math.max(1, swing.plies - 1)));
      if (reasons.length === 0) add('loses-material', `Perde ${amountText(swing.delta)}: ${seq}`);
      else reasons.push(`Sequência: ${seq} (perde ${amountText(swing.delta)}).`), motifs.push('loses-material');
    }
    // Troca que não ajuda
    const capturedByPlayed = new Chess(fenBefore).get(playedTo as Square);
    if (reasons.length === 0 && capturedByPlayed && swing.delta > -1)
      add('positional', `Capturar com ${san} não compensa: depois de ${rSan}, a avaliação cai de ${evB} para ${evA}`);
    // Rei andou e perdeu o roque
    const moverPiece = new Chess(fenBefore).get(played.slice(0, 2) as Square);
    if (reasons.length === 0 && moverPiece?.type === 'k' && !/^O-O/.test(san) && /[KQkq]/.test(fenBefore.split(' ')[2] ?? '-'))
      add('king-walk', 'O rei se mexeu e perdeu o direito de roque; ele fica mais exposto no centro');
    if (reasons.length === 0) {
      const threat = cR ? targetsOf(cR, rTo) : [];
      if (threat.length === 1) add('threat', `O adversário responde ${rSan} e ameaça ${theAt(threat[0].type, threat[0].sq)}`);
      else if (cR?.inCheck()) add('check', `O adversário responde com o xeque ${rSan} e toma a iniciativa`);
      else add('positional', `A avaliação cai de ${evB} para ${evA}: o adversário responde ${rSan} e fica com o jogo mais fácil`);
    }
  }

  // ------------------------------------------------ o que o melhor lance fazia
  if (bestUci && !isBest) {
    const does = whatItDoes(fenBefore, bestUci, bestLine, before, color);
    const opening = new Chess(fenBefore).moveNumber() <= 10;
    if (does) reasons.push(`Melhor era ${bestSan}, que ${does.text}.`);
    else reasons.push(`Melhor era ${bestSan}, que mantinha ${evB}${opening ? ' sem atrasar o desenvolvimento' : ''}.`);
  }

  return { headline: `${label} ${HEADLINE[kind]}`, reasons: reasons.slice(0, 3), bestSan, bestLine, reply, motifs };
}
