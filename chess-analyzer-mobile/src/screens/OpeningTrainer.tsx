import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chess } from 'chess.js';
import { BoardArrow, BoardView } from '../components/BoardView';
import { Header, PrimaryButton, ui } from '../components/play/ui';
import { MascotHero, PosterHeading } from '../components/poster';
import { CoachAvatar } from '../components/CoachAvatar';
import { StockfishBridge, StockfishHandle } from '../engine/StockfishBridge';
import { fetchGames, GameSource } from '../services/gameSources';
import { useAiConfig } from '../ai/config';
import { BOARD_THEMES, colors, fonts, themed } from '../theme';
import type { AnalysisPrefs } from './AnalysisScreen';
import type { EvalData } from '../utils/moveClassifier';
import {
  buildTree,
  clearTrainer,
  DrillCard,
  grade,
  isMastered,
  loadTrainer,
  makeCards,
  nextCard,
  saveTrainer,
  TrainerData,
} from '../training/repertoire';

type Phase = 'loading' | 'setup' | 'building' | 'home' | 'drill';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PIECE_PT: Record<string, string> = { p: 'um peão', n: 'o cavalo', b: 'o bispo', r: 'a torre', q: 'a dama', k: 'o rei' };

/** Treino de aberturas no estilo Lotus, montado com as partidas da pessoa no Chess.com/Lichess. */
export function OpeningTrainer({ prefs, onClose }: { prefs: AnalysisPrefs; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const engineRef = useRef<StockfishHandle>(null);
  const [cfg] = useAiConfig();
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<TrainerData | null>(null);
  const [user, setUser] = useState('');
  const [source, setSource] = useState<GameSource>('chesscom');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Treino
  const [card, setCard] = useState<DrillCard | null>(null);
  const [answer, setAnswer] = useState<{ uci: string; ok: boolean; fen: string } | null>(null);
  const [hint, setHint] = useState(false);
  const [session, setSession] = useState({ right: 0, total: 0 });

  useEffect(() => {
    loadTrainer().then((d) => {
      if (d) {
        setData(d);
        setUser(d.user);
        setSource(d.source);
        setPhase('home');
      } else setPhase('setup');
    });
  }, []);

  const update = useCallback((d: TrainerData) => {
    setData(d);
    saveTrainer(d);
  }, []);

  // ---------- Montar o treino ----------
  const build = async () => {
    const name = user.trim();
    if (!name) return setError('Digite seu usuário.');
    setError(null);
    setPhase('building');
    setProgress(0);
    try {
      setStatus('Baixando suas partidas…');
      const games = await fetchGames(source, name);
      const { nodes, games: used, record } = buildTree(games, name, 8);
      if (!used) throw new Error(`Nenhuma partida de "${name}" encontrada.`);
      const top = nodes.slice(0, 50);
      const engine = engineRef.current;
      if (!engine) throw new Error('O motor ainda está carregando. Tente de novo em instantes.');
      // 1ª passada: as posições em que é a sua vez
      const evals = new Map<string, EvalData>();
      setStatus(`Avaliando ${top.length} posições do seu repertório…`);
      await engine.analyzePositions(top.map((n) => n.fen), { depth: 12, movetimeMs: 700 }, (i, ev) => {
        evals.set(top[i].fen, ev);
        setProgress((i + 1) / (top.length * 1.4));
      });
      // 2ª passada: depois do seu lance mais jogado, quando o motor não o listou
      const after: string[] = [];
      for (const n of top) {
        const ev = evals.get(n.fen);
        if (ev && !(ev.pvs ?? []).some((p) => p.move === n.moves[0].uci)) {
          const c = new Chess(n.fen);
          c.move({ from: n.moves[0].uci.slice(0, 2), to: n.moves[0].uci.slice(2, 4), promotion: 'q' });
          after.push(c.fen());
        }
      }
      setStatus('Conferindo os lances que você costuma jogar…');
      await engine.analyzePositions(after, { depth: 12, movetimeMs: 700 }, (i, ev) => {
        evals.set(after[i], ev);
        setProgress((top.length + (i + 1) * 0.4 * (top.length / Math.max(1, after.length))) / (top.length * 1.4));
      });
      const cards = makeCards(top, (f) => evals.get(f) ?? null, (f) => evals.get(f) ?? null);
      const d: TrainerData = { user: name, source, games: used, builtAt: Date.now(), record, cards, progress: data?.user === name ? data.progress : {} };
      update(d);
      setPhase('home');
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setPhase(data ? 'home' : 'setup');
    }
  };

  // ---------- Treinar ----------
  const startDrill = (specific?: DrillCard) => {
    if (!data) return;
    const c = specific ?? nextCard(data);
    if (!c) {
      setError('Tudo revisado por hoje! Volte amanhã para as próximas revisões.');
      return;
    }
    setError(null);
    setCard(c);
    setAnswer(null);
    setHint(false);
    setPhase('drill');
  };

  const onMove = (from: string, to: string) => {
    if (!card || answer || !data) return;
    const c = new Chess(card.fen);
    let mv;
    try {
      mv = c.move({ from, to, promotion: 'q' });
    } catch {
      return;
    }
    const uci = mv.from + mv.to + (mv.promotion ?? '');
    const ok = card.accepted.includes(uci) || card.accepted.some((a) => a.slice(0, 4) === uci.slice(0, 4));
    setAnswer({ uci, ok, fen: c.fen() });
    setSession((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    update(grade(data, card, ok && !hint));
  };

  const next = () => {
    if (!data || !card) return;
    const c = nextCard(data, Date.now(), card.key);
    if (!c) {
      setPhase('home');
      setError(`Sessão concluída: ${session.right}/${session.total} certas. Volte depois para as revisões.`);
      return;
    }
    setCard(c);
    setAnswer(null);
    setHint(false);
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const mastered = data.cards.filter((c) => isMastered(data.progress[c.key])).length;
    const due = data.cards.filter((c) => !data.progress[c.key] || data.progress[c.key].due <= Date.now()).length;
    const mistakes = data.cards.filter((c) => !c.usualOk).sort((a, b) => b.wrong - a.wrong || b.reach - a.reach);
    return { mastered, due, mistakes };
  }, [data]);

  const boardSize = Math.max(232, Math.floor(Math.min(width - 24, height - 360, 560) / 8) * 8);
  const theme = BOARD_THEMES[prefs.themeIdx];
  const arrows: BoardArrow[] = useMemo(() => {
    if (!card) return [];
    if (answer && !answer.ok) return [{ from: card.accepted[0].slice(0, 2), to: card.accepted[0].slice(2, 4), width: 9, color: '#7cbf3f', opacity: 0.9 } as BoardArrow];
    return [];
  }, [card, answer]);
  const hintText = useMemo(() => {
    if (!card) return '';
    const p = new Chess(card.fen).get(card.accepted[0].slice(0, 2) as any);
    return p ? `Dica: jogue com ${PIECE_PT[p.type]}.` : '';
  }, [card]);

  const bridge = (
    <StockfishBridge ref={engineRef} fen={START} liveEnabled={false} multiPv={3} onEvalUpdate={() => {}} />
  );

  // ---------- Telas ----------
  if (phase === 'loading') {
    return (
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        {bridge}
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.text} />
      </SafeAreaView>
    );
  }

  if (phase === 'drill' && card) {
    const lineText = formatPath(card.path);
    const lado = card.color === 'w' ? 'Brancas' : 'Pretas';
    return (
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        {bridge}
        <Header title="TREINO DE ABERTURAS" onBack={() => setPhase('home')} />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.drillTop}>
            <Text style={styles.opening} numberOfLines={1}>
              {card.opening ?? 'Sua abertura'}
            </Text>
            <Text style={styles.path} numberOfLines={2}>
              {lineText || 'Posição inicial'}
            </Text>
          </View>
          <View style={{ alignSelf: 'center', width: boardSize, height: boardSize }}>
            <BoardView
              fen={answer ? answer.fen : card.fen}
              size={boardSize}
              onMove={onMove}
              flipped={card.color === 'b'}
              theme={theme}
              pieceSet={prefs.pieceSet}
              animation={prefs.animation}
              arrows={arrows}
              interactive={!answer}
              lastMove={answer ? { from: answer.uci.slice(0, 2), to: answer.uci.slice(2, 4) } : null}
              lastMoveColor={answer ? (answer.ok ? '#7cbf3f' : '#e5242b') : null}
            />
          </View>

          <View style={styles.coachRow}>
            <CoachAvatar coachId={cfg.coachId} size={46} />
            <View style={styles.bubble}>
              {!answer ? (
                <>
                  <Text style={styles.bubbleTitle}>Sua vez ({lado}): qual é o seu lance?</Text>
                  <Text style={styles.bubbleText}>
                    {hint ? hintText : `Você chegou aqui em ${card.reach} partida${card.reach > 1 ? 's' : ''}.`}
                  </Text>
                </>
              ) : answer.ok ? (
                <>
                  <Text style={[styles.bubbleTitle, { color: '#5f9e2c' }]}>Isso! {sanOfSafe(card.fen, answer.uci)} ✓</Text>
                  <Text style={styles.bubbleText}>{card.bestWhy[0] ?? 'É o lance do seu repertório.'}</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.bubbleTitle, { color: colors.danger }]}>
                    Não é esse. O lance é {card.bestSan}
                  </Text>
                  <Text style={styles.bubbleText}>
                    {[
                      answer.uci === card.usual && card.usualWhy[0] ? `Você costuma jogar ${card.usualSan}: ${lower(card.usualWhy[0])}` : null,
                      card.bestWhy[0] ?? null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            {!answer ? (
              <Pressable onPress={() => setHint(true)} style={styles.secondary} accessibilityRole="button">
                <Text style={styles.secondaryText}>DICA</Text>
              </Pressable>
            ) : (
              <PrimaryButton icon="next" label="PRÓXIMA" onPress={next} />
            )}
            <Text style={styles.session}>
              Nesta sessão: {session.right}/{session.total} certas
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'setup' || phase === 'building') {
    return (
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        {bridge}
        <Header title="TREINO DE ABERTURAS" onBack={onClose} />
        <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
          <MascotHero
            pose="livro"
            tone="yellow"
            title={'Treine as suas\naberturas'}
            text="Eu leio suas partidas, monto seu repertório e treino lance a lance. O que você erra volta mais vezes."
            mascotHeight={96}
          />
          <Text style={ui.fieldLabel}>Site</Text>
          <View style={ui.segment}>
            {(['chesscom', 'lichess'] as GameSource[]).map((s) => (
              <Pressable key={s} onPress={() => setSource(s)} style={[ui.segmentItem, source === s && ui.segmentActive]}>
                <Text style={[ui.segmentText, source === s && ui.segmentTextActive]}>{s === 'chesscom' ? 'Chess.com' : 'Lichess'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={ui.fieldLabel}>Seu usuário</Text>
          <TextInput
            value={user}
            onChangeText={setUser}
            placeholder="ex.: kuebbs"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={ui.input}
            editable={phase !== 'building'}
          />
          {phase === 'building' ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.status}>{status}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.muted}>Leva cerca de 1 minuto. Deixe o app aberto.</Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <PrimaryButton icon="play" label="MONTAR MEU TREINO" onPress={build} />
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------- Painel ----------
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      {bridge}
      <Header title="TREINO DE ABERTURAS" onBack={onClose} />
      <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
        {data && stats && (
          <>
            <View style={ui.hero}>
              <PosterHeading>{`${stats.mastered}/${data.cards.length}\ndominadas`}</PosterHeading>
              <Text style={ui.heroText}>
                {data.games} partidas de {data.user} · de brancas {pct(data.record.w)} de aproveitamento, de pretas{' '}
                {pct(data.record.b)} · {stats.due} posição{stats.due === 1 ? '' : 'ões'} para revisar agora.
              </Text>
            </View>
            <PrimaryButton icon="play" label={stats.due ? 'TREINAR AGORA' : 'TREINAR MESMO ASSIM'} onPress={() => startDrill()} />
            {error ? <Text style={styles.note}>{error}</Text> : null}

            {stats.mistakes.length > 0 && (
              <>
                <Text style={styles.section}>ONDE VOCÊ ERRA NA ABERTURA</Text>
                {stats.mistakes.slice(0, 8).map((c) => (
                  <Pressable key={c.key} onPress={() => startDrill(c)} style={styles.mistake} accessibilityRole="button">
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mistakeTitle} numberOfLines={1}>
                        {formatPath(c.path, 3) || 'Início'} · você joga {c.usualSan}
                      </Text>
                      <Text style={styles.mistakeText} numberOfLines={2}>
                        Melhor: {c.bestSan}. {c.usualWhy[0] ?? ''}
                      </Text>
                    </View>
                    <Text style={styles.mistakeCount}>{c.wrong}x</Text>
                  </Pressable>
                ))}
              </>
            )}

            <Text style={styles.section}>REPERTÓRIO</Text>
            <Text style={styles.muted}>
              {data.cards.length} posições dos seus primeiros 8 lances · montado em {new Date(data.builtAt).toLocaleDateString('pt-BR')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable onPress={build} style={[styles.secondary, { flex: 1 }]} accessibilityRole="button">
                <Text style={styles.secondaryText}>ATUALIZAR COM PARTIDAS NOVAS</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await clearTrainer();
                  setData(null);
                  setPhase('setup');
                }}
                style={styles.secondary}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>TROCAR USUÁRIO</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const pct = (r: { games: number; score: number }) => (r.games ? `${Math.round((r.score / r.games) * 100)}%` : '—');
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
function sanOfSafe(fen: string, uci: string) {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: 'q' }).san;
  } catch {
    return uci;
  }
}
/** "1. e4 e5 2. Nf3 Nc6" (opcionalmente só os últimos lances completos). */
function formatPath(path: string[], lastMoves?: number) {
  const parts: string[] = [];
  path.forEach((san, i) => parts.push(i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san));
  if (!lastMoves) return parts.join(' ');
  const cut = Math.max(0, path.length - lastMoves * 2);
  const start = cut % 2 === 0 ? cut : cut - 1;
  const out = parts.slice(start).join(' ');
  return start > 0 ? `… ${out}` : out;
}

const styles = themed(() =>
  StyleSheet.create({
    drillTop: { paddingHorizontal: 14, paddingVertical: 8 },
    opening: { color: colors.text, fontFamily: fonts.condensedHeavy,  fontSize: 16, letterSpacing: 0.5 },
    path: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 13, marginTop: 2 },
    coachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 12 },
    bubble: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      minHeight: 64,
    },
    bubbleTitle: { color: colors.text, fontSize: 14, fontFamily: 'Nunito_800ExtraBold',},
    bubbleText: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 13, lineHeight: 18, marginTop: 3 },
    actions: { marginHorizontal: 12, marginTop: 12, gap: 8 },
    secondary: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.text,
    },
    secondaryText: { color: colors.text, fontFamily: fonts.condensedHeavy,  fontSize: 13, letterSpacing: 1, textAlign: 'center' },
    session: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12, textAlign: 'center' },
    status: { color: colors.text, fontSize: 14, fontFamily: 'Nunito_600SemiBold',},
    track: { height: 4, backgroundColor: colors.border, borderRadius: 8, marginTop: 10, overflow: 'hidden' },
    fill: { height: 4, backgroundColor: colors.red },
    muted: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12, marginTop: 8 },
    error: { fontFamily: 'Nunito_600SemiBold', color: colors.danger, fontSize: 13, marginTop: 12 },
    note: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 13, marginTop: 10 },
    section: {
      color: colors.textDim,
      fontFamily: fonts.condensed,
      fontSize: 12,
      letterSpacing: 1.8,
      marginTop: 22,
      marginBottom: 8,
    },
    mistake: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    mistakeTitle: { color: colors.text, fontSize: 14, fontFamily: 'Nunito_700Bold',},
    mistakeText: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12, marginTop: 2 },
    mistakeCount: { color: colors.danger, fontFamily: fonts.condensedHeavy,  fontSize: 18 },
  })
);
