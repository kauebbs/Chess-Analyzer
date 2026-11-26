import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardView } from '../BoardView';
import { EvalBar } from '../EvalBar';
import { MoveList } from '../MoveList';
import { Celebration, CelebrationEvent } from '../Celebration';
import { ActionBtn, Header, IconBtn, PlayerRow, SeriesPips, Toast, ui } from './ui';
import { BOARD_THEMES, colors, fonts, themed } from '../../theme';
import type { AnalysisPrefs } from '../../screens/AnalysisScreen';
import type { BotEngine } from '../../bots/botEngine';
import { botAcceptsDraw, botWantsDraw, drawishEndgame, ratingLabel } from '../../bots/botPlayer';
import { playSound } from '../../services/sounds';
import { botDrawLine, botEndLine, botGreeting, botReply } from '../../bots/botChat';
import { ChatLine, ChatSheet, UnreadDot } from './ChatSheet';
import { celebrationAllowed } from '../../settings/animation';
import { END_TEXT, localPgn, LocalEndReason, replayUci, ruleResult } from '../../play/gameRules';
import { bestOfLabel, GameResult, isTiebreak, Match, pendingGame, recordSeriesGame, seriesScore } from '../../play/tournament';
import type { EvalData } from '../../utils/moveClassifier';

export interface Side {
  id: string;
  name: string;
  kind: 'human' | 'bot';
  rating?: number;
}

export type WatchSpeed = 'normal' | 'fast' | 'instant';
export const SPEED_LABEL: Record<WatchSpeed, string> = { normal: 'Normal', fast: 'Rápida', instant: 'Instantânea' };
const SPEED_DELAY: Record<WatchSpeed, number> = { normal: 650, fast: 200, instant: 0 };

export interface BotGameProps {
  engine: BotEngine;
  prefs: AnalysisPrefs;
  sides: [Side, Side];
  /** Série (MD1/MD3/MD5). No modo `single` só o jogo pendente é jogado. */
  match: Match;
  mode: 'series' | 'single';
  tc: { minutes: number; increment: number } | null;
  speed?: WatchSpeed;
  title: string;
  onExit: () => void;
  onAnalyze: (pgn: string, orientation: 'white' | 'black') => void;
  /** Série terminada: começa outra igual. */
  onRestart?: () => void;
  /** Modo `single` (torneio): chamado quando o jogo acaba. */
  onSingleResult?: (result: GameResult, reason: LocalEndReason, pgn: string) => void;
}

type Status = 'playing' | 'over';

