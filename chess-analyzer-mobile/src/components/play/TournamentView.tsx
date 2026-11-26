import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon, IconName } from '../Icon';
import { Avatar, Card, SeriesPips } from './ui';
import { colors, fonts, themed } from '../../theme';
import {
  bestOfLabel,
  formatLabel,
  Match,
  participantOf,
  pendingGame,
  roundName,
  seriesScore,
  standings,
  totalRounds,
  Tournament,
} from '../../play/tournament';

export type MatchAction =
  | { kind: 'button'; label: string; icon: IconName; onPress: () => void; highlight?: boolean }
  | { kind: 'text'; text: string; busy?: boolean };

interface TournamentViewProps {
  t: Tournament;
  /** Ids que são "você" (destacados na tabela). */
  youIds: string[];
  matchAction: (m: Match) => MatchAction | null;
  /** Conteúdo extra acima das abas (ex.: botão de simular). */
  top?: React.ReactNode;
}

const fmt = (n: number) => (n % 1 === 0 ? `${n}` : n < 1 ? '½' : `${Math.floor(n)}½`);

export function TournamentView({ t, youIds, matchAction, top }: TournamentViewProps) {
  const [tab, setTab] = useState<'round' | 'table'>('round');
  const [roundIdx, setRoundIdx] = useState(t.current);
  useEffect(() => setRoundIdx(t.current), [t.current]);
  const champion = participantOf(t, t.championId);
  const isYou = (id: string | null | undefined) => !!id && youIds.includes(id);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.headerCard}>
        <Text style={styles.tName} numberOfLines={1}>
          {t.name}
        </Text>
        <Text style={styles.tMeta}>
          {formatLabel(t.format).toUpperCase()} · {bestOfLabel(t.bestOf).toUpperCase()} · {t.participants.length} JOGADORES
        </Text>
        {!t.finished && (
          <Text style={styles.tRound}>
            {roundName(t, t.current)} {t.format === 'roundrobin' ? `de ${totalRounds(t)}` : ''}
          </Text>
        )}
      </View>

      {t.finished && champion && (
        <View style={styles.champion}>
          <Icon name="trophy" size={34} color={colors.bg} />
          <Text style={styles.champLabel}>CAMPEÃO</Text>
          <Text style={styles.champName} numberOfLines={1}>
            {champion.name}
            {isYou(champion.id) ? ' (você)' : ''}
          </Text>
          {champion.kind === 'bot' && <Text style={styles.champSub}>Bot · {champion.rating}</Text>}
        </View>
      )}

      {top}

      <View style={styles.tabs}>
        {(
          [
            ['round', 'RODADAS'],
            ['table', t.format === 'roundrobin' ? 'CLASSIFICAÇÃO' : 'CHAVE'],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'round' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {t.rounds.map((_, i) => (
              <Pressable key={i} onPress={() => setRoundIdx(i)} style={[styles.roundChip, roundIdx === i && styles.roundChipActive]}>
                <Text style={[styles.roundChipText, roundIdx === i && styles.roundChipTextActive]}>{roundName(t, i)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {(t.rounds[roundIdx] ?? []).map((m) => (
            <MatchCard key={m.id} t={t} m={m} isYou={isYou} action={roundIdx === t.current ? matchAction(m) : null} />
          ))}
        </>
      ) : t.format === 'roundrobin' ? (
        <StandingsTable t={t} isYou={isYou} />
      ) : (
        <Bracket t={t} isYou={isYou} />
      )}
    </View>
  );
}

function MatchCard({
  t,
  m,
  isYou,
  action,
}: {
  t: Tournament;
  m: Match;
  isYou: (id: string | null | undefined) => boolean;
  action: MatchAction | null;
}) {
  const a = participantOf(t, m.a)!;
  const b = participantOf(t, m.b);
  const s = seriesScore(m);
  const marks = (id: string) =>
    Array.from({ length: Math.max(m.bestOf, m.games.length) }, (_, i) => {
      const g = m.games[i];
      if (!g?.result) return null;
      if (g.result === '1/2-1/2') return 'd' as const;
      return (g.result === '1-0' ? g.white : g.black) === id ? ('w' as const) : ('l' as const);
    });
  const live = pendingGame(m);

  const row = (p: NonNullable<typeof b>, score: number, won: boolean) => {
    const white = live && live.game.white === p.id;
    return (
      <View style={styles.matchRow}>
        <Avatar name={p.name} color={white ? 'w' : 'b'} bot={p.kind === 'bot'} size={28} />
        <Text style={[styles.matchName, won && { color: colors.mint }, isYou(p.id) && { fontWeight: '900' }]} numberOfLines={1}>
          {p.name}
          {p.kind === 'bot' ? <Text style={styles.rating}>  {p.rating}</Text> : isYou(p.id) ? <Text style={styles.rating}>  você</Text> : null}
        </Text>
        {m.bestOf > 1 && <SeriesPips marks={marks(p.id)} />}
        <Text style={[styles.matchScore, won && { color: colors.mint }]}>{fmt(score)}</Text>
      </View>
    );
  };

  return (
    <Card style={{ gap: 8, paddingVertical: 12 }}>
      {b ? (
        <>
          {row(a, s.a, m.done && m.winner === a.id)}
          {row(b, s.b, m.done && m.winner === b.id)}
        </>
      ) : (
        <View style={styles.matchRow}>
          <Avatar name={a.name} color="w" bot={a.kind === 'bot'} size={28} />
          <Text style={styles.matchName}>{a.name}</Text>
          <Text style={styles.bye}>FOLGA</Text>
        </View>
      )}
      {m.done && b ? (
        <Text style={styles.matchStatus}>
          {m.winner === 'draw' ? 'Empate' : `${participantOf(t, m.winner)?.name} venceu`}
          {m.games.length > m.bestOf ? ' no desempate' : ''}
        </Text>
      ) : action?.kind === 'button' ? (
        <Pressable
          onPress={action.onPress}
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.matchBtn, action.highlight && styles.matchBtnHi, pressed && { opacity: 0.85 }]}
        >
          <Icon name={action.icon} size={16} color={action.highlight ? colors.bg : colors.text} />
          <Text style={[styles.matchBtnText, action.highlight && { color: colors.bg }]}>{action.label}</Text>
        </Pressable>
      ) : action?.kind === 'text' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {action.busy && <ActivityIndicator size="small" color={colors.mint} />}
          <Text style={styles.matchStatus}>{action.text}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function StandingsTable({ t, isYou }: { t: Tournament; isYou: (id: string) => boolean }) {
  const rows = standings(t);
  return (
    <Card style={{ gap: 0, paddingHorizontal: 10 }}>
      <View style={[styles.tr, styles.trHead]}>
        <Text style={[styles.th, { width: 22 }]}>#</Text>
        <Text style={[styles.th, { flex: 1 }]}>JOGADOR</Text>
        {['J', 'V', 'E', 'D'].map((h) => (
          <Text key={h} style={[styles.th, styles.num]}>
            {h}
          </Text>
        ))}
        <Text style={[styles.th, styles.pts]}>PTS</Text>
      </View>
      {rows.map((r, i) => {
        const p = participantOf(t, r.id)!;
        return (
          <View key={r.id} style={[styles.tr, isYou(r.id) && { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.td, { width: 22, color: i === 0 ? colors.mint : colors.textDim }]}>{i + 1}</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {p.kind === 'bot' && <Icon name="bot" size={14} color={colors.textMuted} />}
              <Text style={[styles.td, { flexShrink: 1 }]} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
            {[r.played, r.wins, r.draws, r.losses].map((v, k) => (
              <Text key={k} style={[styles.td, styles.num]}>
                {v}
              </Text>
            ))}
            <Text style={[styles.td, styles.pts, { fontWeight: '900' }]}>{fmt(r.points)}</Text>
          </View>
        );
      })}
      <Text style={styles.legend}>Vitória no confronto 1 · empate ½ · desempate por pontos nos jogos</Text>
    </Card>
  );
}

function Bracket({ t, isYou }: { t: Tournament; isYou: (id: string) => boolean }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
      {t.rounds.map((round, ri) => (
        <View key={ri} style={{ width: 170, gap: 8, justifyContent: 'space-around' }}>
          <Text style={styles.bracketTitle}>{roundName(t, ri).toUpperCase()}</Text>
          {round.map((m) => {
            const s = seriesScore(m);
            const side = (id: string | null, score: number) => {
              const p = participantOf(t, id);
              const won = m.done && m.winner === id;
              return (
                <View style={[styles.bSide, won && { backgroundColor: `${colors.mint}22` }]}>
                  <Text
                    style={[styles.bName, won && { color: colors.mint }, isYou(id ?? '') && { fontWeight: '900' }]}
                    numberOfLines={1}
                  >
                    {p ? p.name : 'folga'}
                  </Text>
                  {p && m.b && <Text style={[styles.bScore, won && { color: colors.mint }]}>{fmt(score)}</Text>}
                </View>
              );
            };
            return (
              <View key={m.id} style={styles.bMatch}>
                {side(m.a, s.a)}
                <View style={{ height: 1, backgroundColor: colors.border }} />
                {side(m.b, s.b)}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = themed(() => ({
  headerCard: {
    alignItems: 'center' as const,
    gap: 2,
    paddingTop: 4,
  },
  tName: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900' as const,
    fontSize: 24,
    letterSpacing: 1,
  },
  tMeta: {
    color: colors.textMuted,
    fontFamily: fonts.condensed,
    fontWeight: '700' as const,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  tRound: {
    color: colors.mint,
    fontWeight: '700' as const,
    fontSize: 13,
    marginTop: 4,
  },
  champion: {
    alignItems: 'center' as const,
    backgroundColor: colors.mint,
    borderRadius: 4,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 2,
  },
  champLabel: {
    color: colors.bg,
    fontFamily: fonts.condensed,
    fontWeight: '900' as const,
    fontSize: 12,
    letterSpacing: 3,
    marginTop: 4,
  },
  champName: {
    color: colors.bg,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900' as const,
    fontSize: 26,
  },
  champSub: {
    color: colors.bg,
    fontSize: 12,
    opacity: 0.8,
  },
  tabs: {
    flexDirection: 'row' as const,
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderRadius: 4,
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
  },
  tabText: {
    color: colors.textDim,
    fontFamily: fonts.condensed,
    fontWeight: '700' as const,
    fontSize: 12,
    letterSpacing: 1.6,
  },
  tabTextActive: {
    color: colors.text,
  },
  roundChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
  roundChipActive: {
    backgroundColor: colors.red,
  },
  roundChipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  roundChipTextActive: {
    color: '#fff',
  },
  matchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  matchName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  rating: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  matchScore: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900' as const,
    fontSize: 18,
    minWidth: 26,
    textAlign: 'right' as const,
  },
  bye: {
    color: colors.textMuted,
    fontFamily: fonts.condensed,
    fontWeight: '800' as const,
    letterSpacing: 1.4,
    fontSize: 12,
  },
  matchStatus: {
    color: colors.textDim,
    fontSize: 12,
  },
  matchBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    paddingVertical: 9,
    marginTop: 2,
  },
  matchBtnHi: {
    backgroundColor: colors.mint,
  },
  matchBtnText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800' as const,
    fontSize: 13,
    letterSpacing: 1,
  },
  tr: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  trHead: {
    borderBottomWidth: 1,
    borderColor: colors.border,
    borderRadius: 0,
  },
  th: {
    color: colors.textMuted,
    fontFamily: fonts.condensed,
    fontWeight: '800' as const,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  td: {
    color: colors.text,
    fontSize: 14,
  },
  num: {
    width: 26,
    textAlign: 'center' as const,
  },
  pts: {
    width: 38,
    textAlign: 'right' as const,
  },
  legend: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center' as const,
  },
  bracketTitle: {
    color: colors.textDim,
    fontFamily: fonts.condensed,
    fontWeight: '800' as const,
    fontSize: 11,
    letterSpacing: 1.6,
    textAlign: 'center' as const,
  },
  bMatch: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  bSide: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  bName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  bScore: {
    color: colors.textDim,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900' as const,
    fontSize: 14,
  },
}));

