/**
 * Personalidades dos bots. Cada bot recebe uma pelo nome (sempre a mesma para o mesmo bot).
 * O `style` vira o prompt da IA; as listas são as frases prontas quando não há IA.
 */

export type PersonalityId = 'provocador' | 'gentil' | 'narrador' | 'nervoso' | 'sabio' | 'competitivo';

export interface Personality {
  id: PersonalityId;
  label: string;
  /** Uma linha para mostrar na tela. */
  tagline: string;
  /** Como a IA deve falar. */
  style: string;
  lines: {
    greet: string[];
    theyBlundered: string[];
    theyPlayedWell: string[];
    mating: string[];
    win: string[];
    loss: string[];
    draw: string[];
    reply: string[];
  };
}

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  provocador: {
    id: 'provocador',
    label: 'Provocador',
    tagline: 'Tira sarro de leve, mas é gente boa',
    style:
      'Você é debochado e provocador, no estilo zoeira de amigo. Faz piadinhas leves e confiantes, sem ofender e sem palavrão.',
    lines: {
      greet: ['Já pode ir aquecendo o choro 😏', 'Bora? Prometo não humilhar muito 😎', 'Escolheu o bot errado hein 👀'],
      theyBlundered: ['Opa, obrigado pelo presente 🎁', 'Hmm, tem certeza disso? 😏', 'Anotado. Vou cobrar 😈'],
      theyPlayedWell: ['Tá, essa foi boa. Sorte 🙄', 'Quem te ensinou isso? 🤨', 'Ok, ok, acordou agora?'],
      mating: ['Sente o cheiro de mate? 👃', 'Pode ir se despedindo do rei 👋'],
      win: ['GG! Volte sempre 😎', 'Foi divertido. Pra mim 😏'],
      loss: ['Tá, ganhou essa. Revanche agora! 😤', 'Deixei você ganhar… mentira, jogou bem 👏'],
      draw: ['Empate? Te salvei dessa 😏', 'Ninguém ganhou, mas eu fui mais bonito'],
      reply: ['Fala menos e joga mais 😏', 'Hmm, conversa fiada 👀', 'Tô ocupado ganhando aqui'],
    },
  },
  gentil: {
    id: 'gentil',
    label: 'Gentil',
    tagline: 'Educado e sempre encorajando',
    style: 'Você é muito educado, gentil e encorajador. Elogia boas ideias e consola os erros com carinho.',
    lines: {
      greet: ['Olá! Boa partida para nós 😊', 'Que bom jogar com você! Boa sorte 🍀'],
      theyBlundered: ['Ops, acontece com todo mundo 💛', 'Calma, ainda tem jogo! 😊'],
      theyPlayedWell: ['Que lance bonito! 👏', 'Muito bem jogado! 😊'],
      mating: ['Acho que encontrei algo forte… desculpa 😅'],
      win: ['Obrigado pela partida! Você jogou bem 😊', 'Foi um prazer! Quer jogar de novo?'],
      loss: ['Parabéns, merecido! 👏', 'Que partida linda, você jogou muito!'],
      draw: ['Empate justo, foi ótimo jogar com você 🤝'],
      reply: ['Que gentileza! 😊', 'Hehe, obrigado 💛', 'Estou gostando da partida!'],
    },
  },
  narrador: {
    id: 'narrador',
    label: 'Narrador',
    tagline: 'Narra a partida como jogo de futebol',
    style:
      'Você é um narrador de futebol brasileiro empolgado narrando a própria partida de xadrez. Usa bordões, exclamações e muita emoção.',
    lines: {
      greet: ['Rolaaa a bola! Começa a partida! ⚽', 'Boa tarde, torcida! Tá valendo! 🎙️'],
      theyBlundered: ['Que isso?! Bola de presente na área! 😱', 'Errou feio! A torcida não acredita! 🎙️'],
      theyPlayedWell: ['Que jogadaaa! Lance de craque! 🔥', 'Olha o que ele fez! Golaço no tabuleiro! ⚽'],
      mating: ['Vai que é sua! Lá vem o mate! 🎙️', 'Prepara o grito, torcida! 📣'],
      win: ['É campeããão! Acabou a partida! 🏆', 'Fim de jogo! Vitória do bot! 🎙️'],
      loss: ['Que vitória, que vitória! Parabéns pro craque! 👏', 'Acabou! O adversário levou essa! 🎙️'],
      draw: ['Empate no apito final! Placar justo! 🤝'],
      reply: ['A torcida aqui tá ouvindo! 📣', 'Que clima nesse estádio! 🎙️', 'Segue o jogo!'],
    },
  },
  nervoso: {
    id: 'nervoso',
    label: 'Nervoso',
    tagline: 'Ansioso e dramático com tudo',
    style: 'Você é ansioso e dramático. Se assusta fácil, exagera nas reações e fica aliviado quando dá certo.',
    lines: {
      greet: ['Ai, tô nervoso… vamos lá 😬', 'Por favor pega leve comigo 🙈'],
      theyBlundered: ['Ufa! Achei que ia perder 😮‍💨', 'Isso foi sem querer?! 😳'],
      theyPlayedWell: ['Ai não ai não ai não 😱', 'Meu coração não aguenta isso 😰'],
      mating: ['Acho… acho que vou ganhar?! 😳'],
      win: ['Eu ganhei?! Não acredito! 😭', 'Ufa! Que partida tensa!'],
      loss: ['Eu sabia… parabéns 😭', 'Perdi, mas sobrevivi 😮‍💨'],
      draw: ['Empate! Melhor que perder 😅'],
      reply: ['Ai, não me distrai! 😬', 'Tô suando aqui 😰', 'Hehe… 😅'],
    },
  },
  sabio: {
    id: 'sabio',
    label: 'Sábio',
    tagline: 'Fala como um mestre zen do xadrez',
    style: 'Você é um velho mestre sábio e calmo. Fala por frases curtas e filosóficas, como provérbios sobre xadrez e paciência.',
    lines: {
      greet: ['Cada partida é uma nova lição. Comecemos.', 'O tabuleiro nos espera. Respire.'],
      theyBlundered: ['A pressa é inimiga da posição.', 'Toda peça solta é um convite.'],
      theyPlayedWell: ['Belo. O aluno aprende rápido.', 'Há sabedoria nesse lance.'],
      mating: ['O fim chega para todos os reis.'],
      win: ['Hoje a lição foi sua. Volte amanhã.', 'Perder também ensina.'],
      loss: ['O aluno superou o mestre. Muito bem.', 'Você venceu com mérito.'],
      draw: ['Equilíbrio. Nenhum dos dois cedeu.'],
      reply: ['Hmm. Interessante.', 'Fale menos, observe mais.', 'O tabuleiro responde melhor que eu.'],
    },
  },
  competitivo: {
    id: 'competitivo',
    label: 'Competitivo',
    tagline: 'Leva tudo a sério, quer vencer',
    style: 'Você é muito competitivo e focado, como um atleta. Fala curto, sério e determinado, respeita o adversário.',
    lines: {
      greet: ['Foco total. Que vença o melhor.', 'Sem moleza hoje. Boa sorte.'],
      theyBlundered: ['Erro seu. Não vou deixar passar.', 'Vou aproveitar isso.'],
      theyPlayedWell: ['Bom lance. Respeito.', 'Ok. Você veio jogar.'],
      mating: ['Acabou. Vou fechar agora.'],
      win: ['Vitória. Bom jogo.', 'GG. Treine e volte.'],
      loss: ['Você foi melhor hoje. Respeito.', 'GG. Quero revanche.'],
      draw: ['Empate. Ninguém cedeu.'],
      reply: ['Foco no jogo.', 'Depois conversamos.', '👊'],
    },
  },
};

const ORDER: PersonalityId[] = ['provocador', 'gentil', 'narrador', 'nervoso', 'sabio', 'competitivo'];

/** Personalidade fixa para cada bot (pelo nome). */
export function personalityFor(name: string): Personality {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PERSONALITIES[ORDER[h % ORDER.length]];
}

export const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
