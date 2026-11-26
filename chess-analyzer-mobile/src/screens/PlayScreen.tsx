import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StockfishBridge, StockfishHandle, EngineStatus } from '../engine/StockfishBridge';
import { Icon, IconName } from '../components/Icon';
import { BotGame, Side, WatchSpeed } from '../components/play/BotGame';
import { BotBotSettings, BotBotSetup, TC_OPTIONS, VsBotSettings, VsBotSetup } from '../components/play/BotSetup';
import { defaultBots, TournamentSettings, TournamentSetup } from '../components/play/TournamentSetup';
import { MatchAction, TournamentView } from '../components/play/TournamentView';
import {
  Avatar,
  Card,
  FieldLabel,
  Header,
  Label,
  PrimaryButton,
  RatingPicker,
  SecondaryButton,
  Toast,
  ui,
} from '../components/play/ui';
import { colors, fonts, themed } from '../theme';
import type { AnalysisPrefs } from './AnalysisScreen';
import { createBotEngine, simulateGame } from '../bots/botEngine';
import { botName, ratingLabel } from '../bots/botPlayer';
import {
  bestOfLabel,
  createTournament,
  GameResult,
  Match,
  newMatch,
  participantOf,
  pendingGame,
  pendingGames,
  PendingGame,
  recordTournamentGame,
  roundName,
  Tournament,
} from '../play/tournament';
import { isFirebaseConfigured } from '../config/firebase';
import { ensureSignedIn, loadPlayerName, savePlayerName } from '../online/firebase';
import { normalizeCode } from '../online/gameService';
import {
  addBotPlayer,
  createOnlineTournament,
  gameKey,
  joinOnlineTournament,
  leaveLobby,
  OnlineTournamentDoc,
  openTournamentTable,
  participantsOf,
  removePlayer,
  reportResult,
  subscribeTournament,
  tournamentLink,
  writeState,
} from '../online/tournamentService';
import { copyText } from '../services/share';
import { PosterHeading, PosterRow } from '../components/poster';

export type PlayAction = 'hub' | 'bot' | 'botbot' | 'tournament';

interface PlayScreenProps {
  visible: boolean;
  prefs: AnalysisPrefs;
  /** Ação vinda do menu principal ou de um link de torneio. */
  request: { action: PlayAction; code?: string; nonce: number } | null;
  onOpenMenu: () => void;
  onOpenFriend: () => void;
  /** Abre uma sala online (mesa de torneio). */
  /** Abre uma mesa online (`watch` = só assistir). */
  onOpenOnlineGame: (code: string, watch?: boolean) => void;
  onAnalyze: (pgn: string, orientation: 'white' | 'black') => void;
  /** Barra de navegação: some durante as partidas; aba ativa conforme a área. */
  onNavChange?: (state: { visible: boolean; tab: 'play' | 'tournament'; root: boolean }) => void;
}

interface GameLaunch {
  key: number;
  sides: [Side, Side];
  match: Match;
  mode: 'series' | 'single';
  tc: { minutes: number; increment: number } | null;
  speed: WatchSpeed;
  title: string;
  back: Route;
  onSingleResult?: (result: GameResult, reason: string, pgn: string) => void;
  restart?: () => void;
}

type Route =
  | { name: 'hub' }
  | { name: 'vsbot' }
  | { name: 'botbot' }
  | { name: 'game'; launch: GameLaunch }
  | { name: 'thub' }
  | { name: 'tsetup'; online: boolean }
  | { name: 'tlocal' }
  | { name: 'tonline'; code: string };

const LOCAL_KEY = 'tournament:local:v1';
const YOU = 'you';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const tcById = (id: string) => TC_OPTIONS.find((o) => o.id === id)?.tc ?? null;

