import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import { CoachInput, evalText, KeyMoment } from '../ai/coach';
import { CoachBubble } from '../components/CoachBubble';
import { CoachAvatar } from '../components/CoachAvatar';
import { explainMove, lineSan } from '../utils/moveExplainer';
import { useAiConfig } from '../ai/config';
import { AnalysisModeSheet } from '../components/AnalysisModeSheet';
import { Celebration, CelebrationEvent } from '../components/Celebration';
import { EngineStatus, StockfishBridge, StockfishHandle } from '../engine/StockfishBridge';
import { LIVE_DEPTH, REVIEW_PRESETS, ReviewMode } from '../engine/presets';
import {
  estimateRating,
  EvalData,
  capsWinPercent,
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
import { createGameClassifier } from '../utils/incrementalClassify';
import { povDiff } from '../utils/winningChances';
import { parsePgn } from '../services/gameSources';
import { buildPgn } from '../services/pgnExport';
import { CapturedRow } from '../components/Captured';
import { copyText } from '../services/share';
import { BOARD_THEMES, colors, fonts, themed } from '../theme';
import type { MenuAction } from './MainMenu';
import { LogoMark } from '../components/Logo';
import { AnimationPrefs, celebrationAllowed } from '../settings/animation';
import type { SoundPrefs } from '../services/sounds';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MIN_CLASSIFY_DEPTH = 8; // profundidade mínima das duas avaliações para classificar um lance
const STORE_LIVE_DEPTH = 10; // a análise ao vivo passa a valer para a classificação a partir daqui
/** A análise ao vivo chega linha a linha (3 linhas do MultiPV por profundidade): a tela atualiza no máximo a cada 120 ms. */
const LIVE_UI_INTERVAL_MS = 120;
/** Resultados da revisão são juntados e aplicados no máximo a cada 400 ms (cada aplicação reclassifica a partida). */
const REVIEW_FLUSH_MS = 400;
/** O motor (WebView + WASM de 1,8 MB) é preparado alguns segundos depois da abertura, ou na hora ao abrir a análise. */
const ENGINE_WARMUP_MS = 3000;

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
  loadRequest?: { pgn: string; orientation: 'white' | 'black'; nonce: number; silent?: boolean } | null;
  prefs: AnalysisPrefs;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  onSummaryChange: (summary: AnalysisSummary | null) => void;
  /** Análise aberta de um jogo/torneio: rótulo do botão de volta (ex.: "Voltar ao torneio"). */
  returnLabel?: string | null;
  onReturn?: () => void;
}

const positionsOf = (startFen: string, plies: Ply[]) => [startFen, ...plies.map((p) => p.after)];

/** Resumo da análise aberta (menu "Continuar análise" e reabertura ao trocar o tema). */
export interface AnalysisSummary {
  title: string;
  subtitle: string;
  pgn: string;
  orientation: 'white' | 'black';
}

