import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CoachAvatar } from './CoachAvatar';
import { MoveBadge } from './MoveBadge';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { COACHES } from '../ai/coach';
import { useAiConfig } from '../ai/config';
import { speak, stopSpeaking } from '../ai/voice';
import { MOVE_KINDS, MoveKind } from '../utils/moveClassifier';
import type { MoveExplanation } from '../utils/moveExplainer';
import { colors, fonts, themed } from '../theme';

interface Props {
  explanation: MoveExplanation;
  kind: MoveKind;
  /** Linha do melhor lance em SAN ("8... Rb8 9. Qa4 Rxb2") e resposta do adversário. */
  bestLineSan: string | null;
  replySan: string | null;
  /** Avaliação depois do lance, do ponto de vista de quem jogou. */
  evalAfter: string | null;
  onShowBest?: () => void;
  onShowReply?: () => void;
}

const BAD: MoveKind[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];

/**
 * O professor comentando o lance atual, no estilo da Revisão do Chess.com: rosto + balão.
 * O texto vem do explicador (motivos tirados do tabuleiro); com a IA local, o professor reescreve no jeito dele.
 * Toque no balão: abre a explicação completa, com as linhas e os botões para ver no tabuleiro.
 */
export function CoachBubble({ explanation, kind, bestLineSan, replySan, evalAfter, onShowBest, onShowReply }: Props) {
  const [cfg, setCfg] = useAiConfig();
  const coach = COACHES.find((c) => c.id === cfg.coachId) ?? COACHES[0];
  const [open, setOpen] = useState(false);
  const info = MOVE_KINDS[kind];
  const factual = explanation.reasons.join(' ');

  // O texto vem só do explicador (fatos do Stockfish). A reescrita pela IA pequena saía confusa e às vezes
  // errada, então ficou de fora: a IA só dá voz ao comentário.
  const key = `${explanation.headline}|${coach.id}`;
  const text = factual;

  // Fala o comentário (espera a pessoa parar de passar lances; se a IA reescrever, fala a versão nova)
  useEffect(() => {
    const t = setTimeout(() => speak(`${explanation.headline}. ${text}`, coach.id), 700);
    return () => clearTimeout(t);
  }, [text, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), []);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${coach.name}: ${explanation.headline}. ${text}. Toque para ver mais.`}
      >
        <CoachAvatar coachId={coach.id} size={46} />
        <View style={styles.bubble}>
          <View style={styles.tail} />
          <View style={styles.head}>
            <MoveBadge kind={kind} size={18} />
            <Text style={[styles.headline, { color: info.color }]} numberOfLines={1}>
              {explanation.headline}
            </Text>
            {evalAfter ? <Text style={styles.eval}>{evalAfter}</Text> : null}
          </View>
          <Text style={styles.text} numberOfLines={2}>
            {text}
          </Text>
        </View>
      </Pressable>

      <Sheet visible={open} title={coach.name} onClose={() => setOpen(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHead}>
            <CoachAvatar coachId={coach.id} size={64} />
            <View style={{ flex: 1 }}>
              <View style={styles.head}>
                <MoveBadge kind={kind} size={22} />
                <Text style={[styles.sheetTitle, { color: info.color }]}>{explanation.headline}</Text>
              </View>
              {evalAfter ? <Text style={styles.sheetEval}>Avaliação depois do lance: {evalAfter}</Text> : null}
            </View>
          </View>


          <Text style={styles.section}>POR QUÊ</Text>
          {explanation.reasons.map((r, i) => (
            <View key={i} style={styles.reason}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.reasonText}>{r}</Text>
            </View>
          ))}

          {replySan && BAD.includes(kind) ? (
            <>
              <Text style={styles.section}>O QUE O ADVERSÁRIO FAZ</Text>
              <Text style={styles.line}>{replySan}</Text>
            </>
          ) : null}
          {bestLineSan ? (
            <>
              <Text style={styles.section}>MELHOR LINHA</Text>
              <Text style={styles.line}>{bestLineSan}</Text>
            </>
          ) : null}

          <View style={styles.actions}>
            {onShowBest && bestLineSan ? (
              <ActionBtn
                label="VER MELHOR NO TABULEIRO"
                onPress={() => {
                  setOpen(false);
                  onShowBest();
                }}
              />
            ) : null}
            {onShowReply && replySan && BAD.includes(kind) ? (
              <ActionBtn
                label="VER A RESPOSTA"
                onPress={() => {
                  setOpen(false);
                  onShowReply();
                }}
              />
            ) : null}
          </View>

          <Text style={styles.section}>PROFESSOR</Text>
          <View style={styles.coaches}>
            {COACHES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCfg({ coachId: c.id })}
                style={[styles.coach, c.id === coach.id && styles.coachOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: c.id === coach.id }}
              >
                <CoachAvatar coachId={c.id} size={36} />
                <Text style={[styles.coachName, c.id === coach.id && { color: colors.text }]} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>
            Os motivos saem do tabuleiro e do Stockfish. Com a IA local ligada (Ajustes › IA), o professor reescreve a
            explicação no jeito dele.
          </Text>
        </ScrollView>
      </Sheet>
    </>
  );
}

function ActionBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]} accessibilityRole="button">
      <Icon name="play" size={13} color={colors.text} />
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bubble: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    tail: {
      position: 'absolute',
      left: -6,
      top: 20,
      width: 10,
      height: 10,
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      transform: [{ rotate: '45deg' }],
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headline: { flex: 1, fontSize: 13.5, fontFamily: 'Nunito_800ExtraBold',},
    eval: { color: colors.textMuted, fontSize: 12, fontFamily: 'Nunito_700Bold',},
    text: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 13, lineHeight: 17, marginTop: 2 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    sheetTitle: { flex: 1, fontSize: 17, fontFamily: 'Nunito_800ExtraBold',},
    sheetEval: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12, marginTop: 4 },
    sheetAi: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginTop: 6 },
    sheetMuted: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12 },
    aiBusy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    section: {
      color: colors.textDim,
      fontFamily: fonts.condensed,
      fontSize: 12,
      letterSpacing: 1.8,
      marginTop: 16,
      marginBottom: 6,
    },
    reason: { flexDirection: 'row', gap: 8, marginBottom: 6 },
    bullet: { color: colors.brandText, fontSize: 15, lineHeight: 21, fontFamily: 'Nunito_800ExtraBold',},
    reasonText: { fontFamily: 'Nunito_600SemiBold', flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
    line: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: 'Nunito_600SemiBold',},
    actions: { gap: 8, marginTop: 14 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.text,
    },
    btnText: { color: colors.text, fontFamily: fonts.condensedHeavy,  fontSize: 13, letterSpacing: 1 },
    coaches: { flexDirection: 'row', gap: 8 },
    coach: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      padding: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    coachOn: { borderColor: colors.text, backgroundColor: colors.surfaceAlt },
    coachName: { color: colors.textDim, fontSize: 12, fontFamily: 'Nunito_700Bold',},
    note: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 14, marginBottom: 8 },
  })
);
