import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MoveBadge } from './MoveBadge';
import { CoachAvatar } from './CoachAvatar';
import { COACHES, CoachInput } from '../ai/coach';
import { useAiConfig } from '../ai/config';
import { colors, fonts, themed } from '../theme';

type Side = 'w' | 'b';

/**
 * Professor no relatório: escolhe quem comenta a revisão lance a lance (o balão em cima do tabuleiro)
 * e lista os momentos-chave. A explicação em texto corrido saiu: a explicação acontece lance a lance.
 */
export function CoachPanel({ input }: { input: CoachInput; defaultStudent?: Side; pending?: number }) {
  const [cfg, setCfg] = useAiConfig();

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>QUEM COMENTA OS LANCES</Text>

      <View style={styles.coaches}>
        {COACHES.map((c) => {
          const on = c.id === cfg.coachId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCfg({ coachId: c.id })}
              style={[styles.coach, on && styles.coachOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <CoachAvatar coachId={c.id} size={40} />
              <Text style={[styles.coachName, on && styles.coachNameOn]} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.coachTag} numberOfLines={2}>
                {c.tagline}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {input.moments.length > 0 && (
        <>
          <Text style={[styles.kicker, { marginTop: 6 }]}>MOMENTOS-CHAVE</Text>
          <View style={styles.moments}>
            {input.moments.map((m) => (
              <View key={m.label} style={styles.moment}>
                <MoveBadge kind={m.kind} size={20} />
                <Text style={styles.momentText} numberOfLines={2}>
                  <Text style={styles.momentMove}>{m.label}</Text>
                  {`  ${m.before} → ${m.after}`}
                  {m.best ? <Text style={styles.momentBest}>{`  · melhor ${m.best}`}</Text> : null}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Text style={styles.note}>Toque em VER LANCES: o professor explica cada lance no balão em cima do tabuleiro.</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: {
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    kicker: {
      color: colors.textDim,
      fontFamily: fonts.condensed,
      fontSize: 12,
      letterSpacing: 1.8,
      marginBottom: 10,
    },
    coaches: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    coach: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      padding: 10,
      borderRadius: 16,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    coachOn: { borderColor: colors.red, backgroundColor: colors.red + '1F' },
    coachName: { color: colors.textDim, fontSize: 13, fontFamily: 'Nunito_700Bold',},
    coachNameOn: { color: colors.text },
    coachTag: { textAlign: 'center', fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 11, marginTop: 2 },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 3,
      marginBottom: 12,
    },
    segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 12 },
    segItemOn: { backgroundColor: colors.surfaceAlt },
    segText: { color: colors.textDim, fontSize: 12, fontFamily: 'Nunito_600SemiBold',},
    segTextOn: { color: colors.text },
    moments: { gap: 6, marginBottom: 12 },
    moment: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    momentText: { fontFamily: 'Nunito_600SemiBold', flex: 1, color: colors.textDim, fontSize: 13 },
    momentMove: { color: colors.text, fontFamily: 'Nunito_700Bold',},
    momentBest: { color: colors.textMuted },
    answer: {
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    answerText: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 14, lineHeight: 21 },
    source: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 11, marginTop: 8 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.text,
    },
    btnText: {
      color: colors.text,
      fontFamily: fonts.condensedHeavy,
      fontSize: 13,
      letterSpacing: 1,
    },
    note: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 11, marginTop: 8, marginBottom: 6 },
  })
);
