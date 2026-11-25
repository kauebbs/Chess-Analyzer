// Mesma lógica do Lichess (ui/lib/src/ceval/winningChances.ts, lichess-org/lila, AGPL).
export interface Score {
  cp: number; // perspectiva das Brancas
  mate: number | null;
}

const rawWinningChances = (cp: number) => 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;

const cpWinningChances = (cp: number) => rawWinningChances(Math.min(Math.max(-1000, cp), 1000));

const mateWinningChances = (mate: number) => {
  const cp = (21 - Math.min(10, Math.abs(mate))) * 100;
  return rawWinningChances(cp * (mate > 0 ? 1 : -1));
};

/** Chances de vitória das Brancas entre -1 e 1. */
export const winningChances = (s: Score) =>
  s.mate !== null && s.mate !== undefined ? mateWinningChances(s.mate) : cpWinningChances(s.cp);

/** Diferença (de -1 a 1) entre duas avaliações, do ponto de vista de `color`. */
export const povDiff = (color: 'w' | 'b', e1: Score, e2: Score) => {
  const pov = (s: Score) => (color === 'w' ? winningChances(s) : -winningChances(s));
  return (pov(e1) - pov(e2)) / 2;
};
