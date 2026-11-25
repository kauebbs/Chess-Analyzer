import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chess } from 'chess.js';
import { BoardArrow, BoardView } from '../components/BoardView';
import { EvalBar } from '../components/EvalBar';
import { Icon, IconName } from '../components/Icon';
import { MoveList } from '../components/MoveList';
import { ImportModal, Tab as ImportTab } from '../components/ImportModal';
import { MoveBadge } from '../components/MoveBadge';
import { GameReport, ReportSheet } from '../components/ReportSheet';
import { AnalysisModeSheet } from '../components/AnalysisModeSheet';
import { Celebration, CelebrationEvent } from '../components/Celebration';
import { EngineStatus, StockfishBridge, StockfishHandle } from '../engine/StockfishBridge';
import { LIVE_DEPTH, REVIEW_PRESETS, ReviewMode } from '../engine/presets';
import {
  accuracyWinPercent,
  classifyGame,
  estimateRating,
  EvalData,
  gameAccuracy,
  gamePhases,
  MoveClassification,
  MoveKind,
  phaseKind,
  REPORT_ORDER,
  secondLine,
  terminalEval,
} from '../utils/moveClassifier';
import { openingNameAt } from '../utils/openings';
import { povDiff } from '../utils/winningChances';
import { parsePgn } from '../services/gameSources';
import { buildPgn } from '../services/pgnExport';
import { copyText } from '../services/share';
import { BOARD_THEMES, colors, fonts } from '../theme';
import type { MenuAction } from './MainMenu';
import { LogoMark } from '../components/Logo';
import { AnimationPrefs, celebrationAllowed } from '../settings/animation';
import type { SoundPrefs } from '../services/sounds';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MIN_CLASSIFY_DEPTH = 8; // profundidade mínima das duas avaliações para classificar um lance
const STORE_LIVE_DEPTH = 10; // a análise ao vivo passa a valer para a classificação a partir daqui

interface Ply {
  san: string;
  from: string;
  to: string;
  uci: string;
  after: string;
}

interface Variation {
  from: number; // índice do lance da partida que foi substituído
  plies: Ply[];
}

interface ReviewState {
  mode: ReviewMode;
  running: boolean;
  done: number;
  total: number;
}

export interface AnalysisPrefs {
  showArrows: boolean;
  themeIdx: number;
  pieceSet: string;
  /** Véu branco no tabuleiro durante o modo variante. */
  variantVeil: boolean;
  animation: AnimationPrefs;
  sound: SoundPrefs;
}

interface AnalysisScreenProps {
  visible: boolean;
  intent: { action: MenuAction; nonce: number } | null;
  /** PGN para abrir direto na análise (ex.: partida online que terminou). */
  loadRequest?: { pgn: string; orientation: 'white' | 'black'; nonce: number } | null;
  prefs: AnalysisPrefs;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  onSummaryChange: (summary: { title: string; subtitle: string } | null) => void;
}

const positionsOf = (startFen: string, plies: Ply[]) => [startFen, ...plies.map((p) => p.after)];

