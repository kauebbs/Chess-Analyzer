/** Falas prontas dos bots no bate-papo (sem internet, sem IA: só um pouco de personalidade). */

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function botGreeting(rating: number) {
  if (rating < 1000) return pick(['Oiii! Vamos jogar? 😄', 'Boa sorte! Ainda estou aprendendo 🙈', 'Bora! ♟️']);
  if (rating < 2000) return pick(['Boa sorte! 🍀', 'Que vença o melhor 🤝', 'Bora jogar! ♟️']);
  return pick(['Boa sorte. Vou precisar dela menos que você 😏', 'Que vença o melhor. (Spoiler: eu) 🤖', 'Pronto quando você estiver.']);
}

export function botReply(text: string, rating: number) {
  const t = text.toLowerCase();
  if (/boa sorte|bs\b|gl\b/.test(t)) return pick(['Pra você também! 🍀', 'Valeu! Boa sorte!']);
  if (/bom jogo|gg|good game/.test(t)) return pick(['Bom jogo! 🤝', 'GG! 👏']);
  if (/boa jogada|nice|boa!/.test(t)) return pick(['Obrigado! 😄', 'Hehe, valeu!', 'Treinei muito essa 😎']);
  if (/obrigad|valeu/.test(t)) return pick(['De nada! 😊', 'Tamo junto!']);
  if (/revanche/.test(t)) return pick(['Claro! É só tocar em Revanche 😄', 'Bora! Mais uma!']);
  if (/ops|😅|droga|putz/.test(t)) return pick(['Acontece! 😅', 'Ih… vou aproveitar 👀']);
  if (/^(oi|olá|ola|eae|e aí|eai|salve)\b/.test(t)) return pick(['Oi! 👋', 'E aí! Pronto pra jogar?', 'Salve! ♟️']);
  if (/empate/.test(t)) return 'Se quiser empate, toque em Empate. Eu vejo se aceito 🤔';
  if (t.includes('?')) return pick(['Hmm, deixa eu pensar… 🤔', 'Boa pergunta!', 'Estou concentrado aqui 🤖']);
  if (rating >= 2000) return pick(['Interessante… 🤔', 'Hmm.', 'Vamos ver no tabuleiro 😏']);
  return pick(['👍', 'Haha 😄', 'Vamos ver…', 'Estou de olho no seu cavalo 👀', 'Partida boa essa!']);
}

export function botEndLine(outcome: 'win' | 'loss' | 'draw') {
  if (outcome === 'win') return pick(['GG! Foi uma boa partida 🤝', 'Bom jogo! Quer revanche? 😄', 'GG! Essa foi difícil.']);
  if (outcome === 'loss') return pick(['Parabéns, jogou muito bem! 👏', 'GG! Você mereceu.', 'Bom jogo! Me pegou dessa vez 😅']);
  return pick(['Empate justo. Bom jogo! 🤝', 'GG! Ninguém cedeu 😄']);
}

export function botDrawLine(kind: string | null) {
  return kind ? `Isso aqui é ${kind}… que tal um empate? 🤝` : 'Que tal um empate? 🤝';
}