export function BotGame({
  engine,
  prefs,
  sides,
  match: initialMatch,
  mode,
  tc,
  speed: initialSpeed = 'normal',
  title,
  onExit,
  onAnalyze,
  onRestart,
  onSingleResult,
}: BotGameProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = BOARD_THEMES[prefs.themeIdx];

  const [match, setMatch] = useState<Match>(initialMatch);
  const [gameIdx, setGameIdx] = useState(() => pendingGame(initialMatch)?.index ?? 0);
  const [moves, setMoves] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [end, setEnd] = useState<{ result: GameResult; reason: LocalEndReason } | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [lastEval, setLastEval] = useState<EvalData | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<WatchSpeed>(initialSpeed);
  const [flipped, setFlipped] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [resignArmed, setResignArmed] = useState(false);
  /** Bot propôs empate para a pessoa (aceitar/recusar). */
  const [botDrawOffer, setBotDrawOffer] = useState(false);
  const lastOfferPly = useRef(-99);

  // ---------- Bate-papo com o(s) bot(s) ----------
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const chatSeq = useRef(0);
  const botReplyAt = useRef(0);
  const say = useCallback(
    (from: Side, text: string, delay = 0) => {
      setTimeout(() => {
        const line: ChatLine = { id: `c${chatSeq.current++}`, mine: from.kind === 'human', name: from.name, text };
        setChatLines((l) => [...l.slice(-80), line]);
        if (from.kind === 'bot' && sides.some((x) => x.kind === 'human')) {
          playSound('chat');
          if (!chatOpenRef.current) {
            setToast(`${from.name}: ${text}`);
            setTimeout(() => setToast((t) => (t === `${from.name}: ${text}` ? null : t)), 2600);
          }
        }
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const botSides = sides.filter((x) => x.kind === 'bot');
  const unread = Math.max(0, chatLines.filter((l) => !l.mine).length - seen);
  useEffect(() => {
    if (chatOpen) setSeen(chatLines.filter((l) => !l.mine).length);
  }, [chatOpen, chatLines]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }, []);

  const game = match.games[gameIdx];
  const sideById = (id: string) => (sides[0].id === id ? sides[0] : sides[1]);
  const white = sideById(game.white);
  const black = sideById(game.black);
  const human = sides.find((s) => s.kind === 'human') ?? null;
  const watching = !human;

  const chess = useMemo(() => replayUci(moves), [moves]);
  const fen = chess.fen();
  const history = useMemo(() => chess.history({ verbose: true }), [chess]);
  const lastMove = history.length ? { from: history[history.length - 1].from, to: history[history.length - 1].to } : null;
  const turn = chess.turn();
  const turnSide = turn === 'w' ? white : black;

  // ---------- Relógio (só quando uma pessoa joga) ----------
  const clockOn = !!tc && !!human;
  const [times, setTimes] = useState<{ w: number; b: number } | null>(null);
  const turnStart = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  // O relógio corre desde o início da partida (as brancas já começam gastando tempo)
  const ticking = clockOn && status === 'playing';
  const lowTimeWarned = useRef(false);

  // Novo jogo da série: zera tudo
  const gameKey = `${match.id}:${gameIdx}`;
  useEffect(() => {
    setMoves([]);
    setStatus('playing');
    setEnd(null);
    setThinking(null);
    setLastEval(null);
    setCelebration(null);
    setTimes(clockOn && tc ? { w: tc.minutes * 60000, b: tc.minutes * 60000 } : null);
    turnStart.current = Date.now();
    setBotDrawOffer(false);
    lastOfferPly.current = -99;
    lowTimeWarned.current = false;
    playSound('start');
    botSides.forEach((b, i) => say(b, botGreeting(b.rating ?? 1500), 900 + i * 1200));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);

  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [ticking]);

  const shownTimes = times
    ? {
        w: times.w - (ticking && turn === 'w' ? Math.max(0, now - turnStart.current) : 0),
        b: times.b - (ticking && turn === 'b' ? Math.max(0, now - turnStart.current) : 0),
      }
    : null;

  // ---------- Fim de jogo ----------
  const finish = useCallback(
    (result: GameResult, reason: LocalEndReason, finalMoves: string[]) => {
      // Congela o relógio de quem estava na vez (abandono, empate combinado, tempo)
      if (statusRef.current === 'playing' && clockOn && tc) {
        const toMove = finalMoves.length % 2 === 0 ? 'w' : 'b';
        const spent = Math.max(0, Date.now() - turnStart.current);
        setTimes((t) => (t ? { ...t, [toMove]: Math.max(0, t[toMove] - spent) } : t));
      }
      setStatus('over');
      setEnd({ result, reason });
      setThinking(null);
      setBotDrawOffer(false);
      setTimeout(() => playSound('end'), reason === 'checkmate' ? 250 : 0);
      [white, black].forEach((sd, i) => {
        if (sd.kind !== 'bot') return;
        const color = sd === white ? 'w' : 'b';
        const outcome = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (color === 'w') ? 'win' : 'loss';
        say(sd, botEndLine(outcome), 1800 + i * 900);
      });
      const pgn = localPgn(finalMoves, { event: title, white: white.name, black: black.name, result, reason });
      if (mode === 'series') {
        setMatch((m) => recordSeriesGame(m, gameIdx, result, { reason }));
      } else {
        onSingleResult?.(result, reason, pgn);
      }

      // Comemoração
      const id = Date.now();
      const winnerColor = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
      const winnerSide = winnerColor === 'w' ? white : winnerColor === 'b' ? black : null;
      const subtitle = `${result === '1/2-1/2' ? '½-½' : result} · ${END_TEXT[reason]}`;
      let final: CelebrationEvent;
      if (!winnerColor || !winnerSide) final = { id: id + 1, type: 'draw', title: 'EMPATE', subtitle };
      else if (human && winnerSide.id === human.id) final = { id: id + 1, type: 'victory', winner: winnerColor, title: 'VOCÊ VENCEU!', subtitle };
      else
        final = {
          id: id + 1,
          type: 'victory',
          winner: winnerColor,
          quiet: !!human,
          title: `VITÓRIA DE ${winnerSide.name.toUpperCase()}`,
          subtitle,
        };
      const anim = prefs.animation;
      const showFinal = celebrationAllowed(anim, final.type);
      if (reason === 'checkmate' && anim.celebrateCheckmate) {
        const c = replayUci(finalMoves);
        const king = c.board().flat().find((p) => p && p.type === 'k' && p.color === c.turn())?.square;
        setCelebration({ id, type: 'checkmate', square: king ?? 'e1' });
        if (showFinal) setTimeout(() => setCelebration(final), 1500);
      } else if (showFinal) {
        setCelebration(final);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameIdx, mode, title, white, black, human, prefs.animation, clockOn, tc]
  );

  const movesRef = useRef(moves);
  movesRef.current = moves;
  const statusRef = useRef(status);
  statusRef.current = status;

  /** Aplica um lance (de quem estiver na vez) e atualiza relógio / fim de jogo. */
  const applyMove = useCallback(
    (uci: string) => {
      if (statusRef.current !== 'playing') return;
      const current = movesRef.current;
      const c = replayUci(current);
      try {
        c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch {
        return;
      }
      const mover = current.length % 2 === 0 ? 'w' : 'b';
      const nowTs = Date.now();
      if (clockOn && tc) {
        // Calcula já: o atualizador do estado roda depois, quando turnStart já foi reiniciado
        const spent = Math.max(0, nowTs - turnStart.current);
        setTimes((t) => {
          if (!t) return t;
          const next = { ...t };
          next[mover] -= spent;
          next[mover] += tc.increment * 1000;
          return next;
        });
      }
      turnStart.current = nowTs;
      setBotDrawOffer(false); // jogar recusa o empate
      const nextMoves = [...current, uci];
      movesRef.current = nextMoves;
      setMoves(nextMoves);
      const r = ruleResult(c);
      if (r) finish(r.result, r.reason, nextMoves);
    },
    [clockOn, tc, finish]
  );

  // Tempo esgotado
  useEffect(() => {
    if (!ticking || !shownTimes) return;
    if (shownTimes[turn] <= 0) finish(turn === 'w' ? '0-1' : '1-0', 'timeout', movesRef.current);
    // Aviso de pouco tempo (uma vez por partida, no relógio da pessoa)
    const humanC = human ? (game.white === human.id ? 'w' : 'b') : null;
    if (humanC && turn === humanC && !lowTimeWarned.current && shownTimes[humanC] < 20000 && shownTimes[humanC] > 0) {
      lowTimeWarned.current = true;
      playSound('lowtime');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ---------- Vez do bot ----------
  const lostStreak = useRef({ w: 0, b: 0 });
  useEffect(() => {
    lostStreak.current = { w: 0, b: 0 };
  }, [gameKey]);

  useEffect(() => {
    if (status !== 'playing' || paused || turnSide.kind !== 'bot') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();
    const rating = turnSide.rating ?? 1500;
    setThinking(turnSide.id);
    engine.think(fen, rating, watching && speed !== 'normal').then(({ move, ev }) => {
      if (cancelled) return;
      // O bot desiste quando a posição está perdida (bots fracos jogam até o fim)
      if (ev && movesRef.current.length > 30 && rating >= 1000) {
        const sign = turn === 'w' ? 1 : -1;
        const score = ev.mate !== null ? (ev.mate * sign > 0 ? 9999 : -9999) : ev.cp * sign;
        lostStreak.current[turn] = score < -900 ? lostStreak.current[turn] + 1 : 0;
        if (lostStreak.current[turn] >= 3) {
          setLastEval(ev);
          finish(turn === 'w' ? '0-1' : '1-0', 'resign', movesRef.current);
          return;
        }
      }
      // Empate: em posições empatadas (final de torres, bispos de cores opostas…) o bot propõe
      const plies = movesRef.current.length;
      if (ev && plies - lastOfferPly.current >= 12 && botWantsDraw(fen, ev, turn, plies)) {
        lastOfferPly.current = plies;
        const opponent = turn === 'w' ? black : white;
        if (opponent.kind === 'bot') {
          // Bot x bot: o outro aceita se também não estiver melhor
          if (botAcceptsDraw(ev, turn === 'w' ? 'b' : 'w', plies, fen)) {
            say(turnSide, botDrawLine(drawishEndgame(fen)));
            say(opponent, 'Fechado. Empate! 🤝', 500);
            setLastEval(ev);
            finish('1/2-1/2', 'agreement', movesRef.current);
            return;
          }
        } else {
          setBotDrawOffer(true);
          say(turnSide, botDrawLine(drawishEndgame(fen)));
        }
      }
      const minDelay = human ? 380 + Math.random() * 420 : SPEED_DELAY[speed];
      const wait = Math.max(0, minDelay - (Date.now() - started));
      timer = setTimeout(() => {
        if (cancelled) return;
        setThinking(null);
        if (ev) setLastEval(ev);
        if (move) applyMove(move);
      }, wait);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, status, paused, gameKey, speed]);

  // ---------- Ações da pessoa ----------
  const onMove = useCallback(
    (from: string, to: string) => {
      if (statusRef.current !== 'playing' || !human) return;
      const c = replayUci(movesRef.current);
      const humanColor = game.white === human.id ? 'w' : 'b';
      if (c.turn() !== humanColor) return;
      let mv;
      try {
        mv = c.move({ from, to, promotion: 'q' });
      } catch {
        return;
      }
      applyMove(`${mv.from}${mv.to}${mv.promotion ?? ''}`);
    },
    [human, game.white, applyMove]
  );

  const humanColor = human ? (game.white === human.id ? 'w' : 'b') : null;

  const resign = () => {
    if (!human || status !== 'playing') return;
    if (!resignArmed) {
      setResignArmed(true);
      showToast('Toque de novo para abandonar');
      setTimeout(() => setResignArmed(false), 3000);
      return;
    }
    setResignArmed(false);
    finish(humanColor === 'w' ? '0-1' : '1-0', 'resign', movesRef.current);
  };

  const offerDraw = () => {
    if (!human || status !== 'playing') return;
    const botColor = humanColor === 'w' ? 'b' : 'w';
    if (botAcceptsDraw(lastEval, botColor, moves.length, fen)) finish('1/2-1/2', 'agreement', movesRef.current);
    else showToast('O bot recusou o empate');
  };

  const sendChat = (text: string) => {
    if (!human) return;
    say(human, text);
    const bot = botSides[0];
    if (!bot) return;
    // As respostas saem em fila, na ordem das mensagens
    const at = Math.max(Date.now() + 800 + Math.random() * 700, botReplyAt.current + 700);
    botReplyAt.current = at;
    say(bot, botReply(text, bot.rating ?? 1500), at - Date.now());
  };

  const chatBtn = (
    <View style={{ flex: 1 }}>
      <ActionBtn icon="chat" label="Chat" onPress={() => setChatOpen(true)} />
      <UnreadDot count={unread} />
    </View>
  );

  const nextGame = () => {
    const p = pendingGame(match);
    if (p) setGameIdx(p.index);
  };

  const pgnNow = () =>
    localPgn(moves, { event: title, white: white.name, black: black.name, result: end?.result ?? null, reason: end?.reason ?? null });

  // ---------- Layout ----------
  const bottomSide = human ?? sides[0];
  const bottomColor = game.white === bottomSide.id ? 'w' : 'b';
  const boardFlipped = (bottomColor === 'b') !== flipped;
  const topColor = boardFlipped ? 'w' : 'b';
  const botColorShown = boardFlipped ? 'b' : 'w';
  const reserved = (watching ? 300 : 280) + insets.top + insets.bottom;
  const boardSize = Math.max(232, Math.floor(Math.min(width, height - reserved, 640) / 8) * 8);
  const panelWidth = Math.min(width, 640);

  const score = seriesScore(match);
  const scoreOf = (id: string) => (id === match.a ? score.a : score.b);
  const fmt = (n: number) => (n % 1 === 0 ? `${n}` : n < 1 ? '½' : `${Math.floor(n)}½`);
  const pipsFor = (id: string) => {
    const total = Math.max(match.bestOf, match.games.length);
    return Array.from({ length: total }, (_, i) => {
      const g = match.games[i];
      if (!g?.result) return null;
      if (g.result === '1/2-1/2') return 'd' as const;
      const winner = g.result === '1-0' ? g.white : g.black;
      return winner === id ? ('w' as const) : ('l' as const);
    });
  };
  const series = match.bestOf > 1 || match.games.length > 1;

  const sideRow = (color: 'w' | 'b') => {
    const s = color === 'w' ? white : black;
    return (
      <PlayerRow
        name={s.name}
        sub={s.kind === 'bot' ? `Bot · ${s.rating} · ${ratingLabel(s.rating ?? 1500)}` : 'você'}
        color={color}
        bot={s.kind === 'bot'}
        time={shownTimes ? shownTimes[color] : null}
        active={status === 'playing' && turn === color && thinking !== s.id}
        thinking={thinking === s.id && status === 'playing'}
        score={series ? fmt(scoreOf(s.id)) : null}
        fen={fen}
        pieceSet={prefs.pieceSet}
      />
    );
  };

  const resultLine = (() => {
    if (status !== 'over' || !end) return null;
    const head = end.result === '1/2-1/2' ? 'Empate' : `Vitória de ${(end.result === '1-0' ? white : black).name}`;
    if (match.done && series) {
      const champ = match.winner === 'draw' ? 'Série empatada' : `${sideById(match.winner!).name} vence a série`;
      return `${champ} · ${fmt(score.a)}–${fmt(score.b)}`;
    }
    return `${head} · ${END_TEXT[end.reason].toLowerCase()}`;
  })();

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <View style={{ flex: 1, width: panelWidth, justifyContent: 'space-between' }}>
        <Header
          title={title}
          onBack={onExit}
          icon="prev"
          right={<IconBtn name="flip" label="Girar tabuleiro" onPress={() => setFlipped((f) => !f)} />}
        />

        {series && (
          <View style={styles.seriesStrip}>
            <Text style={styles.seriesLabel}>
              {bestOfLabel(match.bestOf).toUpperCase()} · JOGO {gameIdx + 1}
              {isTiebreak(match, gameIdx) ? ' · DESEMPATE' : ''}
            </Text>
            <View style={styles.seriesRow}>
              <Text style={styles.seriesName} numberOfLines={1}>
                {sideById(match.a).name}
              </Text>
              <SeriesPips marks={pipsFor(match.a)} />
              <Text style={styles.seriesScoreText}>
                {fmt(score.a)} – {fmt(score.b)}
              </Text>
              <SeriesPips marks={pipsFor(match.b!)} />
              <Text style={[styles.seriesName, { textAlign: 'right' }]} numberOfLines={1}>
                {sideById(match.b!).name}
              </Text>
            </View>
          </View>
        )}

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {sideRow(topColor)}
          {watching && (
            <View style={{ alignSelf: 'center' }}>
              <EvalBar evaluation={lastEval} width={boardSize} flipped={boardFlipped} smooth={prefs.animation.evalBarSmooth} />
            </View>
          )}
          <View style={{ width: boardSize, height: boardSize, alignSelf: 'center' }}>
            <BoardView
              fen={fen}
              size={boardSize}
              onMove={onMove}
              lastMove={lastMove}
              flipped={boardFlipped}
              theme={theme}
              pieceSet={prefs.pieceSet}
              interactive={!!human && status === 'playing' && turn === humanColor}
              animation={prefs.animation}
            />
            <Celebration
              event={celebration}
              size={boardSize}
              flipped={boardFlipped}
              intensity={prefs.animation.intensity}
              pieceSet={prefs.pieceSet}
              onDone={(id) => setCelebration((c) => (c?.id === id ? null : c))}
            />
          </View>
          {sideRow(botColorShown)}

          {botDrawOffer && status === 'playing' ? (
            <View style={[styles.resultBanner, styles.offerRow]}>
              <Text style={[styles.resultText, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
                O BOT PROPÔS EMPATE
              </Text>
              <Pressable
                onPress={() => finish('1/2-1/2', 'agreement', movesRef.current)}
                style={[styles.offerBtn, { backgroundColor: colors.mintDark }]}
              >
                <Text style={styles.offerBtnText}>ACEITAR</Text>
              </Pressable>
              <Pressable onPress={() => setBotDrawOffer(false)} style={styles.offerBtn}>
                <Text style={styles.offerBtnText}>RECUSAR</Text>
              </Pressable>
            </View>
          ) : null}
          {resultLine ? (
            <View style={styles.resultBanner}>
              <Text style={styles.resultText} numberOfLines={1}>
                {resultLine.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <View style={styles.moves}>
            <MoveList
              sans={history.map((m) => m.san)}
              classifications={[]}
              index={history.length}
              firstMoveNumber={1}
              blackStarts={false}
              onSelect={() => {}}
            />
          </View>
        </View>

        <View style={ui.actions}>
          {status === 'playing' ? (
            human ? (
              <>
                <ActionBtn icon="flag" label={resignArmed ? 'Confirmar' : 'Abandonar'} danger={resignArmed} onPress={resign} />
                <ActionBtn icon="equal" label="Empate" onPress={offerDraw} disabled={moves.length < 2} />
                {chatBtn}
              </>
            ) : (
              <>
                <ActionBtn
                  icon={paused ? 'play' : 'clock'}
                  label={paused ? 'Continuar' : 'Pausar'}
                  highlight={paused}
                  onPress={() => setPaused((p) => !p)}
                />
                <ActionBtn
                  icon="zap"
                  label={SPEED_LABEL[speed]}
                  onPress={() => setSpeed((s) => (s === 'normal' ? 'fast' : s === 'fast' ? 'instant' : 'normal'))}
                />
                {chatBtn}
              </>
            )
          ) : (
            <>
              <ActionBtn
                icon="review"
                label="Analisar"
                onPress={() => onAnalyze(pgnNow(), humanColor === 'b' ? 'black' : 'white')}
              />
              {mode === 'series' && !match.done ? (
                <ActionBtn icon="next" label="Próxima partida" highlight onPress={nextGame} />
              ) : mode === 'series' && onRestart ? (
                <ActionBtn icon="reset" label={series ? 'Nova série' : 'Revanche'} highlight onPress={onRestart} />
              ) : null}
              {chatBtn}
              <ActionBtn icon={mode === 'single' ? 'trophy' : 'home'} label={mode === 'single' ? 'Voltar ao torneio' : 'Sair'} onPress={onExit} />
            </>
          )}
        </View>
      </View>
      <ChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        lines={chatLines}
        onSend={sendChat}
        readOnlyHint={human ? null : 'Você está assistindo: os bots conversam entre si.'}
      />
      {toast && <Toast text={toast} bottom={96 + insets.bottom} />}
    </SafeAreaView>
  );
}

const styles = themed(() => ({
  seriesStrip: {
    marginHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  seriesLabel: {
    color: colors.textMuted,
    fontFamily: fonts.condensed,
    fontWeight: '800' as const,
    fontSize: 11,
    letterSpacing: 1.6,
    textAlign: 'center' as const,
  },
  seriesRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  seriesName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  seriesScoreText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900' as const,
    fontSize: 18,
    minWidth: 54,
    textAlign: 'center' as const,
  },
  resultBanner: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  resultText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800' as const,
    fontSize: 13,
    letterSpacing: 1.2,
    textAlign: 'center' as const,
  },
  offerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 6,
  },
  offerBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  offerBtnText: {
    color: colors.text,
    fontWeight: '800' as const,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  moves: {
    height: 34,
    justifyContent: 'center' as const,
    marginHorizontal: 12,
    marginTop: 4,
  },
}));