export function AnalysisScreen({
  visible,
  intent,
  loadRequest = null,
  prefs,
  onOpenMenu,
  onOpenSettings,
  onSummaryChange,
}: AnalysisScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const engineRef = useRef<StockfishHandle>(null);
  const theme = BOARD_THEMES[prefs.themeIdx];

  // ---------- Partida + variante ----------
  const [startFen, setStartFen] = useState(START_FEN);
  const [mainline, setMainline] = useState<Ply[]>([]);
  const [variation, setVariation] = useState<Variation | null>(null);
  const [index, setIndex] = useState(0);
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  const line = useMemo(
    () => (variation ? [...mainline.slice(0, variation.from), ...variation.plies] : mainline),
    [mainline, variation]
  );
  const positions = useMemo(() => positionsOf(startFen, line), [startFen, line]);
  const mainPositions = useMemo(() => positionsOf(startFen, mainline), [startFen, mainline]);
  const currentFen = positions[index];

  // ---------- Motor ----------
  const [evals, setEvals] = useState<Record<string, EvalData>>({});
  const [live, setLive] = useState<{ fen: string; data: EvalData } | null>(null);
  // Análise ao vivo começa desligada; liga sozinha ao entrar no modo variante
  const [liveOn, setLiveOn] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('loading');
  const [engineError, setEngineError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [lastReviewMode, setLastReviewMode] = useState<ReviewMode | null>(null);

  // ---------- Painéis ----------
  const [reportOpen, setReportOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>('chesscom');
  const [flipped, setFlipped] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [celebration, setCelebrationRaw] = useState<CelebrationEvent | null>(null);
  const animPrefsRef = useRef(prefs.animation);
  animPrefsRef.current = prefs.animation;
  /** Só mostra a comemoração se ela estiver ligada nas configurações. */
  const setCelebration = useCallback((ev: CelebrationEvent | null) => {
    if (ev && !celebrationAllowed(animPrefsRef.current, ev.type)) return;
    setCelebrationRaw(ev);
  }, []);
  const autoReportRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }, []);

  // ---------- Avaliações e classificações ----------
  const makeEvalAt = (pos: string[]) => {
    const final = terminalEval(new Chess(pos[pos.length - 1]));
    return (i: number): EvalData | null => (i === pos.length - 1 && final ? final : evals[pos[i]] ?? null);
  };
  const lineFinal = useMemo(() => terminalEval(new Chess(positions[positions.length - 1])), [positions]);
  const evalAt = useMemo(() => makeEvalAt(positions), [positions, evals]); // eslint-disable-line react-hooks/exhaustive-deps
  const mainEvalAt = useMemo(() => makeEvalAt(mainPositions), [mainPositions, evals]); // eslint-disable-line react-hooks/exhaustive-deps

  const classifications = useMemo(
    () => classifyGame(positions, line, evalAt, MIN_CLASSIFY_DEPTH),
    [positions, line, evalAt]
  );
  const mainClassifications = useMemo(
    () => (variation ? classifyGame(mainPositions, mainline, mainEvalAt, MIN_CLASSIFY_DEPTH) : classifications),
    [variation, mainPositions, mainline, mainEvalAt, classifications]
  );

  const blackStarts = startFen.split(' ')[1] === 'b';
  const sideOf = (i: number): 'w' | 'b' => ((i + (blackStarts ? 1 : 0)) % 2 === 0 ? 'w' : 'b');

  // Precisão da partida (sempre a partida original, sem a variante)
  const mainWhiteWin = useMemo(
    () =>
      mainPositions.map((_, i) => {
        const ev = mainEvalAt(i);
        return ev && ev.depth >= MIN_CLASSIFY_DEPTH ? accuracyWinPercent(ev.cp, ev.mate) : null;
      }),
    [mainPositions, mainEvalAt]
  );
  const accuracy = useMemo(() => gameAccuracy(mainWhiteWin, blackStarts ? 'b' : 'w'), [mainWhiteWin, blackStarts]);

  const report: GameReport = useMemo(() => {
    const emptyCounts = () => Object.fromEntries(REPORT_ORDER.map((k) => [k, 0])) as Record<MoveKind, number>;
    const counts = { w: emptyCounts(), b: emptyCounts() };
    mainClassifications.forEach((c, i) => {
      if (c) counts[sideOf(i)][c.kind] += 1;
    });
    const phases = gamePhases(mainPositions, mainClassifications);
    const phaseRow = (phase: 'opening' | 'middlegame' | 'endgame', label: string) => {
      const idx = phases.map((p, i) => (p === phase ? i : -1)).filter((i) => i >= 0);
      if (idx.length === 0) return { label, kinds: { w: null, b: null } };
      const acc = gameAccuracy(mainWhiteWin.slice(idx[0], idx[idx.length - 1] + 2), sideOf(idx[0]));
      return { label, kinds: { w: phaseKind(acc.w), b: phaseKind(acc.b) } };
    };
    let openingName: string | null = null;
    for (let i = 1; i < Math.min(mainPositions.length, 40); i++) {
      openingName = openingNameAt(mainPositions[i]) ?? openingName;
    }
    return {
      players: {
        w: { name: headers?.White || 'Brancas', elo: headers?.WhiteElo },
        b: { name: headers?.Black || 'Pretas', elo: headers?.BlackElo },
      },
      accuracy,
      counts,
      rating: { w: estimateRating(accuracy.w), b: estimateRating(accuracy.b) },
      phases: [phaseRow('opening', 'Abertura'), phaseRow('middlegame', 'Meio-jogo'), phaseRow('endgame', 'Final')],
      openingName,
      pending: mainClassifications.filter((c) => !c).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainClassifications, mainPositions, headers, accuracy, mainWhiteWin]);

  const atLineEnd = index === line.length;
  const displayEval: EvalData | null =
    atLineEnd && lineFinal
      ? lineFinal
      : liveOn && live && live.fen === currentFen && live.data.depth > 0
        ? live.data
        : evalAt(index);

  const handleEvalUpdate = useCallback((data: EvalData, fen: string) => {
    setLive({ fen, data });
    if (data.depth >= STORE_LIVE_DEPTH) {
      setEvals((prev) => ((prev[fen]?.depth ?? 0) > data.depth ? prev : { ...prev, [fen]: data }));
    }
  }, []);

  // ---------- Revisão (rápida / média / profunda) ----------
  const runReview = (mode: ReviewMode, fens: string[], known: Record<string, EvalData>) => {
    const engine = engineRef.current;
    if (!engine) return;
    const preset = REVIEW_PRESETS[mode];
    const lastChess = new Chess(fens[fens.length - 1]);
    const todo = fens.filter(
      (f, i) => (known[f]?.depth ?? 0) < preset.depth && !(i === fens.length - 1 && terminalEval(lastChess))
    );

    const finish = () => {
      setLastReviewMode(mode);
      if (autoReportRef.current) {
        autoReportRef.current = false;
        setReportOpen(true);
      }
    };
    if (todo.length === 0) {
      setReview({ mode, running: false, done: 0, total: 0 });
      finish();
      return;
    }

    setReview({ mode, running: true, done: 0, total: todo.length });
    engine
      .analyzePositions(todo, { depth: preset.depth, movetimeMs: preset.movetimeMs }, (i, data) => {
        const fen = todo[i];
        setEvals((prev) => ((prev[fen]?.depth ?? 0) >= data.depth ? prev : { ...prev, [fen]: data }));
        setReview((r) => (r ? { ...r, done: i + 1 } : r));
      })
      .then((completed) => {
        setReview((r) => (completed && r ? { ...r, running: false } : completed ? r : null));
        if (completed) finish();
      });
  };

  const startReview = (mode: ReviewMode) => {
    setModeSheetOpen(false);
    if (mainline.length === 0) return;
    engineRef.current?.cancelReview();
    autoReportRef.current = true;
    runReview(mode, mainPositions, evals);
  };

  const cancelReview = () => {
    engineRef.current?.cancelReview();
    setReview(null);
    autoReportRef.current = false;
  };

  // ---------- Carregar / nova partida ----------
  const loadPgn = (pgn: string, orientation: 'white' | 'black') => {
    const parsed = parsePgn(pgn); // lança erro se inválido (mostrado no modal)
    if (parsed.moves.length === 0) throw new Error('Esse PGN não tem lances.');

    engineRef.current?.cancelReview();
    const plies = parsed.moves.map((m) => ({ san: m.san, from: m.from, to: m.to, uci: m.uci, after: m.after }));
    setStartFen(parsed.startFen);
    setMainline(plies);
    setVariation(null);
    setHeaders(parsed.headers);
    setIndex(0);
    setLive(null);
    setLiveOn(false);
    setFlipped(orientation === 'black');
    setEvals({});
    setReportOpen(false);
    setLastReviewMode(null);
    autoReportRef.current = true;
    runReview('medium', positionsOf(parsed.startFen, plies), {});
  };

  const newBoard = () => {
    engineRef.current?.cancelReview();
    setStartFen(START_FEN);
    setMainline([]);
    setVariation(null);
    setHeaders(null);
    setIndex(0);
    setLive(null);
    setLiveOn(false);
    setReview(null);
    setLastReviewMode(null);
    autoReportRef.current = false;
  };

  // Ações vindas do menu principal
  useEffect(() => {
    if (!intent) return;
    if (intent.action === 'chesscom' || intent.action === 'lichess' || intent.action === 'pgn') {
      setImportTab(intent.action);
      setImportOpen(true);
    } else if (intent.action === 'free') {
      newBoard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.nonce]);

  // Partida vinda de outra tela (jogo online)
  useEffect(() => {
    if (!loadRequest) return;
    try {
      loadPgn(loadRequest.pgn, loadRequest.orientation);
    } catch (e: any) {
      showToast(e?.message ?? 'Não foi possível abrir a partida');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRequest?.nonce]);

  // Resumo para o "Continuar análise" do menu
  useEffect(() => {
    if (mainline.length === 0) onSummaryChange(null);
    else
      onSummaryChange({
        title: headers ? `${headers.White || 'Brancas'} x ${headers.Black || 'Pretas'}` : 'Tabuleiro livre',
        subtitle: `${Math.ceil(mainline.length / 2)} lances`,
      });
  }, [mainline, headers, onSummaryChange]);

  // ---------- Lances no tabuleiro (partida / variante) ----------
  const stateRef = useRef({ currentFen, line, index, mainline, variation, headers });
  stateRef.current = { currentFen, line, index, mainline, variation, headers };

  const handleMove = useCallback((from: string, to: string) => {
    const s = stateRef.current;
    const chess = new Chess(s.currentFen);
    let move;
    try {
      move = chess.move({ from, to, promotion: 'q' });
    } catch {
      return; // lance inválido
    }
    if (!move) return;
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    const ply: Ply = { san: move.san, from: move.from, to: move.to, uci, after: move.after };

    // Mesmo lance da linha atual: só avança
    if (s.line[s.index]?.uci === uci) {
      setIndex(s.index + 1);
      return;
    }
    // Tabuleiro livre: não existe modo variante; um lance diferente substitui o resto da linha
    if (!s.headers) {
      if (s.mainline.length === 0) setLiveOn(true); // não há partida para revisar
      setVariation(null);
      setMainline([...s.mainline.slice(0, s.index), ply]);
      setIndex(s.index + 1);
      return;
    }
    // Lance diferente: entra (ou continua) no modo variante, sem mexer na partida
    if (s.variation && s.index >= s.variation.from) {
      setVariation({ from: s.variation.from, plies: [...s.variation.plies.slice(0, s.index - s.variation.from), ply] });
    } else {
      setVariation({ from: s.index, plies: [ply] });
    }
    setIndex(s.index + 1);
  }, []);

  // Entrar no modo variante liga a análise ao vivo; sair dele desliga
  const inVariation = !!variation;
  const prevInVariation = useRef(false);
  useEffect(() => {
    if (inVariation === prevInVariation.current) return;
    prevInVariation.current = inVariation;
    // No tabuleiro livre (sem partida importada) a análise ao vivo continua ligada
    setLiveOn(inVariation || (!headers && mainline.length > 0));
  }, [inVariation]); // eslint-disable-line react-hooks/exhaustive-deps

  const exitVariation = () => {
    if (!variation) return;
    setIndex(Math.min(index, variation.from));
    setVariation(null);
  };

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(line.length, i)));

  const copyPgn = async () => {
    try {
      await copyText(buildPgn(headers, startFen, mainline, variation));
      showToast(variation ? 'PGN copiado (com a variante)' : 'PGN copiado');
    } catch (e: any) {
      showToast(`Não foi possível copiar: ${e?.message ?? e}`);
    }
  };

  // ---------- Textos derivados ----------
  const lastPly = index > 0 ? line[index - 1] : null;
  const lastCls: MoveClassification | null = index > 0 ? classifications[index - 1] : null;

  const sanOf = (fen: string, uci: string) => {
    try {
      return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' })?.san ?? uci;
    } catch {
      return uci;
    }
  };

  const bestSanBefore = useMemo(() => {
    if (!lastPly || !lastCls) return null;
    const before = evalAt(index - 1);
    if (!before?.bestMove || before.bestMove === lastPly.uci) return null;
    return sanOf(positions[index - 1], before.bestMove);
  }, [lastPly, lastCls, index, positions, evalAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const uniqueInfo = useMemo(() => {
    if (!lastPly || !lastCls || !['great', 'brilliant'].includes(lastCls.kind)) return null;
    const before = evalAt(index - 1);
    const second = before ? secondLine(before) : null;
    if (!before || !second) return null;
    const mover = positions[index - 1].split(' ')[1] === 'w' ? 1 : -1;
    const loss = before.mate === null && second.mate === null ? ((before.cp - second.cp) * mover) / 100 : null;
    return { san: sanOf(positions[index - 1], second.move), loss };
  }, [lastPly, lastCls, index, positions, evalAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Setas no estilo do Lichess (largura 12 → 2 conforme a alternativa piora). */
  const arrows = useMemo<BoardArrow[]>(() => {
    if (!prefs.showArrows || !displayEval || displayEval.result) return [];
    const color = currentFen.split(' ')[1] as 'w' | 'b';
    const pvs =
      displayEval.pvs && displayEval.pvs.length > 0
        ? displayEval.pvs
        : displayEval.bestMove
          ? [{ move: displayEval.bestMove, cp: displayEval.cp, mate: displayEval.mate }]
          : [];
    if (pvs.length === 0) return [];
    const toArrow = (uci: string, w: number, c: string, opacity: number): BoardArrow => ({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      width: w,
      color: c,
      opacity,
    });
    const alternatives: BoardArrow[] = [];
    pvs.slice(1).forEach((pv) => {
      if (!pv || pv.move === pvs[0].move) return;
      const shift = povDiff(color, pvs[0], pv);
      if (shift >= 0 && shift < 0.2) alternatives.push(toArrow(pv.move, Math.round(12 - shift * 50), theme.secondArrow, 0.55));
    });
    return [...alternatives, toArrow(pvs[0].move, 15, theme.bestArrow, 0.85)];
  }, [prefs.showArrows, displayEval, currentFen, theme]);

  const moveBadge = useMemo(
    () => (lastPly && lastCls ? { square: lastPly.to, kind: lastCls.kind } : null),
    [lastPly, lastCls?.kind] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const lastMoveColor = lastCls && lastCls.kind !== 'book' ? lastCls.color : null;

  const jumpToKind = (side: 'w' | 'b', kind: MoveKind) => {
    const matches = mainClassifications
      .map((c, i) => (c?.kind === kind && sideOf(i) === side ? i : -1))
      .filter((i) => i >= 0);
    if (matches.length === 0) return;
    setVariation(null);
    const next = matches.find((i) => i + 1 > index) ?? matches[0];
    setReportOpen(false);
    setIndex(next + 1);
  };

  // ---------- Animações especiais (brilhante, xeque-mate, vitória) ----------
  const prevNavRef = useRef<{ index: number; kind: MoveKind | null }>({ index: 0, kind: null });
  const victoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevNavRef.current;
    const kind = lastCls?.kind ?? null;
    prevNavRef.current = { index, kind };
    const forward = index === prev.index + 1 || (index > prev.index && index === line.length);
    const becameBrilliant = index === prev.index && kind === 'brilliant' && prev.kind !== 'brilliant';
    if (index === 0 || !(forward || becameBrilliant)) return;

    if (victoryTimer.current) clearTimeout(victoryTimer.current);
    const id = Date.now();
    const fen = positions[index];
    const whiteName = headers?.White || 'Brancas';
    const blackName = headers?.Black || 'Pretas';
    const victory = (result: '1-0' | '0-1', how: string): CelebrationEvent => ({
      id: id + 1,
      type: 'victory',
      winner: result === '1-0' ? 'w' : 'b',
      title: headers
        ? `VITÓRIA DE ${(result === '1-0' ? whiteName : blackName).toUpperCase()}`
        : `VITÓRIA DAS ${result === '1-0' ? 'BRANCAS' : 'PRETAS'}`,
      subtitle: `${result} · ${how}`,
    });

    // Xeque-mate na posição: onda no rei + depois a vitória
    if (forward && atLineEnd && lineFinal?.result) {
      if (lineFinal.result === '½-½') {
        setCelebration({ id, type: 'draw', title: 'EMPATE', subtitle: '½-½' });
      } else {
        const chess = new Chess(fen);
        const kingSq = chess
          .board()
          .flat()
          .find((p) => p && p.type === 'k' && p.color === chess.turn())?.square;
        setCelebration({ id, type: 'checkmate', square: kingSq ?? 'e1' });
        const mateDelay = prefs.animation.celebrateCheckmate ? 1500 : 0;
        victoryTimer.current = setTimeout(
          () => setCelebration(victory(lineFinal.result as '1-0' | '0-1', 'XEQUE-MATE')),
          mateDelay
        );
      }
      return;
    }

    if (kind === 'brilliant' && lastPly) setCelebration({ id, type: 'brilliant', square: lastPly.to });

    // Fim da partida importada sem mate (abandono, tempo...)
    if (forward && !variation && headers && atLineEnd && index === mainline.length) {
      const result = headers.Result;
      const term = (headers.Termination || '').toLowerCase();
      const how = term.includes('resign') || term.includes('abandon')
        ? 'ABANDONO'
        : term.includes('time')
          ? 'TEMPO'
          : 'FIM DE PARTIDA';
      const delay = kind === 'brilliant' && prefs.animation.celebrateBrilliant ? 1200 : 0;
      if (result === '1-0' || result === '0-1') {
        victoryTimer.current = setTimeout(() => setCelebration(victory(result, how)), delay);
      } else if (result === '1/2-1/2') {
        victoryTimer.current = setTimeout(
          () => setCelebration({ id: id + 1, type: 'draw', title: 'EMPATE', subtitle: '½-½' }),
          delay
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, lastCls?.kind, line]);

  useEffect(() => () => {
    if (victoryTimer.current) clearTimeout(victoryTimer.current);
  }, []);

  // ---------- Layout ----------
  // Tabuleiro de ponta a ponta na largura da tela (múltiplo de 8 para as casas ficarem exatas);
  // em telas baixas ou largas ele encolhe para caber o resto.
  const reserved = 296 + insets.top + insets.bottom;
  const boardSize = Math.max(232, Math.floor(Math.min(width, height - reserved, 640) / 8) * 8);
  const panelWidth = Math.min(width, 640);
  const firstMoveNumber = useMemo(() => new Chess(startFen).moveNumber(), [startFen]);

  const whiteName = headers?.White || 'Brancas';
  const blackName = headers?.Black || 'Pretas';
  const topPlayer = flipped
    ? { name: whiteName, elo: headers?.WhiteElo, acc: accuracy.w, color: 'w' as const }
    : { name: blackName, elo: headers?.BlackElo, acc: accuracy.b, color: 'b' as const };
  const bottomPlayer = flipped
    ? { name: blackName, elo: headers?.BlackElo, acc: accuracy.b, color: 'b' as const }
    : { name: whiteName, elo: headers?.WhiteElo, acc: accuracy.w, color: 'w' as const };
  const showAccuracy = !!lastReviewMode;
  const reviewDone = !!lastReviewMode && !review?.running;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StockfishBridge
        ref={engineRef}
        fen={currentFen}
        depth={LIVE_DEPTH}
        liveEnabled={liveOn && visible}
        onEvalUpdate={handleEvalUpdate}
        onStatusChange={(status, detail) => {
          setEngineStatus(status);
          setEngineError(status === 'error' ? detail ?? 'Erro no motor' : null);
        }}
      />

      <View style={[styles.column, { width: panelWidth }]}>
        {/* Topo */}
        <View style={styles.topBar}>
          <IconButton name="home" label="Menu principal" onPress={onOpenMenu} />
          <View style={styles.titleWrap}>
            {variation ? (
              <Pressable
                onPress={exitVariation}
                accessibilityLabel="Sair da variante e voltar à partida"
                style={({ pressed }) => [styles.variantPill, pressed && { opacity: 0.7 }]}
              >
                <Icon name="branch" size={13} color={colors.bg} />
                <Text style={styles.variantText} numberOfLines={1}>
                  VARIANTE
                </Text>
                <Icon name="close" size={13} color={colors.bg} strokeWidth={3} />
              </Pressable>
            ) : (
              <LogoMark size={30} />
            )}
          </View>
          <View style={styles.topIcons}>
            <EngineDot status={engineStatus} />
            <IconButton
              name="search"
              label={liveOn ? 'Desligar análise ao vivo' : 'Ligar análise ao vivo'}
              onPress={() => {
                setLiveOn((v) => !v);
                showToast(liveOn ? 'Análise ao vivo desligada' : 'Análise ao vivo ligada');
              }}
              activeColor={colors.mint}
              active={liveOn}
            />
            <IconButton name="copy" label="Copiar PGN" onPress={copyPgn} disabled={line.length === 0} />
            <IconButton
              name="import"
              label="Importar partida"
              onPress={() => {
                setImportTab('chesscom');
                setImportOpen(true);
              }}
            />
            <IconButton name="settings" label="Configurações" onPress={onOpenSettings} />
          </View>
        </View>

        <View style={styles.middle}>
          <PlayerBar {...topPlayer} showAccuracy={showAccuracy} />

          <View style={styles.boardBlock}>
            <EvalBar
              evaluation={displayEval}
              width={boardSize}
              flipped={flipped}
              smooth={prefs.animation.evalBarSmooth && prefs.animation.pieceSpeed !== 'off'}
            />
            <View style={{ width: boardSize, height: boardSize }}>
              <BoardView
                fen={currentFen}
                size={boardSize}
                onMove={handleMove}
                lastMove={lastPly}
                arrows={arrows}
                flipped={flipped}
                theme={theme}
                pieceSet={prefs.pieceSet}
                moveBadge={moveBadge}
                lastMoveColor={lastMoveColor}
                animation={prefs.animation}
                veil={!!variation && prefs.variantVeil}
              />
              <Celebration
                event={celebration}
                size={boardSize}
                flipped={flipped}
                intensity={prefs.animation.intensity}
                pieceSet={prefs.pieceSet}
                onDone={(id) => setCelebrationRaw((c) => (c?.id === id ? null : c))}
              />
            </View>
          </View>

          <PlayerBar {...bottomPlayer} showAccuracy={showAccuracy} />

          <View style={styles.feedback}>
            {engineError ? (
              <Text style={styles.feedbackError} numberOfLines={2}>
                Motor: {engineError}
              </Text>
            ) : review?.running ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.feedbackMuted}>
                  Análise {REVIEW_PRESETS[review.mode].label.toLowerCase()} · {review.done}/{review.total}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${Math.round((review.done / Math.max(1, review.total)) * 100)}%` }]}
                  />
                </View>
              </View>
            ) : lastPly && displayEval?.result && atLineEnd ? (
              <Text style={styles.feedbackText}>
                {lastPly.san} ·{' '}
                <Text style={{ color: colors.red }}>
                  {displayEval.result === '½-½' ? 'Empate' : `Xeque-mate · ${displayEval.result}`}
                </Text>
              </Text>
            ) : lastPly && lastCls ? (
              <View style={styles.feedbackRow}>
                <MoveBadge kind={lastCls.kind} size={24} />
                <Text style={styles.feedbackText} numberOfLines={2}>
                  {lastPly.san} <Text style={{ color: lastCls.color }}>{lastCls.label.toLowerCase()}</Text>
                  {lastCls.kind === 'book' && openingNameAt(currentFen) ? (
                    <Text style={styles.feedbackMuted}> · {openingNameAt(currentFen)}</Text>
                  ) : uniqueInfo ? (
                    <Text style={styles.feedbackMuted}>
                      {' '}· único lance; 2ª opção {uniqueInfo.san}
                      {uniqueInfo.loss !== null ? ` (−${Math.max(0, uniqueInfo.loss).toFixed(1)})` : ' perdia o mate'}
                    </Text>
                  ) : bestSanBefore && !['best', 'great', 'brilliant', 'book'].includes(lastCls.kind) ? (
                    <Text style={styles.feedbackMuted}> · melhor era {bestSanBefore}</Text>
                  ) : null}
                </Text>
              </View>
            ) : lastPly ? (
              <Text style={styles.feedbackMuted}>
                {liveOn ? `Analisando ${lastPly.san}…` : `${lastPly.san} · análise ao vivo desligada (lupa)`}
              </Text>
            ) : (
              <Text style={styles.feedbackMuted}>Arraste uma peça ou importe uma partida</Text>
            )}
          </View>

          <View style={styles.moves}>
            <MoveList
              sans={line.map((p) => p.san)}
              classifications={classifications}
              index={index}
              firstMoveNumber={firstMoveNumber}
              blackStarts={blackStarts}
              onSelect={goTo}
              variationFrom={variation ? variation.from : null}
            />
          </View>
        </View>

        {/* Barra de ícones (sempre no rodapé) */}
        <View style={styles.toolbar}>
          <IconButton name="reset" label="Novo tabuleiro" onPress={newBoard} />
          <IconButton name="flip" label="Girar tabuleiro" onPress={() => setFlipped((f) => !f)} />
          <IconButton name="first" label="Início" onPress={() => goTo(0)} disabled={index === 0} />
          <IconButton name="prev" label="Voltar" onPress={() => goTo(index - 1)} disabled={index === 0} big />
          <IconButton name="next" label="Avançar" onPress={() => goTo(index + 1)} disabled={index >= line.length} big />
          <IconButton name="last" label="Fim" onPress={() => goTo(line.length)} disabled={index >= line.length} />
          <IconButton
            name="review"
            label="Analisar partida"
            onPress={() => setModeSheetOpen(true)}
            active={!!review?.running}
          />
        </View>
      </View>

      {toast && (
        <View style={[styles.toast, { bottom: 84 + insets.bottom }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <AnalysisModeSheet
        visible={modeSheetOpen}
        onClose={() => setModeSheetOpen(false)}
        onPick={startReview}
        running={review?.running ? { mode: review.mode, done: review.done, total: review.total } : null}
        onCancel={cancelReview}
        canShowReport={reviewDone && mainline.length > 0}
        onShowReport={() => {
          setModeSheetOpen(false);
          setReportOpen(true);
        }}
        plyCount={mainline.length}
        lastMode={lastReviewMode}
      />
      <ReportSheet
        visible={reportOpen}
        report={report}
        onClose={() => setReportOpen(false)}
        onSelectKind={jumpToKind}
        onCopyPgn={copyPgn}
        onToast={showToast}
        onStart={() => {
          setReportOpen(false);
          setVariation(null);
          setIndex(1);
        }}
      />
      <ImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onLoadPgn={loadPgn}
        initialTab={importTab}
      />
    </SafeAreaView>
  );
}

// ---------- Componentes pequenos ----------

function IconButton({
  name,
  label,
  onPress,
  disabled = false,
  active = false,
  activeColor = colors.red,
  big = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  activeColor?: string;
  big?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconBtn,
        active && { backgroundColor: `${activeColor}26` },
        pressed && styles.iconBtnPressed,
        disabled && { opacity: 0.3 },
      ]}
    >
      <Icon name={name} size={big ? 26 : 20} color={active ? activeColor : colors.text} />
    </Pressable>
  );
}

function PlayerBar({
  name,
  elo,
  acc,
  color,
  showAccuracy,
}: {
  name: string;
  elo?: string;
  acc: number | null;
  color: 'w' | 'b';
  showAccuracy: boolean;
}) {
  return (
    <View style={styles.playerBar}>
      <View style={[styles.playerSwatch, color === 'w' ? styles.swatchWhite : styles.swatchBlack]} />
      <Text style={styles.playerName} numberOfLines={1}>
        {name}
        {elo ? <Text style={styles.playerElo}> ({elo})</Text> : null}
      </Text>
      {showAccuracy && acc !== null && (
        <View style={styles.accChip}>
          <Text style={styles.accText}>{acc.toFixed(1)}%</Text>
        </View>
      )}
    </View>
  );
}

function EngineDot({ status }: { status: EngineStatus }) {
  const color =
    status === 'error' ? colors.red : status === 'loading' ? colors.textMuted : status === 'thinking' ? '#f5b342' : colors.mint;
  return <View style={[styles.engineDot, { backgroundColor: color }]} accessibilityLabel={`Motor: ${status}`} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    justifyContent: 'space-between',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  topBar: {
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 6,
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  brand: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 1.2,
  },
  variantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: colors.mint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  variantText: {
    color: colors.bg,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  topIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  engineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
  },
  playerBar: {
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    gap: 8,
  },
  playerSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  swatchWhite: {
    backgroundColor: '#ece8e1',
  },
  swatchBlack: {
    backgroundColor: '#2a2a2e',
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  playerName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  playerElo: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  accChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  accText: {
    color: colors.mint,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 13,
  },
  boardBlock: {
    alignSelf: 'center',
  },
  feedback: {
    marginHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    marginTop: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackError: {
    color: colors.red,
    fontSize: 13,
  },
  feedbackMuted: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '400',
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.red,
  },
  moves: {
    marginHorizontal: 12,
    height: 34,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toolbar: {
    marginHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastText: {
    color: colors.text,
    fontSize: 13,
  },
});
