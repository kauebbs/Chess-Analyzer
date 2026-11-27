import { generate } from './index';
import { personalityFor, pick } from './personalities';
import { botReply } from '../bots/botChat';
import type { ChatMsg } from './types';

/** O que aconteceu na partida para o bot comentar. */
export type BotEvent =
  | { type: 'greet' }
  | { type: 'reply'; message: string }
  | { type: 'theyBlundered'; san: string }
  | { type: 'theyPlayedWell'; san: string }
  | { type: 'mating' }
  | { type: 'end'; outcome: 'win' | 'loss' | 'draw'; reason: string };

export interface BotVoiceContext {
  opponent: string;
  /** Últimas mensagens do chat (mais antigas primeiro). */
  recent: { mine: boolean; text: string }[];
  plies: number;
  /** Como o bot está na partida, do ponto de vista dele. */
  standing?: 'ganhando' | 'perdendo' | 'equilibrado';
}

function levelText(rating: number) {
  if (rating < 900) return 'iniciante, que ainda está aprendendo';
  if (rating < 1500) return 'jogador casual';
  if (rating < 2100) return 'jogador forte de clube';
  return 'mestre muito forte';
}

function situation(ev: BotEvent, raw: BotVoiceContext) {
  // O jogador aparece como "Você" no app: para a IA, isso confundiria quem é quem
  const ctx = { ...raw, opponent: /^voc[eê]$/i.test(raw.opponent.trim()) ? 'seu adversário' : raw.opponent };
  const st = ctx.standing ? ` Agora você está ${ctx.standing}.` : '';
  switch (ev.type) {
    case 'greet':
      return `A partida contra ${ctx.opponent} vai começar. Cumprimente.`;
    case 'reply':
      return `${ctx.opponent} escreveu no chat: "${ev.message.slice(0, 200)}". Responda.${st}`;
    case 'theyBlundered':
      return `${ctx.opponent} acabou de jogar ${ev.san}, um erro grave que te deixou em vantagem. Reaja.`;
    case 'theyPlayedWell':
      return `${ctx.opponent} acabou de jogar ${ev.san}, um lance muito forte que te complicou. Reaja.`;
    case 'mating':
      return 'Você encontrou um xeque-mate forçado. Reaja sem dizer os lances.';
    case 'end': {
      const r = ev.outcome === 'win' ? 'Você venceu' : ev.outcome === 'loss' ? 'Você perdeu' : 'Deu empate';
      return `${r} a partida contra ${ctx.opponent} (${ev.reason}). Diga algo no fim do jogo.`;
    }
  }
}

/** Frase pronta da personalidade (sem IA). */
export function botLineOffline(name: string, rating: number, ev: BotEvent) {
  const p = personalityFor(name).lines;
  switch (ev.type) {
    case 'greet':
      return pick(p.greet);
    case 'reply':
      // Respostas por palavra-chave (boa sorte, gg, revanche…) continuam valendo; o resto ganha o jeito do bot
      return Math.random() < 0.5 ? botReply(ev.message, rating) : pick(p.reply);
    case 'theyBlundered':
      return pick(p.theyBlundered);
    case 'theyPlayedWell':
      return pick(p.theyPlayedWell);
    case 'mating':
      return pick(p.mating);
    case 'end':
      return pick(ev.outcome === 'win' ? p.win : ev.outcome === 'loss' ? p.loss : p.draw);
  }
}

/** Deixa a resposta com cara de mensagem de chat: uma linha, curta, sem aspas nem "Nome:". */
export function tidyLine(text: string, name: string) {
  let t = text.split('\n').map((s) => s.trim()).filter(Boolean)[0] ?? '';
  t = t.replace(new RegExp(`^\\**${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\**\\s*:\\s*`, 'i'), '');
  t = t.replace(/^["“'«]+|["”'»]+$/g, '').trim();
  t = t.replace(/^(bot|assistente|resposta)\s*:\s*/i, '');
  // Outro nome no começo ("Gambito Gil: ...") — até 3 palavras com maiúscula antes de dois-pontos
  t = t.replace(/^\**[A-ZÀ-Ý][\wÀ-ÿ]*(?: [A-ZÀ-Ý][\wÀ-ÿ]*){0,2}\**\s*:\s+/, '');
  t = t.replace(/^["“'«]+|["”'»]+$/g, '').trim();
  if (t.length > 160) {
    const cut = t.slice(0, 160);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = end > 40 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return t;
}

/**
 * Fala do bot para um evento. Usa a IA local se houver (com tempo curto, para não atrasar o jogo)
 * e cai na frase pronta da personalidade se não houver.
 */
export async function botLine(bot: { name: string; rating: number }, ev: BotEvent, ctx: BotVoiceContext): Promise<string> {
  const persona = personalityFor(bot.name);
  const system =
    `Você é "${bot.name}", um bot de xadrez (${levelText(bot.rating)}) no app Noxari Chess, conversando no chat da partida. ` +
    `Personalidade: ${persona.style} ` +
    'Responda SEMPRE em português do Brasil, com UMA frase curta (até 20 palavras), em tom de chat. Pode usar no máximo 1 emoji. ' +
    'Nunca invente lances, não dê dicas de qual lance jogar, não diga que é uma IA e não use palavrão.';
  const messages: ChatMsg[] = [{ role: 'system', content: system }];
  ctx.recent.slice(-6).forEach((l) => messages.push({ role: l.mine ? 'user' : 'assistant', content: l.text }));
  messages.push({ role: 'user', content: `[Situação] ${situation(ev, ctx)}` });

  const res = await generate(messages, {
    maxTokens: 60,
    temperature: 0.9,
    timeoutMs: ev.type === 'reply' ? 12000 : 8000,
  });
  const line = res ? tidyLine(res.text, bot.name) : '';
  return line.length >= 2 ? line : botLineOffline(bot.name, bot.rating, ev);
}
