import { generate } from './index';
import type { AiSource, ChatMsg } from './types';
import { MOVE_KINDS, MoveKind } from '../utils/moveClassifier';

/**
 * Professores da análise. O Stockfish e o classificador do app já decidiram tudo (precisão,
 * categoria de cada lance, melhor lance). O professor só EXPLICA esses fatos em português.
 * A IA nunca avalia posição sozinha: modelo pequeno inventa lance.
 */

type Side = 'w' | 'b';

export interface KeyMoment {
  /** "7. d3" ou "7... Cg4" */
  label: string;
  side: Side;
  kind: MoveKind;
  /** Melhor lance segundo o motor (SAN), quando o jogado não foi o melhor. */
  best: string | null;
  /** Avaliação antes e depois, do ponto de vista de quem jogou ("+1,4", "-0,2", "mate em 2"). */
  before: string;
  after: string;
}

export interface CoachInput {
  players: Record<Side, string>;
  result?: string;
  opening: string | null;
  accuracy: Record<Side, number | null>;
  rating: Record<Side, number | null>;
  moments: KeyMoment[];
  /** Ponto de vista: o professor fala com quem? (null = com os dois) */
  student: Side | null;
}

export interface Coach {
  id: string;
  name: string;
  /** Como se apresenta: "professora de xadrez", "treinador de xadrez"… */
  role: string;
  tagline: string;
  style: string;
}

export const COACHES: Coach[] = [
  {
    id: 'didatico',
    name: 'Profa. Lia',
    role: 'professora de xadrez',
    tagline: 'Didática, explica o porquê',
    style: 'Você é uma professora paciente e didática. Explica a ideia por trás de cada erro em linguagem simples.',
  },
  {
    id: 'direto',
    name: 'Mestre Otto',
    role: 'treinador de xadrez',
    tagline: 'Direto e técnico',
    style: 'Você é um treinador direto e técnico. Frases curtas, sem rodeios, foca no que importa.',
  },
  {
    id: 'motivador',
    name: 'Prof. Davi',
    role: 'treinador de xadrez',
    tagline: 'Motivador, valoriza o que deu certo',
    style: 'Você é um treinador animado e motivador. Começa pelo que deu certo e transforma os erros em metas.',
  },
];

