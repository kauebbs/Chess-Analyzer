import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chess } from 'chess.js';
import { BoardView } from '../components/BoardView';
import { Icon, IconName } from '../components/Icon';
import { MoveList } from '../components/MoveList';
import { Piece } from '../components/Piece';
import { Celebration, CelebrationEvent } from '../components/Celebration';
import { BOARD_THEMES, colors, fonts } from '../theme';
import { isFirebaseConfigured } from '../config/firebase';
import { ensureSignedIn, loadPlayerName, savePlayerName, serverNow } from '../online/firebase';
import {
  answerDraw,
  cancelWaitingGame,
  claimTimeout,
  Color,
  createGame,
  EndReason,
  inviteLink,
  joinGame,
  myColor,
  normalizeCode,
  offerDraw,
  OnlineGame,
  onlinePgn,
  playMove,
  remainingTimes,
  replay,
  requestRematch,
  resign,
  sendChat,
  seriesAfter,
  subscribeGame,
  subscribePresence,
  TIME_CONTROLS,
  trackPresence,
} from '../online/gameService';
import { copyText } from '../services/share';
import type { AnalysisPrefs } from './AnalysisScreen';
import { celebrationAllowed } from '../settings/animation';
import { reportResult } from '../online/tournamentService';
import { ChatLine, ChatSheet, UnreadDot } from '../components/play/ChatSheet';
import { playSound } from '../services/sounds';
import { PosterHeading } from '../components/poster';

interface OnlineScreenProps {
  visible: boolean;
  /** Código vindo de um link de convite. */
  joinRequest: { code: string; nonce: number } | null;
  prefs: AnalysisPrefs;
  onOpenMenu: () => void;
  onAnalyze: (pgn: string, orientation: 'white' | 'black') => void;
  /** Mesa de torneio: volta para a tela do torneio. */
  onBackToTournament?: (code: string) => void;
  /** A barra de navegação aparece só no saguão (sem sala aberta). */
  onNavVisible?: (visible: boolean) => void;
}

const REASON_TEXT: Record<EndReason, string> = {
  checkmate: 'XEQUE-MATE',
  resign: 'ABANDONO',
  timeout: 'TEMPO ESGOTADO',
  agreement: 'EMPATE COMBINADO',
  stalemate: 'AFOGAMENTO',
  repetition: 'REPETIÇÃO',
  insufficient: 'MATERIAL INSUFICIENTE',
  'fifty-moves': 'REGRA DOS 50 LANCES',
};

