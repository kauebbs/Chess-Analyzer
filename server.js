const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const { Chess } = require('chess.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ENGINE_PATH = path.join(
  __dirname,
  'engine',
  process.platform === 'win32' ? 'stockfish.exe' : 'stockfish'
);

// Catálogo massivo de aberturas
const OPENINGS = [
  // ECO A (Flancos)
  { moves: 'c4', eco: 'A10', name: 'Abertura Inglesa' },
  { moves: 'c4 e5', eco: 'A20', name: 'Abertura Inglesa: Variante do Rei' },
  { moves: 'Nf3', eco: 'A04', name: 'Abertura Réti' },
  { moves: 'Nf3 d5 c4', eco: 'A09', name: 'Abertura Réti' },
  { moves: 'f4', eco: 'A02', name: 'Abertura Bird' },
  { moves: 'b3', eco: 'A01', name: 'Ataque Nimzo-Larsen' },
  { moves: 'd4 Nf6 c4', eco: 'A50', name: 'Defesa Índia' },
  { moves: 'd4 Nf6 c4 c5', eco: 'A56', name: 'Defesa Benoni' },
  { moves: 'd4 Nf6 c4 e5', eco: 'A51', name: 'Gambito de Budapeste' },
  // ECO B (Semi-Abertas)
  { moves: 'e4 c6', eco: 'B10', name: 'Defesa Caro-Kann' },
  { moves: 'e4 c6 d4 d5', eco: 'B12', name: 'Defesa Caro-Kann' },
  { moves: 'e4 c6 d4 d5 exd5', eco: 'B13', name: 'Caro-Kann: Variante das Trocas' },
  { moves: 'e4 c6 d4 d5 e5', eco: 'B12', name: 'Caro-Kann: Variante do Avanço' },
  { moves: 'e4 c5', eco: 'B20', name: 'Defesa Siciliana' },
  { moves: 'e4 c5 c3', eco: 'B22', name: 'Siciliana: Variante Alapin' },
  { moves: 'e4 c5 Nf3 d6', eco: 'B50', name: 'Defesa Siciliana' },
  { moves: 'e4 c5 Nf3 e6', eco: 'B40', name: 'Siciliana: Variante Francesa' },
  { moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', eco: 'B90', name: 'Siciliana: Variante Najdorf' },
  { moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', eco: 'B70', name: 'Siciliana: Variante do Dragão' },
  { moves: 'e4 d6', eco: 'B07', name: 'Defesa Pirc' },
  { moves: 'e4 g6', eco: 'B06', name: 'Defesa Moderna' },
  { moves: 'e4 d5', eco: 'B01', name: 'Defesa Escandinava' },
  { moves: 'e4 Nf6', eco: 'B02', name: 'Defesa Alekhine' },
  // ECO C (Abertas & Francesa)
  { moves: 'e4 e6', eco: 'C00', name: 'Defesa Francesa' },
  { moves: 'e4 e6 d4 d5', eco: 'C00', name: 'Defesa Francesa' },
  { moves: 'e4 e6 d4 d5 e5', eco: 'C02', name: 'Francesa: Variante do Avanço' },
  { moves: 'e4 e6 d4 d5 Nc3 Bb4', eco: 'C15', name: 'Francesa: Variante Winawer' },
  { moves: 'e4 e5', eco: 'C20', name: 'Abertura do Peão do Rei' },
  { moves: 'e4 e5 Nf3', eco: 'C40', name: 'Abertura do Cavalo do Rei' },
  { moves: 'e4 e5 f4', eco: 'C30', name: 'Gambito do Rei' },
  { moves: 'e4 e5 Nc3', eco: 'C25', name: 'Abertura Vienense' },
  { moves: 'e4 e5 Nf3 Nf6', eco: 'C42', name: 'Defesa Petrov' },
  { moves: 'e4 e5 Nf3 Nc6', eco: 'C44', name: 'Abertura do Cavalo do Rei' },
  { moves: 'e4 e5 Nf3 Nc6 d4', eco: 'C44', name: 'Abertura Escocesa' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4', eco: 'C50', name: 'Abertura Italiana' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5', eco: 'C50', name: 'Giuoco Piano' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6', eco: 'C55', name: 'Defesa dos Dois Cavalos' },
  { moves: 'e4 e5 Nf3 Nc6 Bb5', eco: 'C60', name: 'Ruy Lopez (Abertura Espanhola)' },
  { moves: 'e4 e5 Nf3 Nc6 Bb5 a6', eco: 'C68', name: 'Ruy Lopez: Variante das Trocas' },
  { moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7', eco: 'C90', name: 'Ruy Lopez: Fechada' },
  // ECO D (Fechadas & Semi-Fechadas)
  { moves: 'd4 d5', eco: 'D00', name: 'Abertura do Peão da Rainha' },
  { moves: 'd4 d5 Bf4', eco: 'D00', name: 'Sistema London' },
  { moves: 'd4 d5 c4', eco: 'D06', name: 'Gambito da Rainha' },
  { moves: 'd4 d5 c4 dxc4', eco: 'D20', name: 'Gambito da Rainha Aceito' },
  { moves: 'd4 d5 c4 e6', eco: 'D30', name: 'Gambito da Rainha Recusado' },
  { moves: 'd4 d5 c4 c6', eco: 'D10', name: 'Defesa Eslava' },
  { moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5', eco: 'D50', name: 'Gambito da Rainha Recusado: Moderna' },
  // ECO E (Índias)
  { moves: 'd4 Nf6', eco: 'A45', name: 'Defesa Índia' },
  { moves: 'd4 Nf6 c4 e6', eco: 'E00', name: 'Defesa Índia' },
  { moves: 'd4 Nf6 c4 e6 Nc3 Bb4', eco: 'E20', name: 'Defesa Nimzo-Índia' },
  { moves: 'd4 Nf6 c4 e6 Nf3 b6', eco: 'E12', name: 'Defesa Índia da Rainha' },
  { moves: 'd4 Nf6 c4 e6 Nf3 Bb4+', eco: 'E11', name: 'Defesa Bogo-Índia' },
  { moves: 'd4 Nf6 c4 g6', eco: 'E60', name: 'Defesa Índia do Rei' },
  { moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4', eco: 'E70', name: 'Defesa Índia do Rei' },
  { moves: 'd4 Nf6 c4 g6 Nc3 d5', eco: 'D70', name: 'Defesa Grünfeld' }
];

function detectOpening(sanHistory) {
  const joined = sanHistory.join(' ');
  let matched = { eco: 'A00', name: 'Abertura Irregular', matchedPlies: 0 };
  for (const op of OPENINGS) {
    if (joined.startsWith(op.moves)) {
      const plies = op.moves.split(' ').length;
      if (plies > matched.matchedPlies) {
        matched = { eco: op.eco, name: op.name, matchedPlies: plies };
      }
    }
  }
  return matched;
}

function cpToWinPercent(cp) {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

function calculateMoveAccuracy(winBefore, winAfter) {
  const winDiff = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * winDiff) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

function calculatePlayerGameAccuracy(moveEntries) {
  if (!moveEntries.length) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  let harmonicDenominator = 0;

  for (let i = 0; i < moveEntries.length; i++) {
    const m = moveEntries[i];
    const moveAcc = m.classification === 'book' ? 100 : m.accuracy;
    const tension = 1 - Math.abs(m.winBefore - 50) / 50; 
    const weight = 0.65 + 0.7 * tension;

    weightedSum += moveAcc * weight;
    totalWeight += weight;

    const dampedAcc = Math.max(12, moveAcc);
    harmonicDenominator += weight / dampedAcc;
  }

  const weightedArithmetic = weightedSum / totalWeight;
  const weightedHarmonic = totalWeight / harmonicDenominator;

  const combined = 0.55 * weightedArithmetic + 0.45 * weightedHarmonic;
  return Math.round(combined * 10) / 10;
}

function getMaterialCount(fen, color) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const boardPart = fen.split(' ')[0];
  let total = 0;
  for (const ch of boardPart) {
    const isWhite = ch === ch.toUpperCase();
    const piece = ch.toLowerCase();
    if (values[piece]) {
      if ((color === 'w' && isWhite) || (color === 'b' && !isWhite)) {
        total += values[piece];
      }
    }
  }
  return total;
}

class StockfishService {
  constructor(enginePath) {
    this.enginePath = enginePath;
    this.process = null;
    this.buffer = '';
    this.listeners = [];
    this.readyPromise = null;
    this.queue = Promise.resolve();
  }

  start() {
    if (this.process) return this.readyPromise;

    this.process = spawn(this.enginePath);
    this.process.stdout.on('data', (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.listeners.forEach((fn) => fn(trimmed));
      }
    });

    this.process.on('exit', () => {
      this.process = null;
      this.readyPromise = null;
    });

    this.readyPromise = (async () => {
      this.send('uci');
      await this.waitFor((line) => line === 'uciok');
      this.send('setoption name Threads value 2');
      this.send('setoption name Hash value 64');
      this.send('setoption name MultiPV value 2');
      this.send('isready');
      await this.waitFor((line) => line === 'readyok');
    })();

    return this.readyPromise;
  }

  send(cmd) {
    if (this.process && this.process.stdin.writable) {
      this.process.stdin.write(cmd + '\n');
    }
  }

  waitFor(predicate) {
    return new Promise((resolve) => {
      const handler = (line) => {
        if (predicate(line)) {
          this.listeners = this.listeners.filter((l) => l !== handler);
          resolve(line);
        }
      };
      this.listeners.push(handler);
    });
  }

  enqueue(taskFn) {
    const run = this.queue.then(async () => {
      await this.start();
      return taskFn();
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async evaluateFenInternal(fen, depth = 12) {
    const tempChess = new Chess(fen);
    const turn = tempChess.turn();

    if (tempChess.isCheckmate()) {
      return {
        cpWhite: turn === 'w' ? -10000 : 10000,
        mateWhite: turn === 'w' ? -0 : 0,
        bestMove: null,
        secondBestCpWhite: null,
        pv: []
      };
    }

    if (tempChess.isDraw()) {
      return { cpWhite: 0, mateWhite: null, bestMove: null, secondBestCpWhite: 0, pv: [] };
    }

    const pvData = { 1: { cpWhite: 0, mateWhite: null, move: null, pv: [] }, 2: null };

    const infoListener = (line) => {
      if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
        const pvMatch = line.match(/multipv (\d+)/);
        const pvIndex = pvMatch ? parseInt(pvMatch[1], 10) : 1;
        if (pvIndex > 2) return;

        const mateMatch = line.match(/score mate (-?\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const movesMatch = line.match(/ pv (.+)$/);
        const pvMoves = movesMatch ? movesMatch[1].trim().split(' ') : [];

        let cpWhite = 0;
        let mateWhite = null;

        if (mateMatch) {
          const mateVal = parseInt(mateMatch[1], 10);
          mateWhite = turn === 'w' ? mateVal : -mateVal;
          cpWhite = mateWhite > 0 ? 10000 - Math.abs(mateVal) * 10 : -10000 + Math.abs(mateVal) * 10;
        } else if (cpMatch) {
          const cpVal = parseInt(cpMatch[1], 10);
          cpWhite = turn === 'w' ? cpVal : -cpVal;
        }

        pvData[pvIndex] = { cpWhite, mateWhite, move: pvMoves[0] || null, pv: pvMoves.slice(0, 6) };
      }
    };

    this.listeners.push(infoListener);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);

    const bestMoveLine = await this.waitFor((line) => line.startsWith('bestmove'));
    this.listeners = this.listeners.filter((l) => l !== infoListener);

    const rawBest = bestMoveLine.split(' ')[1];
    const bestMove = rawBest === '(none)' ? null : rawBest;

    return {
      cpWhite: pvData[1].cpWhite,
      mateWhite: pvData[1].mateWhite,
      bestMove: bestMove || pvData[1].move,
      secondBestCpWhite: pvData[2] ? pvData[2].cpWhite : null,
      pv: pvData[1].pv
    };
  }

  evaluateSingle(fen, depth = 12) {
    return this.enqueue(() => this.evaluateFenInternal(fen, depth));
  }

  evaluateGame(positions, depth = 12) {
    return this.enqueue(async () => {
      this.send('ucinewgame');
      this.send('isready');
      await this.waitFor((line) => line === 'readyok');

      const results = [];
      for (const pos of positions) {
        const ev = await this.evaluateFenInternal(pos.fen, depth);
        results.push(ev);
      }
      return results;
    });
  }
}

const stockfish = new StockfishService(ENGINE_PATH);

app.post('/api/analyze', async (req, res) => {
  const { pgn, depth = 12 } = req.body;

  if (!pgn || !pgn.trim()) return res.status(400).json({ error: 'PGN vazio ou inválido.' });

  const parsedGame = new Chess();
  try {
    parsedGame.loadPgn(pgn);
  } catch (err) {
    return res.status(400).json({ error: 'Não foi possível ler o PGN. Verifique a formatação.' });
  }

  const headers = parsedGame.header();
  const verboseMoves = parsedGame.history({ verbose: true });

  if (verboseMoves.length === 0) return res.status(400).json({ error: 'Nenhum lance encontrado no PGN.' });

  try {
    const replay = new Chess();
    const positions = [{ fen: replay.fen(), move: null }];

    for (const m of verboseMoves) {
      replay.move(m);
      positions.push({ fen: replay.fen(), move: m });
    }

    const evaluations = await stockfish.evaluateGame(positions, depth);
    const opening = detectOpening(verboseMoves.map((m) => m.san));
    const analyzedMoves = [];

    const stats = {
      w: { entries: [], counts: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, missed: 0, mistake: 0, blunder: 0 } },
      b: { entries: [], counts: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, missed: 0, mistake: 0, blunder: 0 } }
    };

    for (let i = 0; i < verboseMoves.length; i++) {
      const move = verboseMoves[i];
      const color = move.color;
      const fenBefore = positions[i].fen;
      const fenAfter = positions[i + 1].fen;

      const evalBefore = evaluations[i];
      const evalAfter = evaluations[i + 1];

      const cpBeforePlayer = color === 'w' ? evalBefore.cpWhite : -evalBefore.cpWhite;
      const cpAfterPlayer = color === 'w' ? evalAfter.cpWhite : -evalAfter.cpWhite;

      const winBefore = cpToWinPercent(cpBeforePlayer);
      const winAfter = cpToWinPercent(cpAfterPlayer);
      const winDrop = Math.max(0, winBefore - winAfter);
      const accuracy = calculateMoveAccuracy(winBefore, winAfter);

      const uciPlayed = move.from + move.to + (move.promotion || '');
      const isEngineBest = evalBefore.bestMove === uciPlayed;

      const secondCpPlayer =
        evalBefore.secondBestCpWhite !== null
          ? color === 'w' ? evalBefore.secondBestCpWhite : -evalBefore.secondBestCpWhite
          : -10000;
      const secondWinPercent = cpToWinPercent(secondCpPlayer);
      const exclusivityGap = winBefore - secondWinPercent;

      const matBefore = getMaterialCount(fenBefore, color);
      const matAfter = getMaterialCount(fenAfter, color);
      const oppMatBefore = getMaterialCount(fenBefore, color === 'w' ? 'b' : 'w');
      const oppMatAfter = getMaterialCount(fenAfter, color === 'w' ? 'b' : 'w');
      const netMaterialDiff = (matAfter - matBefore) - (oppMatAfter - oppMatBefore);

      let classification = 'good';

      if (i < Math.max(6, opening.matchedPlies) && opening.eco !== 'A00' && winDrop <= 3.0) {
        classification = 'book';
      } else if (netMaterialDiff < 0 && winDrop <= 2.5 && winAfter >= 55 && i >= 6) {
        classification = 'brilliant';
      } else if (isEngineBest && exclusivityGap >= 14 && winBefore < 92 && winAfter >= 45 && i >= 6) {
        classification = 'great';
      } else if (isEngineBest || winDrop <= 1.2) {
        classification = 'best';
      } else if (winDrop <= 3.8) {
        classification = 'excellent';
      } else if (winDrop <= 8.0) {
        classification = 'good';
      } else if (winDrop <= 14.0) {
        classification = 'inaccuracy';
      } else if (winBefore >= 70 && winDrop >= 18 && winAfter >= 35) {
        // Nova classificação de Missed Win
        classification = 'missed';
      } else if (winDrop <= 23.0) {
        classification = 'mistake';
      } else {
        classification = 'blunder';
      }

      stats[color].entries.push({ accuracy, winBefore, winDrop, classification });
      stats[color].counts[classification]++;

      analyzedMoves.push({
        ply: i + 1,
        moveNumber: Math.floor(i / 2) + 1,
        color,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion || '',
        fen: fenAfter,
        cpWhite: evalAfter.cpWhite,
        mateWhite: evalAfter.mateWhite,
        bestMoveBefore: evalBefore.bestMove,
        classification,
        accuracy: Math.round(accuracy * 10) / 10
      });
    }

    const whiteAccuracy = calculatePlayerGameAccuracy(stats.w.entries);
    const blackAccuracy = calculatePlayerGameAccuracy(stats.b.entries);
    const estimateElo = (acc) => Math.max(400, Math.min(2850, Math.round(350 + Math.pow(acc / 100, 2.55) * 2350)));

    res.json({
      white: {
        name: headers.White || 'Brancas',
        elo: headers.WhiteElo || '?',
        accuracy: whiteAccuracy,
        estimatedElo: estimateElo(whiteAccuracy),
        counts: stats.w.counts
      },
      black: {
        name: headers.Black || 'Negras',
        elo: headers.BlackElo || '?',
        accuracy: blackAccuracy,
        estimatedElo: estimateElo(blackAccuracy),
        counts: stats.b.counts
      },
      opening,
      initialEval: evaluations[0],
      moves: analyzedMoves
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao executar o Stockfish.' });
  }
});

app.post('/api/evaluate', async (req, res) => {
  const { fen, depth = 12 } = req.body;
  if (!fen) return res.status(400).json({ error: 'FEN não informado.' });

  try {
    const ev = await stockfish.evaluateSingle(fen, depth);
    res.json(ev);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao avaliar posição.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});