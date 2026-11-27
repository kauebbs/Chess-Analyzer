import { classifyGame, EvalData, MoveClassification, PlyInput } from './moveClassifier';
import { isBookPosition } from './openings';

/**
 * Classificação incremental da partida.
 *
 * `classifyGame` percorre a partida inteira (chess.js em cada lance para procurar sacrifícios):
 * numa partida de 80 lances isso leva ~60 ms no PC e bem mais no celular. Antes ela rodava de novo a
 * cada avaliação nova (cada posição da revisão, cada linha da análise ao vivo) — o motivo de a tela
 * travar ao passar os lances em partidas longas.
 *
 * Aqui só os lances afetados pela mudança são refeitos, com o mesmo `classifyGame` (o resultado é
 * idêntico ao de reclassificar tudo):
 * - o lance i depende das avaliações i e i+1, das posições i e i+1, do lance i-1 (recaptura) e da
 *   classificação do lance i-1 ("chance perdida" e "ótimo");
 * - por isso a janela recalculada começa alguns lances antes (contexto) e termina alguns depois; se o
 *   último lance da janela não mudou, o resto da partida continua igual.
 * - "Livro" só vale enquanto todos os lances anteriores são livro: se a janela começasse dentro da
 *   teoria fora de hora, reclassifica tudo (caso raro).
 */
const CONTEXT = 3; // lances antes da mudança usados só como contexto (o 1º da janela não tem "anterior")
const TAIL = 3; // lances depois da mudança conferidos antes de reaproveitar o resto

interface Snapshot {
  positions: string[];
  plies: PlyInput[];
  evals: (EvalData | null)[];
  out: (MoveClassification | null)[];
  minDepth: number;
}

export type GameClassifier = (
  positions: string[],
  plies: PlyInput[],
  evalAt: (i: number) => EvalData | null,
  minDepth: number
) => (MoveClassification | null)[];

export function createGameClassifier(): GameClassifier {
  let last: Snapshot | null = null;

  return (positions, plies, evalAt, minDepth) => {
    const n = plies.length;
    const evals: (EvalData | null)[] = [];
    for (let i = 0; i <= n; i++) evals.push(evalAt(i));
    const at = (i: number) => evals[i] ?? null;
    const full = () => classifyGame(positions, plies, at, minDepth);

    const prev = last;
    let out: (MoveClassification | null)[];

    if (!prev || prev.minDepth !== minDepth || n === 0) {
      out = full();
    } else {
      // Primeira e última posição/avaliação/lance que mudaram desde a última vez
      let first = -1;
      let lastChanged = -1;
      const m = Math.max(n + 1, prev.positions.length);
      for (let i = 0; i < m; i++) {
        const changed =
          positions[i] !== prev.positions[i] ||
          evals[i] !== prev.evals[i] ||
          plies[i]?.uci !== prev.plies[i]?.uci;
        if (changed) {
          if (first < 0) first = i;
          lastChanged = i;
        }
      }

      if (first < 0) {
        out = prev.out;
      } else {
        const f = Math.max(0, first - 1); // 1º lance afetado
        const l = Math.min(n - 1, lastChanged + 1); // último lance afetado diretamente
        const s = Math.max(0, f - CONTEXT);
        let e = Math.min(n, l + 1 + TAIL); // fim (exclusivo) da janela

        const stillBookAtS = prev.out.slice(0, s).every((c) => c?.kind === 'book');
        if (s > 0 && !stillBookAtS && isBookPosition(positions[s + 1])) {
          out = full();
        } else {
          const classifyWindow = (end: number) =>
            classifyGame(positions.slice(s, end + 1), plies.slice(s, end), (j) => at(s + j), minDepth);
          let win = classifyWindow(e);
          // O último lance da janela mudou? Então o efeito pode continuar: refaz até o fim
          if (e < n && (win[e - 1 - s]?.kind ?? null) !== (prev.out[e - 1]?.kind ?? null)) {
            e = n;
            win = classifyWindow(e);
          }
          out = [...prev.out.slice(0, f), ...win.slice(f - s, e - s), ...(e < n ? prev.out.slice(e, n) : [])];
        }
      }
    }

    last = { positions, plies, evals, out, minDepth };
    return out;
  };
}