function formatClock(ms: number) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  if (total < 10000) return `${s}.${Math.floor((total % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function OnlineScreen({
  visible,
  joinRequest,
  prefs,
  onOpenMenu,
  onAnalyze,
  onBackToTournament,
  onNavVisible,
}: OnlineScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const configured = isFirebaseConfigured();
  const theme = BOARD_THEMES[prefs.themeIdx];

  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => onNavVisible?.(!code), [code]); // eslint-disable-line react-hooks/exhaustive-deps
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [loaded, setLoaded] = useState(false); // já recebeu a 1ª resposta da sala
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [now, setNow] = useState(serverNow());
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [resignArmed, setResignArmed] = useState(false);

  // Opções do lobby
  const [colorChoice, setColorChoice] = useState<Color | 'random'>('random');
  const [tcIdx, setTcIdx] = useState(3);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(1);
  const [joinInput, setJoinInput] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }, []);

  // Login anônimo + nome salvo
  useEffect(() => {
    if (!configured) return;
    ensureSignedIn()
      .then(setUid)
      .catch((e) => setError(`Não foi possível conectar ao Firebase: ${e?.message ?? e}`));
    loadPlayerName().then((n) => n && setName(n));
  }, [configured]);

  // Assina a sala atual (partida + presença)
  useEffect(() => {
    if (!code || !configured) return;
    setGame(null);
    setLoaded(false);
    setPending(null);
    const unsubGame = subscribeGame(code, (g) => {
      setGame(g);
      setLoaded(true);
      setPending(null);
    });
    const unsubPresence = subscribePresence(code, setPresence);
    let stopPresence: (() => void) | null = null;
    trackPresence(code).then((stop) => (stopPresence = stop)).catch(() => {});
    return () => {
      unsubGame();
      unsubPresence();
      stopPresence?.();
    };
  }, [code, configured]);

  const join = useCallback(
    async (raw: string) => {
      const c = normalizeCode(raw);
      if (c.length < 4) {
        setError('Digite o código da sala (6 letras/números).');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await savePlayerName(name);
        const color = await joinGame(c, name);
        setFlipped(false);
        setCode(c);
        showToast(color === 'w' ? 'Você joga de brancas' : 'Você joga de pretas');
      } catch (e: any) {
        setError(e?.message ?? 'Não foi possível entrar na sala.');
      } finally {
        setBusy(false);
      }
    },
    [name, showToast]
  );

  // Convite aberto por link
  useEffect(() => {
    if (!joinRequest || !configured) return;
    join(joinRequest.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinRequest?.nonce]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await savePlayerName(name);
      const c = await createGame(
        name,
        colorChoice,
        TIME_CONTROLS[tcIdx],
        bestOf > 1 ? { series: { bestOf: bestOf as 3 | 5, game: 1, score: {} } } : undefined
      );
      setFlipped(false);
      setCode(c);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível criar a partida.');
    } finally {
      setBusy(false);
    }
  };

  const leaveRoom = async () => {
    if (code && game?.status === 'waiting') await cancelWaitingGame(code).catch(() => {});
    setCode(null);
    setGame(null);
    setCelebration(null);
  };

  const shareInvite = async () => {
    if (!code) return;
    const link = inviteLink(code);
    const message = `Bora jogar xadrez? ♞\n${link}\n\nOu abra o Chess Analyzer → Jogar online → Entrar com o código ${code}`;
    try {
      const res = await Share.share({ message });
      if (res.action === Share.dismissedAction) return;
    } catch {
      await copyText(message).catch(() => {});
      showToast('Convite copiado — cole no WhatsApp');
    }
  };

  // ---------- Estado da partida ----------
  const me = game && uid ? myColor(game, uid) : null;
  const shownMoves = useMemo(() => {
    const base = game?.moves ?? '';
    return pending ? (base ? `${base} ${pending}` : pending) : base;
  }, [game?.moves, pending]);
  const chess = useMemo(() => {
    try {
      return replay(shownMoves);
    } catch {
      return new Chess();
    }
  }, [shownMoves]);
  const history = useMemo(() => chess.history({ verbose: true }), [chess]);
  const lastMove = history.length ? { from: history[history.length - 1].from, to: history[history.length - 1].to } : null;
  const turn = chess.turn();
  const playing = game?.status === 'playing';
  const myTurn = playing && me === turn && !pending;

  // Relógios
  const ticking = !!game?.clock && playing;
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(serverNow()), 200);
    return () => clearInterval(t);
  }, [ticking]);
  const times = game ? remainingTimes(game, now) : null;

  const timeoutClaimed = useRef<string | null>(null);
  useEffect(() => {
    if (!game || !times || !playing || !code) return;
    if (times[turn] <= 0 && timeoutClaimed.current !== `${code}:${game.moves}`) {
      timeoutClaimed.current = `${code}:${game.moves}`;
      claimTimeout(code).catch(() => {});
    }
  }, [times?.w, times?.b, turn, playing, code, game]);

  // Animação de fim de partida
  const celebratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!game || game.status !== 'finished' || !game.result) return;
    const key = `${game.code}:${game.result}:${game.moves.length}`;
    if (celebratedRef.current === key) return;
    celebratedRef.current = key;
    setTimeout(() => playSound('end'), game.reason === 'checkmate' ? 250 : 0);
    const id = Date.now();
    const winner: Color | null = game.result === '1-0' ? 'w' : game.result === '0-1' ? 'b' : null;
    const reason = game.reason ? REASON_TEXT[game.reason] : '';
    const winnerName = ((winner === 'w' ? game.white?.name : game.black?.name) ?? '').toUpperCase();
    let final: CelebrationEvent;
    if (!winner) final = { id: id + 1, type: 'draw', title: 'EMPATE', subtitle: `½-½ · ${reason}` };
    else if (winner === me) final = { id: id + 1, type: 'victory', winner, title: 'VOCÊ VENCEU!', subtitle: `${game.result} · ${reason}` };
    else if (me) final = { id: id + 1, type: 'victory', winner, quiet: true, title: `VITÓRIA DE ${winnerName}`, subtitle: `${game.result} · ${reason}` }; // sem confete para quem perdeu
    else final = { id: id + 1, type: 'victory', winner, title: `VITÓRIA DE ${winnerName}`, subtitle: `${game.result} · ${reason}` };

    const anim = prefs.animation;
    const showFinal = celebrationAllowed(anim, final.type);
    if (game.reason === 'checkmate' && anim.celebrateCheckmate) {
      const king = chess.board().flat().find((p) => p && p.type === 'k' && p.color === chess.turn())?.square;
      setCelebration({ id, type: 'checkmate', square: king ?? 'e1' });
      if (showFinal) setTimeout(() => setCelebration(final), 1500);
    } else if (showFinal) {
      setCelebration(final);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status, game?.result]);

  // Som de início quando a partida começa
  const startedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!game || game.status !== 'playing' || startedRef.current === game.code) return;
    startedRef.current = game.code;
    if (!game.moves) playSound('start');
  }, [game?.status, game?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aviso de pouco tempo no meu relógio (uma vez por partida)
  const lowTimeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!game || !times || !playing || !me || turn !== me) return;
    if (times[me] < 20000 && times[me] > 0 && lowTimeRef.current !== game.code) {
      lowTimeRef.current = game.code;
      playSound('lowtime');
    }
  }, [times?.w, times?.b]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bate-papo
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChat, setSeenChat] = useState<Record<string, number>>({});
  const chat = game?.chat ?? [];
  const theirCount = chat.filter((m) => m.uid !== uid).length;
  const unread = game ? Math.max(0, theirCount - (seenChat[game.code] ?? 0)) : 0;
  useEffect(() => {
    if (chatOpen && game) setSeenChat((s) => ({ ...s, [game.code]: theirCount }));
  }, [chatOpen, theirCount, game?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastChatId = useRef<string>('');
  const chatInit = useRef<string | null>(null);
  useEffect(() => {
    if (!game) return;
    const last = chat[chat.length - 1];
    // Ao abrir a sala, as mensagens antigas não geram aviso
    if (chatInit.current !== game.code) {
      chatInit.current = game.code;
      lastChatId.current = last?.id ?? '';
      return;
    }
    if (!last || last.id === lastChatId.current) return;
    lastChatId.current = last.id;
    if (last.uid === uid) return;
    playSound('chat');
    if (!chatOpen) showToast(`${last.name}: ${last.text}`);
  }, [chat.length, game?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const chatLines: ChatLine[] = chat.map((m) => ({ id: m.id, mine: m.uid === uid, name: m.name, text: m.text }));
  const chatBtn = (
    <View style={{ flex: 1 }}>
      <ActionBtn icon="chat" label="Chat" onPress={() => setChatOpen(true)} />
      <UnreadDot count={unread} />
    </View>
  );

  // Mesa de torneio: o resultado volta para o torneio (os dois jogadores enviam; vale o primeiro)
  const reportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!game?.tournament || game.status !== 'finished' || !game.result || !me) return;
    const k = `${game.code}:${game.result}`;
    if (reportedRef.current === k) return;
    reportedRef.current = k;
    reportResult(game.tournament.code, game.tournament.key, game.result, { reason: game.reason ?? undefined }).catch(() => {});
  }, [game?.status, game?.result, game?.tournament, me]);

  const onMove = useCallback(
    (from: string, to: string) => {
      if (!code || !game || !me) return;
      const test = replay(game.moves);
      if (test.turn() !== me) return;
      let mv;
      try {
        mv = test.move({ from, to, promotion: 'q' });
      } catch {
        return;
      }
      const uci = `${mv.from}${mv.to}${mv.promotion ?? ''}`;
      setPending(uci); // mostra o lance na hora; o servidor confirma em seguida
      playMove(code, uci).catch((e) => {
        setPending(null);
        showToast(`Lance não enviado: ${e?.message ?? e}`);
      });
    },
    [code, game, me, showToast]
  );

  // ---------- Layout ----------
  // Tabuleiro de ponta a ponta (múltiplo de 8); encolhe em telas baixas ou largas
  const reserved = 270 + insets.top + insets.bottom;
  const boardSize = Math.max(232, Math.floor(Math.min(width, height - reserved, 640) / 8) * 8);
  const panelWidth = Math.min(width, 640);
  const boardFlipped = (me === 'b') !== flipped;
  const opponentColor: Color = boardFlipped ? 'w' : 'b';
  const bottomColor: Color = boardFlipped ? 'b' : 'w';
  const seatOf = (c: Color) => (c === 'w' ? game?.white : game?.black);
  const isOnline = (c: Color) => {
    const seat = seatOf(c);
    return !!seat && !!presence[seat.uid];
  };

  // ---------- Telas ----------
  if (!configured) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Header title="JOGAR ONLINE" onHome={onOpenMenu} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.lobby}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Falta configurar o Firebase</Text>
            <Text style={styles.cardText}>
              O jogo online usa um projeto gratuito do Firebase como servidor. Para ativar:
            </Text>
            {[
              'Crie um projeto em console.firebase.google.com e adicione um app Web (</>).',
              'Em Authentication → Sign-in method, ative "Anônimo".',
              'Em Realtime Database, crie o banco e cole as regras de firebase/database.rules.json.',
              'Copie a configuração do app para src/config/firebase.ts.',
            ].map((step, i) => (
              <Text key={i} style={styles.cardStep}>
                {i + 1}. {step}
              </Text>
            ))}
            <Text style={styles.cardText}>O passo a passo completo está no arquivo ONLINE.md do projeto.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (code && loaded && !game) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Header title="JOGAR ONLINE" onHome={onOpenMenu} />
        <View style={[styles.lobby, { alignItems: 'center', marginTop: 40 }]}>
          <Text style={styles.cardTitle}>A sala {code} não existe mais</Text>
          <Text style={styles.hint}>Ela pode ter sido cancelada por quem criou.</Text>
          <View style={{ width: '100%', marginTop: 20 }}>
            <PrimaryButton icon="prev" label="VOLTAR" onPress={() => setCode(null)} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!code) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Header title="JOGAR ONLINE" onHome={onOpenMenu} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.lobby} keyboardShouldPersistTaps="handled">
          <View style={styles.heroPoster}>
            <PosterHeading>{'Desafie\num amigo'}</PosterHeading>
            <Text style={styles.heroPosterText}>Crie uma sala e mande o código. A partida acontece aqui no app, em tempo real.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>SEU NOME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Como o adversário vai te ver"
              placeholderTextColor={colors.textMuted}
              maxLength={24}
              style={styles.input}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>CRIAR PARTIDA</Text>
            <Text style={styles.fieldLabel}>Jogar de</Text>
            <View style={styles.segment}>
              {(['w', 'random', 'b'] as const).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColorChoice(c)}
                  style={[styles.segmentItem, colorChoice === c && styles.segmentActive]}
                >
                  {c === 'random' ? (
                    <View style={{ flexDirection: 'row' }}>
                      <Piece setId={prefs.pieceSet} color="w" type="k" size={24} />
                      <Piece setId={prefs.pieceSet} color="b" type="k" size={24} />
                    </View>
                  ) : (
                    <Piece setId={prefs.pieceSet} color={c} type="k" size={30} />
                  )}
                  <Text style={[styles.segmentText, colorChoice === c && styles.segmentTextActive]}>
                    {c === 'w' ? 'Brancas' : c === 'b' ? 'Pretas' : 'Aleatório'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Tempo</Text>
            <View style={styles.chips}>
              {TIME_CONTROLS.map((tc, i) => (
                <Pressable key={i} onPress={() => setTcIdx(i)} style={[styles.chip, tcIdx === i && styles.chipActive]}>
                  <Text style={[styles.chipText, tcIdx === i && styles.chipTextActive]}>{tc ? tc.label : 'Livre'}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Formato</Text>
            <View style={styles.chips}>
              {([1, 3, 5] as const).map((n) => (
                <Pressable key={n} onPress={() => setBestOf(n)} style={[styles.chip, bestOf === n && styles.chipActive]}>
                  <Text style={[styles.chipText, bestOf === n && styles.chipTextActive]}>{n === 1 ? 'Única' : `MD${n}`}</Text>
                </Pressable>
              ))}
            </View>

            <PrimaryButton icon="link" label="CRIAR E CONVIDAR" onPress={create} busy={busy && !joinInput} disabled={!uid} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>ENTRAR COM CÓDIGO</Text>
            <View style={styles.joinRow}>
              <TextInput
                value={joinInput}
                onChangeText={(v) => setJoinInput(normalizeCode(v).slice(0, 6))}
                placeholder="ABC123"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                onSubmitEditing={() => join(joinInput)}
                style={[styles.input, styles.codeInput]}
              />
              <Pressable
                onPress={() => join(joinInput)}
                disabled={!uid || busy || joinInput.length < 4}
                style={({ pressed }) => [
                  styles.joinBtn,
                  pressed && { opacity: 0.8 },
                  (!uid || busy || joinInput.length < 4) && { opacity: 0.45 },
                ]}
              >
                {busy && joinInput ? <ActivityIndicator color="#fff" /> : <Icon name="next" size={22} color="#fff" />}
              </Pressable>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {!uid && !error && <Text style={styles.hint}>Conectando ao servidor…</Text>}
        </ScrollView>
        {toast && <Toast text={toast} bottom={24 + insets.bottom} />}
      </SafeAreaView>
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.mint} />
      </SafeAreaView>
    );
  }

  // Sala criada esperando o adversário
  if (game.status === 'waiting') {
    const myC = me ?? 'w';
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Header title="AGUARDANDO ADVERSÁRIO" onHome={onOpenMenu} />
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.lobby, { alignItems: 'center' }]}>
          <Piece setId={prefs.pieceSet} color={myC} type="k" size={64} />
          <Text style={styles.waitText}>
            Você joga de {myC === 'w' ? 'brancas' : 'pretas'}
            {game.clock ? ` · ${game.clock.initial / 60000}+${game.clock.increment / 1000}` : ' · sem relógio'}
          </Text>
          <Text style={styles.section}>CÓDIGO DA SALA</Text>
          <Text style={styles.bigCode} selectable>
            {game.code}
          </Text>
          <View style={{ width: '100%', gap: 10, marginTop: 16 }}>
            <PrimaryButton icon="share" label="COMPARTILHAR CONVITE" onPress={shareInvite} />
            <SecondaryButton
              icon="copy"
              label="COPIAR CÓDIGO"
              onPress={async () => {
                await copyText(game.code).catch(() => {});
                showToast(`Código ${game.code} copiado`);
              }}
            />
          </View>
          <ActivityIndicator color={colors.mint} style={{ marginTop: 24 }} />
          <Text style={styles.hint}>A partida começa assim que o adversário entrar.</Text>
          <Pressable onPress={leaveRoom} hitSlop={8} style={{ marginTop: 18 }}>
            <Text style={styles.cancelLink}>Cancelar sala</Text>
          </Pressable>
        </ScrollView>
        {toast && <Toast text={toast} bottom={24 + insets.bottom} />}
      </SafeAreaView>
    );
  }

  // Partida em andamento / terminada
  const finished = game.status === 'finished';
  const opponentOffersDraw = playing && !!game.drawOffer && game.drawOffer !== me;
  const winner: Color | null = game.result === '1-0' ? 'w' : game.result === '0-1' ? 'b' : null;
  const series = seriesAfter(game);
  const seriesName = (u: string) => (game.white?.uid === u ? game.white?.name : game.black?.uid === u ? game.black?.name : '') ?? '';
  const fmtPts = (n: number) => (n % 1 === 0 ? `${n}` : n < 1 ? '½' : `${Math.floor(n)}½`);
  // Faixa só para o resultado (durante a partida, a vez aparece no relógio de cada jogador)
  const banner = (() => {
    if (!finished) return null;
    const reason = game.reason ? REASON_TEXT[game.reason] : '';
    if (series?.decided) {
      if (series.winnerUid === 'draw') return { text: 'SÉRIE EMPATADA', tone: 'neutral' as const };
      const won = series.winnerUid === uid;
      return {
        text: won ? 'VOCÊ VENCEU A SÉRIE!' : `${seriesName(series.winnerUid ?? '').toUpperCase()} VENCEU A SÉRIE`,
        tone: won ? ('good' as const) : me ? ('bad' as const) : ('neutral' as const),
      };
    }
    if (!winner) return { text: `EMPATE · ${reason}`, tone: 'neutral' as const };
    if (winner === me) return { text: `VOCÊ VENCEU · ${reason}`, tone: 'good' as const };
    if (me) return { text: `VOCÊ PERDEU · ${reason}`, tone: 'bad' as const };
    return { text: `VITÓRIA DE ${(seatOf(winner)?.name ?? '').toUpperCase()} · ${reason}`, tone: 'neutral' as const };
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.column, { width: panelWidth }]}>
        <View style={styles.topBar}>
          <IconBtn name="home" label="Menu principal" onPress={onOpenMenu} />
          <Pressable onPress={shareInvite} style={({ pressed }) => [styles.roomChip, pressed && { opacity: 0.7 }]}>
            <Text style={styles.roomLabel}>{game.tournament ? 'TORNEIO' : game.series ? `MD${game.series.bestOf} · JOGO ${game.series.game}` : 'SALA'}</Text>
            <Text style={styles.roomText}>{game.code}</Text>
            {game.clock && (
              <Text style={styles.roomLabel}>
                · {game.clock.initial / 60000}+{game.clock.increment / 1000}
              </Text>
            )}
          </Pressable>
          <IconBtn name="flip" label="Girar tabuleiro" onPress={() => setFlipped((f) => !f)} />
        </View>

        <View style={styles.middle}>
          {series && game.white && game.black && (
            <View style={styles.seriesStrip}>
              <Text style={styles.seriesName} numberOfLines={1}>
                {game.white.name}
              </Text>
              <Text style={styles.seriesScore}>
                {fmtPts(series.score[game.white.uid] ?? 0)} – {fmtPts(series.score[game.black.uid] ?? 0)}
              </Text>
              <Text style={[styles.seriesName, { textAlign: 'right' }]} numberOfLines={1}>
                {game.black.name}
              </Text>
            </View>
          )}
          <PlayerCard
            name={seatOf(opponentColor)?.name ?? '—'}
            color={opponentColor}
            isMe={me === opponentColor}
            online={isOnline(opponentColor)}
            time={times ? times[opponentColor] : null}
            active={playing && turn === opponentColor}
          />
          <View style={{ width: boardSize, height: boardSize, alignSelf: 'center' }}>
            <BoardView
              fen={chess.fen()}
              size={boardSize}
              onMove={onMove}
              lastMove={lastMove}
              flipped={boardFlipped}
              theme={theme}
              pieceSet={prefs.pieceSet}
              interactive={!!myTurn}
              animation={prefs.animation}
            />
            <Celebration
              event={visible ? celebration : null}
              size={boardSize}
              flipped={boardFlipped}
              intensity={prefs.animation.intensity}
              pieceSet={prefs.pieceSet}
              onDone={(id) => setCelebration((c) => (c?.id === id ? null : c))}
            />
          </View>
          <PlayerCard
            name={seatOf(bottomColor)?.name ?? '—'}
            color={bottomColor}
            isMe={me === bottomColor}
            online={isOnline(bottomColor)}
            time={times ? times[bottomColor] : null}
            active={playing && turn === bottomColor}
          />

          {opponentOffersDraw ? (
            <View style={[styles.banner, styles.bannerNeutral, styles.drawRow]}>
              <Text style={[styles.bannerText, { flex: 1 }]}>{(seatOf(game.drawOffer!)?.name ?? 'Adversário').toUpperCase()} OFERECEU EMPATE</Text>
              <Pressable onPress={() => answerDraw(game.code, true)} style={[styles.smallBtn, { backgroundColor: colors.mintDark }]}>
                <Text style={styles.smallBtnText}>ACEITAR</Text>
              </Pressable>
              <Pressable onPress={() => answerDraw(game.code, false)} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>RECUSAR</Text>
              </Pressable>
            </View>
          ) : banner ? (
            <View
              style={[
                styles.banner,
                banner.tone === 'good' ? styles.bannerGood : banner.tone === 'bad' ? styles.bannerBad : styles.bannerNeutral,
              ]}
            >
              <Text
                style={[styles.bannerText, banner.tone === 'good' && { color: colors.bg }]}
                numberOfLines={1}
              >
                {banner.text}
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

        <View style={styles.actions}>
          {!finished ? (
            <>
              <ActionBtn
                icon="flag"
                label={resignArmed ? 'Confirmar' : 'Abandonar'}
                danger={resignArmed}
                disabled={!me}
                onPress={() => {
                  if (!resignArmed) {
                    setResignArmed(true);
                    showToast('Toque de novo para abandonar');
                    setTimeout(() => setResignArmed(false), 3000);
                  } else {
                    setResignArmed(false);
                    resign(game.code).catch(() => {});
                  }
                }}
              />
              <ActionBtn
                icon="equal"
                label="Empate"
                disabled={!me || !!game.drawOffer || history.length < 2}
                onPress={() => {
                  offerDraw(game.code).catch(() => {});
                  showToast('Empate oferecido');
                }}
              />
              {chatBtn}
              <ActionBtn icon="share" label="Convidar" onPress={shareInvite} />
            </>
          ) : (
            <>
              <ActionBtn
                icon="review"
                label="Analisar"
                onPress={() => onAnalyze(onlinePgn(game), me === 'b' ? 'black' : 'white')}
              />
              {game.tournament ? (
                <ActionBtn
                  icon="trophy"
                  label="Voltar ao torneio"
                  highlight
                  onPress={() => onBackToTournament?.(game.tournament!.code)}
                />
              ) : (
              <ActionBtn
                icon={series && !series.decided ? 'next' : 'reset'}
                label={
                  series && !series.decided
                    ? game.rematch
                      ? 'Ir para o próximo jogo'
                      : 'Próxima partida'
                    : series
                      ? game.rematch
                        ? 'Aceitar nova série'
                        : 'Nova série'
                      : game.rematch
                        ? 'Aceitar revanche'
                        : 'Revanche'
                }
                highlight={!!game.rematch || (!!series && !series.decided)}
                disabled={!me || !uid}
                onPress={async () => {
                  try {
                    const next = await requestRematch(game, uid!, name);
                    setFlipped(false);
                    setCelebration(null);
                    setCode(next);
                  } catch (e: any) {
                    showToast(e?.message ?? 'Não foi possível criar a revanche');
                  }
                }}
              />
              )}
              {chatBtn}
              <ActionBtn icon="users" label="Nova sala" onPress={leaveRoom} />
            </>
          )}
        </View>
      </View>
      <ChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        lines={chatLines}
        onSend={(t) => code && sendChat(code, name, t).catch(() => showToast('Não foi possível enviar'))}
        readOnlyHint={me ? null : 'Só quem está jogando pode escrever no bate-papo.'}
      />
      {toast && <Toast text={toast} bottom={96 + insets.bottom} />}
    </SafeAreaView>
  );
}

// ---------- Componentes pequenos ----------

function Header({ title, onHome }: { title: string; onHome: () => void }) {
  return (
    <View style={styles.header}>
      <IconBtn name="home" label="Menu principal" onPress={onHome} />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function PlayerCard({
  name,
  color,
  isMe,
  online,
  time,
  active,
}: {
  name: string;
  color: Color;
  isMe: boolean;
  online: boolean;
  time: number | null;
  active: boolean;
}) {
  const low = active && time !== null && time < 20000;
  return (
    <View style={styles.playerCard}>
      <View style={[styles.avatar, color === 'w' ? styles.avatarWhite : styles.avatarBlack]}>
        <Text style={[styles.avatarText, color === 'w' ? { color: colors.ink } : { color: colors.paper }]}>
          {(name.trim()[0] ?? '?').toUpperCase()}
        </Text>
        <View style={[styles.presence, { backgroundColor: online ? colors.mint : colors.textMuted }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.playerName} numberOfLines={1}>
          {name}
          {isMe ? <Text style={styles.playerYou}>  (você)</Text> : null}
        </Text>
        <Text style={[styles.playerSub, active && { color: colors.mint }]}>
          {active ? 'jogando…' : online ? 'conectado' : 'desconectado'}
        </Text>
      </View>
      {time !== null ? (
        <View style={[styles.clock, active && styles.clockActive, low && styles.clockLow]}>
          {active && <Icon name="clock" size={14} color={low ? '#fff' : colors.bg} />}
          <Text style={[styles.clockText, active && styles.clockTextActive, low && { color: '#fff' }]}>{formatClock(time)}</Text>
        </View>
      ) : (
        active && <View style={styles.turnDot} />
      )}
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
  highlight = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  highlight?: boolean;
}) {
  const tint = danger ? colors.red : highlight ? colors.mint : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionBtn, pressed && { backgroundColor: colors.surfaceAlt }, disabled && { opacity: 0.3 }]}
    >
      <Icon name={icon} size={22} color={tint} />
      <Text style={[styles.actionText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function IconBtn({
  name,
  label,
  onPress,
  disabled = false,
  active = false,
  activeColor = colors.red,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconBtn,
        active && { backgroundColor: `${activeColor}26` },
        pressed && { backgroundColor: colors.surfaceAlt },
        disabled && { opacity: 0.3 },
      ]}
    >
      <Icon name={name} size={21} color={active ? activeColor : colors.text} />
    </Pressable>
  );
}

function PrimaryButton({
  icon,
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }, (busy || disabled) && { opacity: 0.5 }]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Icon name={icon} size={18} color="#fff" />}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={18} color={colors.text} />
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function Toast({ text, bottom }: { text: string; bottom: number }) {
  return (
    <View style={[styles.toast, { bottom }]} pointerEvents="none">
      <Text style={styles.toastText}>{text}</Text>
    </View>
  );
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
  header: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 1.5,
  },
  // ----- Lobby -----
  scroll: {
    alignSelf: 'stretch',
    width: '100%',
  },
  lobby: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  heroPoster: {
    alignSelf: 'stretch',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  heroPosterText: {
    color: colors.textDim,
    fontSize: 13,
    fontStyle: 'italic',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  heroPieces: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 26,
    letterSpacing: 1,
  },
  heroText: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 16,
    gap: 10,
  },
  cardLabel: {
    color: colors.textDim,
    fontFamily: fonts.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  cardText: {
    color: colors.textDim,
    fontSize: 14,
  },
  cardStep: {
    color: colors.text,
    fontSize: 14,
  },
  section: {
    color: colors.textDim,
    fontFamily: fonts.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.8,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  segmentActive: {
    borderColor: colors.mint,
    backgroundColor: colors.surfaceAlt,
  },
  segmentText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 3,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: colors.mint,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.bg,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.red,
    borderRadius: 4,
    paddingVertical: 14,
  },
  primaryText: {
    color: '#fff',
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1.3,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.2,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    letterSpacing: 6,
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
  },
  joinBtn: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  // ----- Sala esperando -----
  waitText: {
    color: colors.textDim,
    fontSize: 14,
    marginTop: 8,
  },
  bigCode: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 46,
    letterSpacing: 8,
  },
  linkText: {
    color: colors.mint,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  cancelLink: {
    color: colors.textDim,
    textDecorationLine: 'underline',
    fontSize: 13,
  },
  // ----- Partida -----
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  roomLabel: {
    color: colors.textMuted,
    fontFamily: fonts.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  roomText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 2,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWhite: {
    backgroundColor: '#ece8e1',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  avatarBlack: {
    backgroundColor: '#2e2e33',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 18,
  },
  presence: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  playerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  playerYou: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '400',
  },
  playerSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 92,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  clockActive: {
    backgroundColor: colors.ink,
  },
  clockLow: {
    backgroundColor: colors.red,
  },
  clockText: {
    color: colors.textDim,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  clockTextActive: {
    color: colors.bg,
  },
  turnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.mint,
  },
  seriesStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 2,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  seriesName: {
    flex: 1,
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
  },
  seriesScore: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 18,
  },
  banner: {
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 40,
    justifyContent: 'center',
  },
  bannerGood: {
    backgroundColor: colors.mint,
  },
  bannerBad: {
    backgroundColor: colors.red,
  },
  bannerNeutral: {
    backgroundColor: colors.surface,
  },
  bannerText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.2,
  },
  drawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  smallBtnText: {
    color: '#fff',
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  moves: {
    height: 34,
    justifyContent: 'center',
    marginHorizontal: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
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