export function AnalysisScreen({
  visible,
  intent,
  loadRequest = null,
  prefs,
  onOpenMenu,
  onOpenSettings,
  onSummaryChange,
  returnLabel = null,
  onReturn,
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
  // Classificar, calcular a precisão e montar o relatório percorre a partida inteira com o chess.js
  // (numa partida de 80 lances são 160 posições). Isso usa uma cópia "atrasada" das avaliações
  // (useDeferredValue): passar os lances e a barra de avaliação respondem na hora e o recálculo
  // vem logo depois, sem segurar o toque.
  const statsEvals = useDeferredValue(evals);
  const lineFinal = useMemo(() => terminalEval(new Chess(positions[positions.length - 1])), [positions]);
  const mainFinal = useMemo(() => terminalEval(new Chess(mainPositions[mainPositions.length - 1])), [mainPositions]);
  const makeEvalAt = (pos: string[], final: EvalData | null, source: Record<string, EvalData>) =>
    (i: number): EvalData | null => (i === pos.length - 1 && final ? final : source[pos[i]] ?? null);
  // Avaliação atual (barra, setas, professor): sempre a mais nova
  const evalAt = useMemo(() => makeEvalAt(positions, lineFinal, evals), [positions, lineFinal, evals]);
  // Estatísticas da partida (classificação, precisão, relatório): versão atrasada
  const statsEvalAt = useMemo(() => makeEvalAt(positions, lineFinal, statsEvals), [positions, lineFinal, statsEvals]);
  const mainEvalAt = useMemo(
    () => makeEvalAt(mainPositions, mainFinal, statsEvals),
    [mainPositions, mainFinal, statsEvals]
  );

  // Classificação incremental: cada avaliação nova refaz só os lances vizinhos (mesmo resultado de antes)
  const classifyLine = useMemo(createGameClassifier, []);
  const classifyMain = useMemo(createGameClassifier, []);
  const classifications = useMemo(
    () => classifyLine(positions, line, statsEvalAt, MIN_CLASSIFY_DEPTH),
    [classifyLine, positions, line, statsEvalAt]
  );
  const mainClassifications = useMemo(
    () => (variation ? classifyMain(mainPositions, mainline, mainEvalAt, MIN_CLASSIFY_DEPTH) : classifications),
    [classifyMain, variation, mainPositions, mainline, mainEvalAt, classifications]
  );

  const blackStarts = startFen.split(' ')[1] === 'b';
  const sideOf = (i: number): 'w' | 'b' => ((i + (blackStarts ? 1 : 0)) % 2 === 0 ? 'w' : 'b');

  // Precisão da partida (sempre a partida original, sem a variante)
  const mainWhiteWin = useMemo(
    () =>
      mainPositions.map((_, i) => {
        const ev = mainEvalAt(i);
        return ev && ev.depth >= MIN_CLASSIFY_DEPTH ? capsWinPercent(ev.cp, ev.mate) : null;
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

  // Fatos para os professores (só a partida original): os lances mais marcantes, com o melhor lance do motor
  const coachInput: CoachInput = useMemo(() => {
    const weight: Partial<Record<MoveKind, number>> = { blunder: 50, miss: 40, mistake: 30, brilliant: 30, great: 20, inaccuracy: 10 };
    const san = (fen: string, uci: string) => {
      try {
        return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' })?.san ?? uci;
      } catch {
        return uci;
      }
    };
    const picked: { i: number; score: number; m: () => KeyMoment }[] = [];
    mainClassifications.forEach((c, i) => {
      const w = c ? weight[c.kind] : undefined;
      const before = mainEvalAt(i);
      const after = mainEvalAt(i + 1);
      if (!c || !w || !before || !after) return;
      const side = sideOf(i);
      const fen = mainPositions[i];
      const num = fen.split(' ')[5] ?? '1';
      const ply = mainline[i];
      // O lance do motor em SAN (chess.js) só é montado para os 7 momentos escolhidos
      const best = () => (before.bestMove && before.bestMove !== ply.uci ? san(fen, before.bestMove) : null);
      picked.push({
        i,
        score: w + (100 - c.accuracy) / 10,
        m: () => ({
          label: `${num}${side === 'w' ? '.' : '...'} ${ply.san}`,
          side,
          kind: c.kind,
          best: ['brilliant', 'great'].includes(c.kind) ? null : best(),
          before: evalText(before.cp, before.mate, side),
          after: evalText(after.cp, after.mate, side),
        }),
      });
    });
    const moments = picked
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .sort((a, b) => a.i - b.i)
      .map((p) => p.m());
    return {
      players: { w: report.players.w.name, b: report.players.b.name },
      result: headers?.Result && headers.Result !== '*' ? headers.Result : undefined,
      opening: report.openingName,
      accuracy: report.accuracy,
      rating: report.rating,
      moments,
      student: null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, mainClassifications, mainEvalAt, mainPositions, mainline, headers]);

  const atLineEnd = index === line.length;
  const displayEval: EvalData | null =
    atLineEnd && lineFinal
      ? lineFinal
      : liveOn && live && live.fen === currentFen && live.data.depth > 0
        ? live.data
        : evalAt(index);

  // O motor manda várias linhas por segundo; antes cada uma redesenhava a tela inteira e, a partir da
  // profundidade 10, reclassificava a partida toda. Agora as linhas que chegam juntas viram uma atualização só.
  const livePending = useRef<{ fen: string; data: EvalData } | null>(null);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushLive = useCallback(() => {
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = null;
    const p = livePending.current;
    livePending.current = null;
    if (!p) return;
    setLive(p);
    if (p.data.depth >= STORE_LIVE_DEPTH) {
      setEvals((prev) => ((prev[p.fen]?.depth ?? 0) > p.data.depth ? prev : { ...prev, [p.fen]: p.data }));
    }
  }, []);
  const handleEvalUpdate = useCallback(
    (data: EvalData, fen: string) => {
      // Mudou de posição com uma atualização na fila: aplica a da posição antiga antes (não perde a avaliação)
      if (livePending.current && livePending.current.fen !== fen) flushLive();
      livePending.current = { fen, data };
      if (!liveTimer.current) liveTimer.current = setTimeout(flushLive, LIVE_UI_INTERVAL_MS);
    },
    [flushLive]
  );

  // Resultados da revisão: juntados e aplicados de tempos em tempos
  const reviewBatch = useRef<{
    token: number;
    evals: Record<string, EvalData>;
    done: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ token: 0, evals: {}, done: 0, timer: null });
  const flushReview = useCallback(() => {
    const b = reviewBatch.current;
    if (b.timer) clearTimeout(b.timer);
    b.timer = null;
    const batch = b.evals;
    const done = b.done;
    b.evals = {};
    const fens = Object.keys(batch);
    if (fens.length > 0) {
      setEvals((prev) => {
        let next = prev;
        for (const fen of fens) {
          const data = batch[fen];
          if ((next[fen]?.depth ?? 0) >= data.depth) continue;
          if (next === prev) next = { ...prev };
          next[fen] = data;
        }
        return next;
      });
    }
    if (done > 0) setReview((r) => (r ? { ...r, done } : r));
  }, []);

  useEffect(
    () => () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
      if (reviewBatch.current.timer) clearTimeout(reviewBatch.current.timer);
    },
    []
  );

  // ---------- Motor sob demanda ----------
  // Antes o motor era carregado junto com a abertura do app (a tela de análise fica montada escondida):
  // ler 1,8 MB de WASM, converter em base64 e injetar no WebView competia com a primeira tela.
  const [engineMounted, setEngineMounted] = useState(visible);
  useEffect(() => {
    if (engineMounted) return;
    if (visible) {
      setEngineMounted(true);
      return;
    }
    const timer = setTimeout(() => setEngineMounted(true), ENGINE_WARMUP_MS);
    return () => clearTimeout(timer);
  }, [visible, engineMounted]);
  // Revisão pedida antes de o motor existir (ex.: partida aberta logo na abertura): roda quando ele montar
  const pendingReview = useRef<(() => void) | null>(null);

  // ---------- Revisão (rápida / média / profunda) ----------
  const runReview = (mode: ReviewMode, fens: string[], known: Record<string, EvalData>) => {
    const engine = engineRef.current;
    if (!engine) {
      pendingReview.current = () => runReview(mode, fens, known);
      setEngineMounted(true);
      return;
    }
    pendingReview.current = null;
    const batch = reviewBatch.current;
    if (batch.timer) clearTimeout(batch.timer);
    batch.timer = null;
    batch.evals = {};
    batch.done = 0;
    const token = ++batch.token;
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
        const b = reviewBatch.current;
        if (b.token !== token) return;
        const fen = todo[i];
        if ((b.evals[fen]?.depth ?? 0) < data.depth) b.evals[fen] = data;
        b.done = i + 1;
        if (!b.timer) b.timer = setTimeout(flushReview, REVIEW_FLUSH_MS);
      })
      .then((completed) => {
        if (reviewBatch.current.token === token) flushReview();
        setReview((r) => (completed && r ? { ...r, running: false } : completed ? r : null));
        if (completed) finish();
      });
  };

  useEffect(() => {
    if (!engineMounted || !pendingReview.current) return;
    const run = pendingReview.current;
    pendingReview.current = null;
    run();
  }, [engineMounted]);

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
  const loadPgn = (pgn: string, orientation: 'white' | 'black', silent = false) => {
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
    autoReportRef.current = !silent;
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
      loadPgn(loadRequest.pgn, loadRequest.orientation, loadRequest.silent);
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
        pgn: buildPgn(headers, startFen, mainline, null),
        orientation: flipped ? 'black' : 'white',
      });
  }, [mainline, headers, startFen, flipped, onSummaryChange]);

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

  const lineLength = useRef(0);
  lineLength.current = line.length;
  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(lineLength.current, i))), []);
  const sans = useMemo(() => line.map((p) => p.san), [line]);

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
  const bookName = lastCls?.kind === 'book' ? openingNameAt(currentFen) : null;

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

  // ---------- Professor lance a lance ----------
  const [aiCfg] = useAiConfig();
  const coachExplanation = useMemo(() => {
    if (!lastPly || !lastCls) return null;
    const before = evalAt(index - 1);
    const after = evalAt(index);
    if (!before || !after) return null;
    try {
      const ex = explainMove({
        fenBefore: positions[index - 1],
        played: lastPly.uci,
        kind: lastCls.kind,
        before,
        after,
        secondSan: uniqueInfo?.san ?? null,
      });
      const color = positions[index - 1].split(' ')[1] as 'w' | 'b';
      return {
        ex,
        bestLineSan: ex.bestSan && ex.bestLine.length ? lineSan(positions[index - 1], ex.bestLine, 6) : null,
        replySan: ex.reply.length ? lineSan(positions[index], ex.reply, 5) : null,
        evalAfter: after.result ? null : evalText(after.cp, after.mate, color),
      };
    } catch {
      return null;
    }
  }, [lastPly, lastCls, index, positions, evalAt, uniqueInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Mostra uma linha do motor no tabuleiro como variante, a partir da posição `from` da linha atual. */
  const playLine = (from: number, ucis: string[]) => {
    const c = new Chess(positions[from]);
    const plies: Ply[] = [];
    for (const u of ucis.slice(0, 8)) {
      try {
        const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] as any) ?? 'q' });
        plies.push({ san: m.san, from: m.from, to: m.to, uci: m.from + m.to + (m.promotion ?? ''), after: c.fen() });
      } catch {
        break;
      }
    }
    if (!plies.length) return;
    if (variation && from >= variation.from) {
      setVariation({ from: variation.from, plies: [...variation.plies.slice(0, from - variation.from), ...plies] });
    } else {
      setVariation({ from, plies });
    }
    setIndex(from + 1);
    showToast('Linha do motor no tabuleiro · toque em VARIANTE para voltar');
  };

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
  // Com a partida revisada, o professor ganha um balão (o tabuleiro encolhe um pouco, sempre do mesmo tanto)
  const coachMode = !!headers && !!lastReviewMode && !review?.running && mainline.length > 0;
  const reserved = 296 + (coachMode ? 46 : 0) + (returnLabel ? 52 : 0) + insets.top + insets.bottom;
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
      {engineMounted && (
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
      )}

      <View style={[styles.column, { width: panelWidth }]}>
        {/* Topo */}
        {returnLabel && onReturn ? (
          <Pressable
            onPress={onReturn}
            accessibilityRole="button"
            accessibilityLabel={returnLabel}
            style={({ pressed }) => [styles.returnBar, pressed && { opacity: 0.85 }]}
          >
            <Icon name="prev" size={18} color={colors.onRed} strokeWidth={2.6} />
            <Text style={styles.returnText} numberOfLines={1}>
              {returnLabel}
            </Text>
            <Text style={styles.returnHint} numberOfLines={1}>
              Análise desta partida
            </Text>
          </Pressable>
        ) : null}
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
          {/* Balão do professor / feedback do lance: em cima do tabuleiro */}
          <View style={[styles.feedback, coachMode && styles.feedbackCoach]}>
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
                <Text style={{ color: colors.brandText }}>
                  {displayEval.result === '½-½' ? 'Empate' : `Xeque-mate · ${displayEval.result}`}
                </Text>
              </Text>
            ) : coachMode && lastPly && lastCls && coachExplanation ? (
              <CoachBubble
                explanation={coachExplanation.ex}
                kind={lastCls.kind}
                bestLineSan={coachExplanation.bestLineSan}
                replySan={coachExplanation.replySan}
                evalAfter={coachExplanation.evalAfter}
                onShowBest={() => playLine(index - 1, coachExplanation.ex.bestLine)}
                onShowReply={() => playLine(index, coachExplanation.ex.reply)}
              />
            ) : coachMode && index === 0 ? (
              <View style={styles.feedbackRow}>
                <CoachAvatar coachId={aiCfg.coachId} size={46} />
                <Text style={styles.feedbackText} numberOfLines={3}>
                  Vamos rever a partida lance a lance. Avance com a seta: eu explico cada lance importante.
                </Text>
              </View>
            ) : lastPly && lastCls ? (
              <View style={styles.feedbackRow}>
                <MoveBadge kind={lastCls.kind} size={24} />
                <Text style={styles.feedbackText} numberOfLines={2}>
                  {lastPly.san} <Text style={{ color: lastCls.color }}>{lastCls.label.toLowerCase()}</Text>
                  {bookName ? (
                    <Text style={styles.feedbackMuted}> · {bookName}</Text>
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

          <PlayerBar {...topPlayer} showAccuracy={showAccuracy} fen={currentFen} pieceSet={prefs.pieceSet} />

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

          <PlayerBar {...bottomPlayer} showAccuracy={showAccuracy} fen={currentFen} pieceSet={prefs.pieceSet} />

          <View style={styles.moves}>
            <MoveList
              sans={sans}
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
        coachInput={coachInput}
        defaultStudent={flipped ? 'b' : 'w'}
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
  fen,
  pieceSet,
}: {
  name: string;
  elo?: string;
  acc: number | null;
  color: 'w' | 'b';
  showAccuracy: boolean;
  fen: string;
  pieceSet: string;
}) {
  return (
    <View style={styles.playerBar}>
      <View style={[styles.playerSwatch, color === 'w' ? styles.swatchWhite : styles.swatchBlack]} />
      <Text style={styles.playerName} numberOfLines={1}>
        {name}
        {elo ? <Text style={styles.playerElo}> ({elo})</Text> : null}
      </Text>
      <View style={{ flexShrink: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <CapturedRow fen={fen} color={color} pieceSet={pieceSet} size={14} />
      </View>
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

const styles = themed(() => StyleSheet.create({
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
  returnBar: {
    marginHorizontal: 12,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.redDark,
  },
  returnText: {
    color: colors.onRed,
    fontFamily: fonts.condensedHeavy,
    fontSize: 15,
  },
  returnHint: {
    flex: 1,
    textAlign: 'right',
    color: colors.onRed,
    opacity: 0.85,
    fontFamily: fonts.bold,
    fontSize: 12,
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
    fontSize: 17,
    letterSpacing: 1.2,
  },
  variantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: colors.mint,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  variantText: {
    color: colors.bg,
    fontFamily: fonts.condensedHeavy,
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
    borderRadius: 12,
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
    borderRadius: 14,
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
    fontFamily: 'Nunito_600SemiBold',
  },
  playerElo: {
    color: colors.textMuted,
    fontFamily: 'Nunito_600SemiBold',
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
    fontSize: 13,
  },
  boardBlock: {
    alignSelf: 'center',
  },
  feedback: {
    marginHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    marginBottom: 6,
  },
  feedbackCoach: {
    height: 86,
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
    fontFamily: 'Nunito_600SemiBold',
  },
  feedbackError: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.danger,
    fontSize: 13,
  },
  feedbackMuted: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.text,
    fontSize: 13,
  },
}));