export function PlayScreen({
  visible,
  prefs,
  request,
  onOpenMenu,
  onOpenFriend,
  onOpenOnlineGame,
  onAnalyze,
  onNavChange,
}: PlayScreenProps) {
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<Route>({ name: 'hub' });
  useEffect(() => {
    const tournamentArea = ['thub', 'tsetup', 'tlocal', 'tonline'].includes(route.name);
    onNavChange?.({
      visible: route.name !== 'game',
      tab: tournamentArea ? 'tournament' : 'play',
      root: route.name === 'hub' || route.name === 'thub',
    });
  }, [route.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  // ---------- Motor dos bots (um Stockfish só para jogar) ----------
  const engineRef = useRef<StockfishHandle>(null);
  const engine = useMemo(() => createBotEngine(() => engineRef.current), []);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('loading');

  // ---------- Nome do jogador ----------
  const [name, setName] = useState('');
  useEffect(() => {
    loadPlayerName().then((n) => n && setName(n)).catch(() => {});
  }, []);
  const myName = name.trim() || 'Você';
  const onlineName = name.trim() || 'Jogador';

  // ---------- Configurações lembradas ----------
  const [vsBot, setVsBot] = useState<VsBotSettings>({ rating: 1200, color: 'random', bestOf: 1, tcId: 'none' });
  const [botBot, setBotBot] = useState<BotBotSettings>({ ratingA: 1500, ratingB: 1800, bestOf: 3, speed: 'normal' });
  const gameSeq = useRef(1);

  const launch = (l: Omit<GameLaunch, 'key'>) => setRoute({ name: 'game', launch: { ...l, key: gameSeq.current++ } });

  const startVsBot = (s: VsBotSettings) => {
    setVsBot(s);
    const color = s.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : s.color;
    const you: Side = { id: YOU, name: myName, kind: 'human' };
    const bot: Side = { id: 'bot', name: botName(Math.round(s.rating / 200)), kind: 'bot', rating: s.rating };
    const [a, b] = color === 'w' ? [you, bot] : [bot, you];
    launch({
      sides: [a, b],
      match: newMatch('vsbot', 1, a.id, b.id, s.bestOf, false),
      mode: 'series',
      tc: tcById(s.tcId),
      speed: 'normal',
      title: s.bestOf > 1 ? `${bestOfLabel(s.bestOf).toUpperCase()} · BOT ${s.rating}` : `BOT ${s.rating}`,
      back: { name: 'vsbot' },
      restart: () => startVsBot({ ...s, color: color === 'w' ? 'b' : 'w' }),
    });
  };

  const startBotBot = (s: BotBotSettings) => {
    setBotBot(s);
    const a: Side = { id: 'botA', name: `${botName(Math.round(s.ratingA / 200))}`, kind: 'bot', rating: s.ratingA };
    let bName = botName(Math.round(s.ratingB / 200) + 3);
    if (bName === a.name) bName = botName(Math.round(s.ratingB / 200) + 5);
    const b: Side = { id: 'botB', name: bName, kind: 'bot', rating: s.ratingB };
    launch({
      sides: [a, b],
      match: newMatch('botbot', 1, a.id, b.id, s.bestOf, false),
      mode: 'series',
      tc: null,
      speed: s.speed,
      title: `${s.ratingA} X ${s.ratingB}`,
      back: { name: 'botbot' },
      restart: () => startBotBot(s),
    });
  };

  // ---------- Torneio local ----------
  const [localT, setLocalT] = useState<{ t: Tournament; tcId: string } | null>(null);
  const localRef = useRef(localT);
  localRef.current = localT;
  useEffect(() => {
    AsyncStorage.getItem(LOCAL_KEY)
      .then((raw) => raw && setLocalT(JSON.parse(raw)))
      .catch(() => {});
  }, []);
  const saveLocal = useCallback((v: { t: Tournament; tcId: string } | null) => {
    localRef.current = v;
    setLocalT(v);
    if (v) AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(v)).catch(() => {});
    else AsyncStorage.removeItem(LOCAL_KEY).catch(() => {});
  }, []);

  const recordLocal = useCallback(
    (matchId: string, gameIndex: number, result: GameResult, extra: { reason?: string; pgn?: string }) => {
      const cur = localRef.current;
      if (!cur) return;
      saveLocal({ ...cur, t: recordTournamentGame(cur.t, matchId, gameIndex, result, extra) });
    },
    [saveLocal]
  );

  const createLocal = (s: TournamentSettings) => {
    if (s.youPlay && s.yourName.trim()) {
      setName(s.yourName.trim());
      savePlayerName(s.yourName.trim()).catch(() => {});
    }
    const participants = [
      ...(s.youPlay ? [{ id: YOU, name: s.yourName.trim() || myName, kind: 'human' as const, rating: 1500 }] : []),
      ...s.bots.map((b, i) => ({ id: `b${i + 1}`, name: b.name, kind: 'bot' as const, rating: b.rating })),
    ];
    saveLocal({ t: createTournament(s.name.trim() || 'Torneio', participants, s.format, s.bestOf), tcId: s.tcId });
    setRoute({ name: 'tlocal' });
  };

  // Simulação dos jogos bot x bot (local e anfitrião online)
  const [sim, setSim] = useState<{ matchId: string; plies: number } | null>(null);
  const simStop = useRef(false);
  const simRunning = useRef(false);

  const simulateLocal = async () => {
    if (simRunning.current) return;
    simRunning.current = true;
    simStop.current = false;
    try {
      for (;;) {
        const cur = localRef.current;
        if (!cur || simStop.current) break;
        const next = pendingGames(cur.t).find(
          (p) => participantOf(cur.t, p.white)?.kind === 'bot' && participantOf(cur.t, p.black)?.kind === 'bot'
        );
        if (!next) break;
        const w = participantOf(cur.t, next.white)!;
        const b = participantOf(cur.t, next.black)!;
        setSim({ matchId: next.matchId, plies: 0 });
        const res = await simulateGame(
          engine,
          { name: w.name, rating: w.rating ?? 1500 },
          { name: b.name, rating: b.rating ?? 1500 },
          {
            event: `${cur.t.name} · ${roundName(cur.t, cur.t.current)}`,
            isCancelled: () => simStop.current,
            onPly: (plies) => setSim({ matchId: next.matchId, plies }),
          }
        );
        if (!res) break;
        recordLocal(next.matchId, next.gameIndex, res.result, { reason: res.reason, pgn: res.pgn });
      }
    } finally {
      simRunning.current = false;
      setSim(null);
    }
  };
  const stopSim = () => {
    simStop.current = true;
  };

  const sideOf = (t: Tournament, id: string): Side => {
    const p = participantOf(t, id)!;
    return { id: p.id, name: p.name, kind: p.kind, rating: p.rating };
  };

  const playLocalGame = (p: PendingGame, watch: boolean) => {
    const cur = localRef.current;
    if (!cur) return;
    const m = cur.t.rounds[cur.t.current].find((x) => x.id === p.matchId)!;
    launch({
      sides: [sideOf(cur.t, m.a), sideOf(cur.t, m.b!)],
      match: m,
      mode: 'single',
      tc: watch ? null : tcById(cur.tcId),
      speed: 'normal',
      title: `${roundName(cur.t, cur.t.current).toUpperCase()}${m.bestOf > 1 ? ` · JOGO ${p.gameIndex + 1}` : ''}`,
      back: { name: 'tlocal' },
      onSingleResult: (result, reason, pgn) => recordLocal(p.matchId, p.gameIndex, result, { reason, pgn }),
    });
  };

  const localAction = (m: Match): MatchAction | null => {
    const cur = localRef.current;
    if (!cur) return null;
    const p = pendingGame(m);
    if (!p || !m.b) return null;
    const pg: PendingGame = { matchId: m.id, gameIndex: p.index, white: p.game.white, black: p.game.black, tiebreak: false };
    if (m.a === YOU || m.b === YOU) {
      return { kind: 'button', label: m.bestOf > 1 ? `JOGAR · JOGO ${p.index + 1}` : 'JOGAR', icon: 'play', highlight: true, onPress: () => playLocalGame(pg, false) };
    }
    if (sim?.matchId === m.id) return { kind: 'text', text: `Simulando… lance ${Math.ceil(sim.plies / 2)}`, busy: true };
    return { kind: 'button', label: 'ASSISTIR', icon: 'review', onPress: () => playLocalGame(pg, true) };
  };

  // ---------- Torneio online ----------
  const [online, setOnline] = useState<OnlineTournamentDoc | null>(null);
  const [onlineLoaded, setOnlineLoaded] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const onlineCode = route.name === 'tonline' ? route.code : null;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => {
    if (!onlineCode) return;
    setOnline(null);
    setOnlineLoaded(false);
    ensureSignedIn().then(setUid).catch(() => {});
    return subscribeTournament(onlineCode, (doc) => {
      setOnline(doc);
      setOnlineLoaded(true);
    });
  }, [onlineCode]);

  const createOnline = async (s: TournamentSettings) => {
    setBusy(true);
    setError(null);
    try {
      const n = s.yourName.trim() || onlineName;
      setName(n);
      await savePlayerName(n);
      const code = await createOnlineTournament({
        name: s.name.trim() || 'Torneio online',
        hostName: n,
        hostPlays: s.youPlay,
        format: s.format,
        bestOf: s.bestOf,
        tc: tcById(s.tcId),
        bots: s.bots,
      });
      setRoute({ name: 'tonline', code });
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível criar o torneio.');
    } finally {
      setBusy(false);
    }
  };

  const joinOnline = async (raw: string) => {
    const code = normalizeCode(raw);
    if (code.length < 4) {
      setError('Digite o código do torneio.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePlayerName(onlineName);
      await joinOnlineTournament(code, onlineName);
      setRoute({ name: 'tonline', code });
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível entrar no torneio.');
    } finally {
      setBusy(false);
    }
  };

  const isHost = !!online && !!uid && online.host === uid;

  // Anfitrião: aplica os resultados enviados e simula os jogos de bot x bot
  const applying = useRef(false);
  useEffect(() => {
    if (!isHost || !online?.state || online.status !== 'running' || applying.current) return;
    let t = online.state;
    let changed = false;
    for (let guard = 0; guard < 200; guard++) {
      const p = pendingGames(t).find((g) => online.results[gameKey(g.matchId, g.gameIndex)]);
      if (!p) break;
      const r = online.results[gameKey(p.matchId, p.gameIndex)];
      t = recordTournamentGame(t, p.matchId, p.gameIndex, r.result, { reason: r.reason ?? undefined });
      changed = true;
    }
    if (changed) {
      applying.current = true;
      writeState(online.code, t)
        .catch(() => {})
        .finally(() => {
          applying.current = false;
        });
    }
  }, [isHost, online]);

  const hostSimRunning = useRef(false);
  useEffect(() => {
    if (!isHost || !online?.state || online.status !== 'running' || hostSimRunning.current) return;
    const t = online.state;
    const next = pendingGames(t).find(
      (p) =>
        participantOf(t, p.white)?.kind === 'bot' &&
        participantOf(t, p.black)?.kind === 'bot' &&
        !online.results[gameKey(p.matchId, p.gameIndex)]
    );
    if (!next) return;
    hostSimRunning.current = true;
    const w = participantOf(t, next.white)!;
    const b = participantOf(t, next.black)!;
    setSim({ matchId: next.matchId, plies: 0 });
    simulateGame(
      engine,
      { name: w.name, rating: w.rating ?? 1500 },
      { name: b.name, rating: b.rating ?? 1500 },
      {
        event: `${t.name} · ${roundName(t, t.current)}`,
        isCancelled: () => onlineRef.current?.code !== online.code,
        onPly: (plies) => setSim({ matchId: next.matchId, plies }),
      }
    )
      .then((res) => {
        if (res) return reportResult(online.code, gameKey(next.matchId, next.gameIndex), res.result, { reason: res.reason });
      })
      .catch(() => {})
      .finally(() => {
        hostSimRunning.current = false;
        setSim(null);
        // Força reavaliar (o próximo jogo pode já estar pendente)
        setOnline((d) => (d ? { ...d } : d));
      });
  }, [isHost, online, engine]);

  const startOnline = async () => {
    if (!online) return;
    const participants = participantsOf(online);
    if (participants.length < 2) {
      showToast('O torneio precisa de pelo menos 2 participantes');
      return;
    }
    setBusy(true);
    try {
      await writeState(
        online.code,
        createTournament(online.name, participants, online.settings.format, online.settings.bestOf)
      );
    } catch (e: any) {
      showToast(e?.message ?? 'Não foi possível começar');
    } finally {
      setBusy(false);
    }
  };

  const onlineAction = (m: Match): MatchAction | null => {
    const doc = onlineRef.current;
    if (!doc?.state || !uid) return null;
    const t = doc.state;
    const p = pendingGame(m);
    if (!p || !m.b) return null;
    const key = gameKey(m.id, p.index);
    if (doc.results[key]) return { kind: 'text', text: 'Resultado enviado · atualizando…', busy: true };
    const a = participantOf(t, m.a)!;
    const b = participantOf(t, m.b)!;
    const mine = a.uid === uid ? a : b.uid === uid ? b : null;
    const other = mine ? (mine === a ? b : a) : null;
    if (mine && other) {
      const myColor = p.game.white === mine.id ? 'w' : 'b';
      if (other.kind === 'bot') {
        return {
          kind: 'button',
          label: 'JOGAR CONTRA O BOT',
          icon: 'play',
          highlight: true,
          onPress: () =>
            launch({
              sides: [sideOf(t, m.a), sideOf(t, m.b!)].map((s) => (s.id === mine.id ? { ...s, kind: 'human' as const } : s)) as [Side, Side],
              match: m,
              mode: 'single',
              tc: doc.settings.tc,
              speed: 'normal',
              title: `${roundName(t, t.current).toUpperCase()}${m.bestOf > 1 ? ` · JOGO ${p.index + 1}` : ''}`,
              back: { name: 'tonline', code: doc.code },
              onSingleResult: (result, reason) => {
                reportResult(doc.code, key, result, { reason }).catch(() => showToast('Não foi possível enviar o resultado'));
              },
            }),
        };
      }
      return {
        kind: 'button',
        label: doc.links[key] ? 'ENTRAR NA MESA' : 'JOGAR (MESA ONLINE)',
        icon: 'play',
        highlight: true,
        onPress: async () => {
          try {
            const code = await openTournamentTable(doc, key, myColor, onlineName, other.name);
            onOpenOnlineGame(code);
          } catch (e: any) {
            showToast(e?.message ?? 'Não foi possível abrir a mesa');
          }
        },
      };
    }
    if (a.kind === 'bot' && b.kind === 'bot') {
      if (sim?.matchId === m.id) return { kind: 'text', text: `Simulando… lance ${Math.ceil(sim.plies / 2)}`, busy: true };
      return { kind: 'text', text: isHost ? 'Na fila de simulação' : 'Simulado no aparelho do anfitrião' };
    }
    if (a.kind === 'bot' || b.kind === 'bot') {
      const person = a.kind === 'human' ? a : b;
      return { kind: 'text', text: `${person.name} joga contra o bot no aparelho dele` };
    }
    // Mesa de outras pessoas: quem foi eliminado ou está sem partida pode assistir (e conversar)
    if (doc.links[key]) {
      return {
        kind: 'button',
        label: 'ASSISTIR AO VIVO',
        icon: 'eye',
        onPress: () => onOpenOnlineGame(doc.links[key], true),
      };
    }
    return { kind: 'text', text: 'Aguardando os jogadores' };
  };

  // ---------- Pedidos vindos do menu / links ----------
  useEffect(() => {
    if (!request) return;
    setError(null);
    if (request.action === 'bot') setRoute({ name: 'vsbot' });
    else if (request.action === 'botbot') setRoute({ name: 'botbot' });
    else if (request.action === 'tournament') {
      if (request.code) {
        setJoinInput(request.code);
        joinOnline(request.code);
      }
      setRoute({ name: 'thub' });
    } else setRoute({ name: 'hub' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  // ---------- Telas ----------
  const engineHost = (
    <StockfishBridge
      ref={engineRef}
      fen={START_FEN}
      liveEnabled={false}
      multiPv={5}
      hashMb={16}
      onEvalUpdate={() => {}}
      onStatusChange={(s) => setEngineStatus(s)}
    />
  );

  const shell = (content: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {engineHost}
      {content}
      {toast && <Toast text={toast} bottom={90 + insets.bottom} />}
    </View>
  );

  if (route.name === 'game') {
    const l = route.launch;
    return shell(
      <BotGame
        key={l.key}
        engine={engine}
        prefs={prefs}
        sides={l.sides}
        match={l.match}
        mode={l.mode}
        tc={l.tc}
        speed={l.speed}
        title={l.title}
        onExit={() => setRoute(l.back)}
        onAnalyze={onAnalyze}
        onRestart={l.restart}
        onSingleResult={l.onSingleResult}
      />
    );
  }

  if (route.name === 'vsbot') {
    return shell(<VsBotSetup pieceSet={prefs.pieceSet} initial={vsBot} onBack={() => setRoute({ name: 'hub' })} onStart={startVsBot} />);
  }
  if (route.name === 'botbot') {
    return shell(<BotBotSetup initial={botBot} onBack={() => setRoute({ name: 'hub' })} onStart={startBotBot} />);
  }

  if (route.name === 'tsetup') {
    return shell(
      <TournamentSetup
        online={route.online}
        busy={busy}
        error={error}
        initial={{
          name: route.online ? 'Torneio dos Amigos' : 'Copa Chess Analyzer',
          format: 'roundrobin',
          bestOf: 1,
          tcId: '5+0',
          youPlay: true,
          yourName: name,
          bots: route.online ? [] : defaultBots(3, 800, 400),
        }}
        onBack={() => setRoute({ name: 'thub' })}
        onCreate={(s) => (route.online ? createOnline(s) : createLocal(s))}
      />
    );
  }

  if (route.name === 'tlocal' && localT) {
    const t = localT.t;
    const botGamesPending = pendingGames(t).some(
      (p) => participantOf(t, p.white)?.kind === 'bot' && participantOf(t, p.black)?.kind === 'bot'
    );
    const myPending = pendingGames(t).some((p) => p.white === YOU || p.black === YOU);
    return shell(
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        <Header title="TORNEIO" onBack={() => setRoute({ name: 'thub' })} />
        <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
          <TournamentView
            t={t}
            youIds={[YOU]}
            matchAction={localAction}
            top={
              !t.finished && (botGamesPending || sim) ? (
                <View style={{ gap: 6 }}>
                  {sim ? (
                    <SecondaryButton icon="close" label="PARAR SIMULAÇÃO" onPress={stopSim} />
                  ) : (
                    <PrimaryButton icon="zap" label="SIMULAR JOGOS DOS BOTS" tone="mint" onPress={simulateLocal} />
                  )}
                  <Text style={ui.hint}>
                    {myPending
                      ? 'Jogue a sua partida e simule as dos bots (ou assista uma delas).'
                      : 'Os bots jogam entre si no seu aparelho; você pode assistir qualquer partida.'}
                  </Text>
                </View>
              ) : null
            }
          />
          {t.finished && (
            <PrimaryButton icon="trophy" label="NOVO TORNEIO" onPress={() => setRoute({ name: 'tsetup', online: false })} />
          )}
          <Pressable
            onPress={() => {
              stopSim();
              saveLocal(null);
              setRoute({ name: 'thub' });
            }}
            style={{ alignSelf: 'center', padding: 10 }}
          >
            <Text style={styles.dangerLink}>Encerrar e apagar este torneio</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (route.name === 'tonline') {
    if (!onlineLoaded || (online && !uid)) {
      return shell(
        <SafeAreaView style={[ui.screen, { justifyContent: 'center' }]} edges={['top', 'bottom']}>
          <Text style={ui.hint}>Carregando torneio…</Text>
        </SafeAreaView>
      );
    }
    if (!online) {
      return shell(
        <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
          <Header title="TORNEIO ONLINE" onBack={() => setRoute({ name: 'thub' })} />
          <View style={[ui.content, { marginTop: 30, alignItems: 'center' }]}>
            <Text style={styles.big}>O torneio {route.code} não existe mais</Text>
          </View>
        </SafeAreaView>
      );
    }
    const doc = online;
    const players = participantsOf(doc);
    const share = async () => {
      const link = tournamentLink(doc.code);
      const message = `Bora jogar o torneio "${doc.name}"? 🏆\n${link}\n\nOu abra o Chess Analyzer → Jogar → Torneio → código ${doc.code}`;
      try {
        await Share.share({ message });
      } catch {
        await copyText(message).catch(() => {});
        showToast('Convite copiado');
      }
    };

    if (doc.status === 'lobby') {
      return shell(
        <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
          <Header title="TORNEIO ONLINE" onBack={() => setRoute({ name: 'thub' })} />
          <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
            <View style={ui.hero}>
              <Icon name="trophy" size={36} color={colors.mint} />
              <Text style={ui.heroTitle}>{doc.name}</Text>
              <Text style={ui.heroText}>
                {doc.settings.format === 'roundrobin' ? 'Pontos corridos' : 'Mata-mata'} · {bestOfLabel(doc.settings.bestOf)}
                {doc.settings.tc ? ` · ${doc.settings.tc.minutes}+${doc.settings.tc.increment}` : ''}
              </Text>
            </View>
            <Card style={{ alignItems: 'center' }}>
              <Label>CÓDIGO DO TORNEIO</Label>
              <Text style={styles.code}>{doc.code}</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton icon="share" label="CONVIDAR" onPress={share} />
                </View>
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    icon="copy"
                    label="COPIAR CÓDIGO"
                    onPress={() => copyText(doc.code).then(() => showToast(`Código ${doc.code} copiado`))}
                  />
                </View>
              </View>
            </Card>
            <Card>
              <Label>PARTICIPANTES · {players.length}</Label>
              {players.map((p) => (
                <View key={p.id} style={styles.playerRow}>
                  <Avatar name={p.name} color="w" bot={p.kind === 'bot'} size={30} />
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.name}
                    {p.uid === doc.host ? <Text style={styles.playerTag}>  anfitrião</Text> : null}
                    {p.uid === uid ? <Text style={styles.playerTag}>  você</Text> : null}
                  </Text>
                  {p.kind === 'bot' && <Text style={styles.playerTag}>{p.rating}</Text>}
                  {isHost && p.uid !== uid && (
                    <Pressable onPress={() => removePlayer(doc.code, p.id)} accessibilityLabel={`Remover ${p.name}`} hitSlop={8}>
                      <Icon name="close" size={18} color={colors.red} />
                    </Pressable>
                  )}
                </View>
              ))}
              {isHost && <AddBotRow onAdd={(r) => addBotPlayer(doc.code, `${botName(players.length + 2)}`, r)} />}
            </Card>
            {isHost ? (
              <PrimaryButton icon="play" label="COMEÇAR TORNEIO" onPress={startOnline} busy={busy} disabled={players.length < 2} />
            ) : (
              <Text style={ui.hint}>Aguardando o anfitrião começar o torneio…</Text>
            )}
            {!isHost && uid && doc.players[uid] && (
              <Pressable
                onPress={() => leaveLobby(doc.code).then(() => setRoute({ name: 'thub' }))}
                style={{ alignSelf: 'center', padding: 10 }}
              >
                <Text style={styles.dangerLink}>Sair do torneio</Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    return shell(
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        <Header
          title="TORNEIO ONLINE"
          onBack={() => setRoute({ name: 'thub' })}
          right={<Pressable onPress={share} hitSlop={8} style={{ padding: 10 }}><Icon name="share" size={20} color={colors.text} /></Pressable>}
        />
        <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
          {doc.state ? (
            <TournamentView
              t={doc.state}
              youIds={uid ? [uid] : []}
              matchAction={onlineAction}
              top={
                isHost && !doc.state.finished ? (
                  <Text style={ui.hint}>
                    Você é o anfitrião: mantenha o torneio aberto para as rodadas andarem e os jogos dos bots serem simulados.
                  </Text>
                ) : null
              }
            />
          ) : (
            <Text style={ui.hint}>Preparando as rodadas…</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (route.name === 'thub' || route.name === 'tlocal') {
    const configured = isFirebaseConfigured();
    return shell(
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        <Header title="TORNEIO" onBack={() => setRoute({ name: 'hub' })} />
        <ScrollView style={ui.scroll} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
          <View style={ui.hero}>
            <PosterHeading>Torneios</PosterHeading>
            <Text style={ui.heroText}>Pontos corridos ou mata-mata · partida única, MD3 ou MD5.</Text>
          </View>

          {localT && (
            <HubItem
              icon="next"
              title={`Continuar: ${localT.t.name}`}
              subtitle={localT.t.finished ? 'Torneio encerrado · ver resultado' : `${roundName(localT.t, localT.t.current)} · ${localT.t.participants.length} jogadores`}
              accent
              onPress={() => setRoute({ name: 'tlocal' })}
            />
          )}
          <HubItem
            icon="bot"
            title="Torneio local"
            subtitle="Você contra bots, ou só bots"
            onPress={() => setRoute({ name: 'tsetup', online: false })}
          />
          <HubItem
            icon="users"
            title="Criar torneio online"
            subtitle={configured ? 'Convide amigos pelo código' : 'Configure o Firebase para jogar online'}
            onPress={() => configured && setRoute({ name: 'tsetup', online: true })}
          />

          {configured && (
            <Card>
              <Label>ENTRAR EM UM TORNEIO ONLINE</Label>
              <FieldLabel>Seu nome</FieldLabel>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Como os outros vão te ver"
                placeholderTextColor={colors.textMuted}
                maxLength={24}
                style={ui.input}
              />
              <FieldLabel>Código</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={joinInput}
                  onChangeText={(v) => setJoinInput(normalizeCode(v).slice(0, 6))}
                  placeholder="ABC123"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[ui.input, styles.codeInput]}
                />
                <Pressable
                  onPress={() => joinOnline(joinInput)}
                  disabled={busy || joinInput.length < 4}
                  accessibilityLabel="Entrar no torneio"
                  style={[styles.joinBtn, (busy || joinInput.length < 4) && { opacity: 0.45 }]}
                >
                  <Icon name="next" size={22} color="#fff" />
                </Pressable>
              </View>
            </Card>
          )}
          {error ? <Text style={ui.error}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Hub principal
  return shell(
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header title="JOGAR" icon="home" onBack={onOpenMenu} />
      <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
        <View style={ui.hero}>
          <PosterHeading>{'Escolha\no modo'}</PosterHeading>
          <Text style={ui.heroText}>
            Bots de 400 a 3000, séries MD3/MD5 e torneios.
            {engineStatus === 'loading' ? ' Carregando o motor…' : ''}
          </Text>
        </View>
        <HubItem icon="bot" title="Contra o bot" subtitle="Rating de 400 a 3000" onPress={() => setRoute({ name: 'vsbot' })} />
        <HubItem icon="users" title="Contra um amigo" subtitle="Sala online com link" onPress={onOpenFriend} />
        <HubItem icon="swords" title="Bot x Bot" subtitle="Assista dois bots se enfrentando" onPress={() => setRoute({ name: 'botbot' })} />
        <HubItem icon="trophy" title="Torneio" subtitle="Local, só de bots ou online" onPress={() => setRoute({ name: 'thub' })} />
      </ScrollView>
    </SafeAreaView>
  );
}

function HubItem({
  icon,
  title,
  subtitle,
  onPress,
  accent = false,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return <PosterRow title={title} subtitle={subtitle} onPress={onPress} icon={accent ? 'play' : 'next'} />;
}

function AddBotRow({ onAdd }: { onAdd: (rating: number) => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(1200);
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={styles.addBot}>
        <Icon name="plus" size={16} color={colors.mint} />
        <Text style={{ color: colors.mint, fontWeight: '700', fontSize: 13 }}>Adicionar bot</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 8, backgroundColor: colors.bg, borderRadius: 4, padding: 10 }}>
      <RatingPicker value={rating} onChange={setRating} compact />
      <Text style={[ui.hint, { marginTop: -4 }]}>{ratingLabel(rating)}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SecondaryButton icon="close" label="CANCELAR" onPress={() => setOpen(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            icon="plus"
            label="ADICIONAR"
            tone="mint"
            onPress={() => {
              onAdd(rating);
              setOpen(false);
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  hubItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  hubAccent: {
    backgroundColor: colors.mint,
  },
  hubIcon: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  hubTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  hubSub: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  code: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900' as const,
    fontSize: 42,
    letterSpacing: 8,
    paddingLeft: 8,
  },
  big: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
  },
  playerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 4,
  },
  playerName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  playerTag: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  addBot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.mint,
    borderStyle: 'dashed' as const,
    borderRadius: 4,
    paddingVertical: 10,
  },
  codeInput: {
    flex: 1,
    minWidth: 0,
    width: '100%' as const,
    letterSpacing: 6,
    fontWeight: '800' as const,
    fontSize: 20,
    textAlign: 'center' as const,
  },
  joinBtn: {
    width: 54,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  dangerLink: {
    color: colors.textDim,
    textDecorationLine: 'underline' as const,
    fontSize: 13,
  },
}));