/** Avaliação do ponto de vista de quem joga, em texto (cp sempre na perspectiva das Brancas). */
export function evalText(cp: number, mate: number | null, side: Side) {
  const s = side === 'w' ? 1 : -1;
  if (mate !== null) {
    const m = mate * s;
    return m > 0 ? `mate em ${m} a favor` : `mate em ${-m} contra`;
  }
  const v = (cp * s) / 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}`;
}

const sideName = (input: CoachInput, side: Side) =>
  `${input.players[side]} (${side === 'w' ? 'Brancas' : 'Pretas'})`;

/** Os fatos da partida em texto: vai para a IA e também serve de base para a explicação automática. */
export function factsText(input: CoachInput) {
  const acc = (s: Side) => (input.accuracy[s] !== null ? input.accuracy[s]!.toFixed(1).replace('.', ',') : '?');
  const lines = [
    `Partida: ${sideName(input, 'w')} x ${sideName(input, 'b')}${input.result ? `, resultado ${input.result}` : ''}.`,
    input.opening ? `Abertura: ${input.opening}.` : '',
    `Precisão: Brancas ${acc('w')}, Pretas ${acc('b')}.`,
    input.rating.w && input.rating.b ? `Nível estimado nesta partida: Brancas ~${input.rating.w}, Pretas ~${input.rating.b}.` : '',
    'Momentos-chave (avaliação do ponto de vista de quem jogou, antes → depois):',
    ...input.moments.map(
      (m) =>
        `- ${m.label} (${m.side === 'w' ? 'Brancas' : 'Pretas'}): ${MOVE_KINDS[m.kind].label}, ${m.before} → ${m.after}` +
        (m.best ? `; o melhor era ${m.best}` : '')
    ),
  ];
  return lines.filter(Boolean).join('\n');
}

const BAD: MoveKind[] = ['blunder', 'miss', 'mistake', 'inaccuracy'];
const GOOD: MoveKind[] = ['brilliant', 'great'];

/** Explicação sem IA, montada só com os fatos (sempre disponível). */
export function automaticExplanation(input: CoachInput, coach: Coach) {
  const sides: Side[] = input.student ? [input.student] : ['w', 'b'];
  const out: string[] = [];
  const w = input.accuracy.w ?? 0;
  const b = input.accuracy.b ?? 0;
  if (input.accuracy.w !== null && input.accuracy.b !== null) {
    const better = w >= b ? 'w' : 'b';
    const who = input.student ? (better === input.student ? 'Você' : 'Seu adversário') : sideName(input, better);
    out.push(
      Math.abs(w - b) < 4
        ? 'Partida equilibrada em qualidade: os dois jogaram num nível parecido.'
        : `${who} jogou melhor, com ${Math.max(w, b).toFixed(1).replace('.', ',')} de precisão contra ${Math.min(w, b).toFixed(1).replace('.', ',')}.`
    );
  }
  for (const s of sides) {
    const mine = input.moments.filter((m) => m.side === s);
    const bad = mine.filter((m) => BAD.includes(m.kind)).sort((x, y) => BAD.indexOf(x.kind) - BAD.indexOf(y.kind));
    const good = mine.filter((m) => GOOD.includes(m.kind));
    const who = input.student ? 'Você' : sideName(input, s);
    if (good.length) out.push(`${who} acertou ${good.map((m) => m.label).join(', ')}: ${good.length > 1 ? 'lances muito fortes' : 'um lance muito forte'}.`);
    const worst = bad[0];
    if (worst) {
      out.push(
        `${input.student ? 'Seu momento mais caro' : `O momento mais caro de ${who}`} foi ${worst.label} (${MOVE_KINDS[worst.kind].label.toLowerCase()}): a avaliação foi de ${worst.before} para ${worst.after}.` +
          (worst.best ? ` O motor preferia ${worst.best}.` : '')
      );
      if (bad.length > 1) out.push(`Outros lances para rever: ${bad.slice(1).map((m) => m.label).join(', ')}.`);
    } else if (!good.length) {
      out.push(`${who} não teve erros graves nesta partida.`);
    }
  }
  const tip =
    coach.id === 'motivador'
      ? 'Meta para a próxima: antes de cada lance, olhe xeques, capturas e ameaças do adversário. Você está no caminho!'
      : coach.id === 'direto'
        ? 'Treino: refaça os lances marcados no tabuleiro e encontre o melhor antes de olhar a resposta.'
        : 'Dica: volte nos lances marcados, tente achar o melhor lance sozinho e só depois veja a sugestão do motor.';
  out.push(tip);
  return out.join('\n\n');
}

export interface CoachResult {
  text: string;
  source: AiSource;
}

/** Explicação do professor: IA local se houver, senão a automática. */
export async function explainGame(input: CoachInput, coach: Coach): Promise<CoachResult> {
  const audience = input.student
    ? `Fale diretamente com ${sideName(input, input.student)}, usando "você".`
    : 'Fale com os dois jogadores.';
  const system =
    `Você é ${coach.name}, ${coach.role} no app Noxari Chess. ${coach.style} ` +
    'Escreva em português do Brasil. Use SOMENTE os fatos fornecidos: não invente lances, variantes, avaliações nem nomes de abertura. ' +
    'Cite os lances exatamente como aparecem nos fatos. Sem títulos e sem listas longas.';
  const user =
    `${factsText(input)}\n\n${audience} ` +
    'Escreva: 1) um parágrafo curto resumindo a partida; 2) um parágrafo sobre os 2 ou 3 momentos mais importantes, dizendo o que o motor preferia; ' +
    '3) uma última linha começando com "Para a próxima:" com uma dica prática. Máximo de 140 palavras.';
  const messages: ChatMsg[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const res = await generate(messages, { maxTokens: 320, temperature: 0.5, timeoutMs: 60000 });
  if (res && res.text.length > 60) return { text: res.text, source: res.source };
  return { text: automaticExplanation(input, coach), source: 'fallback' };
}

/**
 * Reescreve a explicação de UM lance no estilo do professor, com a IA local (se houver).
 * Recebe só fatos já calculados (título + motivos do explicador); devolve null sem IA.
 */
export async function coachMoveText(headline: string, reasons: string[], coach: Coach): Promise<string | null> {
  const system =
    `Você é ${coach.name}, ${coach.role} no app Noxari Chess, comentando um lance durante a revisão da partida. ${coach.style} ` +
    'Escreva em português do Brasil, em no máximo 2 frases curtas, falando com o jogador ("você"). ' +
    'Use SOMENTE os fatos dados; cite os lances exatamente como aparecem; não invente lances nem avaliações.';
  const user = `Lance: ${headline}\nFatos:\n${reasons.map((r) => `- ${r}`).join('\n')}`;
  const res = await generate(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 90, temperature: 0.5, timeoutMs: 15000 }
  );
  return res && res.text.length > 20 ? res.text.replace(/\s+/g, ' ').trim() : null;
}
