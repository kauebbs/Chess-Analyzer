import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from './Sheet';
import { Icon, IconName } from './Icon';
import { REVIEW_PRESETS, ReviewMode } from '../engine/presets';
import { colors, fonts, themed } from '../theme';

interface AnalysisModeSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (mode: ReviewMode) => void;
  running: { mode: ReviewMode; done: number; total: number } | null;
  onCancel: () => void;
  canShowReport: boolean;
  onShowReport: () => void;
  plyCount: number;
  lastMode: ReviewMode | null;
}

export const AnalysisModeSheet: React.FC<AnalysisModeSheetProps> = ({
  visible,
  onClose,
  onPick,
  running,
  onCancel,
  canShowReport,
  onShowReport,
  plyCount,
  lastMode,
}) => (
  <Sheet visible={visible} title="Analisar partida" onClose={onClose}>
    {canShowReport && !running && (
      <Row icon="report" title="Ver relatório" subtitle="Precisão, categorias de lances e fases" onPress={onShowReport} highlight />
    )}

    {running && (
      <View style={styles.running}>
        <Text style={styles.runningText}>
          Análise {REVIEW_PRESETS[running.mode].label.toLowerCase()} em andamento · {running.done}/{running.total}
        </Text>
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}>
          <Text style={styles.cancelText}>PARAR</Text>
        </Pressable>
      </View>
    )}

    <Text style={styles.section}>TIPO DE ANÁLISE</Text>
    {(Object.keys(REVIEW_PRESETS) as ReviewMode[]).map((mode) => {
      const p = REVIEW_PRESETS[mode];
      const estimate = Math.max(1, Math.round((plyCount * p.movetimeMs) / 1000));
      return (
        <Row
          key={mode}
          icon={p.icon}
          title={`${p.label}${lastMode === mode ? ' · feita' : ''}`}
          subtitle={`${p.description} Profundidade ${p.depth}${plyCount ? ` · até ~${estimate} s` : ''}`}
          onPress={() => onPick(mode)}
          disabled={plyCount === 0}
        />
      );
    })}

    <Text style={styles.hint}>
      A análise ao vivo da posição fica na lupa, no topo da tela.
      {plyCount === 0 ? ' Jogue ou importe uma partida para analisar.' : ''}
    </Text>
  </Sheet>
);

function Row({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  highlight = false,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        highlight && styles.rowHighlight,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <View style={[styles.iconWrap, highlight && { backgroundColor: colors.red }]}>
        <Icon name={icon} size={20} color={highlight ? colors.onRed : colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Icon name="next" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  section: {
    color: colors.textDim,
    fontFamily: fonts.condensed,
    fontSize: 12,
    letterSpacing: 1.8,
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.bg,
    marginBottom: 8,
  },
  rowHighlight: {
    borderWidth: 1,
    borderColor: colors.red,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
  },
  rowSubtitle: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  running: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
  },
  runningText: {
    fontFamily: 'Nunito_600SemiBold',
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  cancel: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cancelText: {
    color: '#fff',
    fontFamily: fonts.condensedHeavy,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
}));
