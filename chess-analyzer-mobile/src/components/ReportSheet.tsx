import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from './Sheet';
import { MoveBadge } from './MoveBadge';
import { Icon, IconName } from './Icon';
import { saveViewAsImage } from '../services/share';
import { CoachPanel } from './CoachPanel';
import type { CoachInput } from '../ai/coach';
import { MOVE_KINDS, MoveKind, REPORT_ORDER } from '../utils/moveClassifier';
import { colors, fonts, themed } from '../theme';

type Side = 'w' | 'b';

export interface GameReport {
  players: Record<Side, { name: string; elo?: string }>;
  accuracy: Record<Side, number | null>;
  counts: Record<Side, Record<MoveKind, number>>;
  rating: Record<Side, number | null>;
  phases: { label: string; kinds: Record<Side, MoveKind | null> }[];
  openingName: string | null;
  pending: number; // lances ainda sem classificação
}

interface ReportSheetProps {
  visible: boolean;
  report: GameReport;
  /** Fatos da partida para o professor (sem isso, o painel não aparece). */
  coachInput?: CoachInput;
  defaultStudent?: Side;
  onClose: () => void;
  onStart: () => void;
  /** Toque numa contagem: vai para os lances daquela categoria. */
  onSelectKind?: (side: Side, kind: MoveKind) => void;
  onCopyPgn?: () => void;
  onToast?: (message: string) => void;
}

export const ReportSheet: React.FC<ReportSheetProps> = ({
  visible,
  report,
  coachInput,
  defaultStudent = 'w',
  onClose,
  onStart,
  onSelectKind,
  onCopyPgn,
  onToast,
}) => {
  const captureView = useRef<React.ComponentRef<typeof View>>(null);
  const [saving, setSaving] = useState(false);

  const saveImage = async () => {
    if (!captureView.current || saving) return;
    setSaving(true);
    try {
      const how = await saveViewAsImage(captureView.current, 'relatorio-xadrez');
      if (how === 'downloaded') onToast?.('Imagem do relatório baixada');
    } catch (e: any) {
      onToast?.(`Não foi possível salvar a imagem: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  // Coluna das brancas, espaço da coluna de ícones, coluna das pretas
  const pair = (render: (side: Side) => React.ReactNode) => [
    <React.Fragment key="w">{render('w')}</React.Fragment>,
    <View key="gap" style={styles.badgeCol} />,
    <React.Fragment key="b">{render('b')}</React.Fragment>,
  ];

  const box = (side: Side, value: string) => (
    <View style={[styles.box, side === 'w' ? styles.boxWhite : styles.boxBlack]}>
      <Text style={[styles.boxText, side === 'w' ? styles.boxTextWhite : styles.boxTextBlack]}>{value}</Text>
    </View>
  );

  return (
    <Sheet visible={visible} title="Relatório da partida" onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
        {/* Tudo dentro desta view vai para a imagem exportada */}
        <View ref={captureView} collapsable={false} style={styles.capture}>
        {report.openingName && (
          <Text style={styles.opening} numberOfLines={2}>
            {report.openingName}
          </Text>
        )}

        {/* Jogadores */}
        <View style={styles.row}>
          <View style={styles.labelCol} />
          {pair((side) => (
            <View key={side} style={styles.valueCol}>
              <View style={[styles.swatch, side === 'w' ? styles.swatchWhite : styles.swatchBlack]} />
              <Text style={styles.player} numberOfLines={1}>
                {report.players[side].name}
              </Text>
              {report.players[side].elo ? <Text style={styles.elo}>{report.players[side].elo}</Text> : null}
            </View>
          ))}
        </View>

        <View style={[styles.row, styles.rowTall]}>
          <Text style={[styles.label, styles.labelStrong]}>Precisão</Text>
          {pair((side) => (
            <View key={side} style={styles.valueCol}>
              {box(side, report.accuracy[side] !== null ? report.accuracy[side]!.toFixed(1) : '—')}
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Contagem por categoria */}
        {REPORT_ORDER.map((kind) => {
          const info = MOVE_KINDS[kind];
          return (
            <View key={kind} style={styles.row}>
              <Text style={styles.label}>{info.label}</Text>
              <Count value={report.counts.w[kind]} color={info.color} onPress={() => onSelectKind?.('w', kind)} />
              <View style={styles.badgeCol}>
                <MoveBadge kind={kind} size={26} />
              </View>
              <Count value={report.counts.b[kind]} color={info.color} onPress={() => onSelectKind?.('b', kind)} />
            </View>
          );
        })}

        <View style={styles.divider} />

        <View style={[styles.row, styles.rowTall]}>
          <Text style={[styles.label, styles.labelStrong]}>Rating da partida</Text>
          {pair((side) => (
            <View key={side} style={styles.valueCol}>
              {box(side, report.rating[side] !== null ? String(report.rating[side]) : '—')}
            </View>
          ))}
        </View>

        {report.phases.map((phase) => (
          <View key={phase.label} style={styles.row}>
            <Text style={styles.label}>{phase.label}</Text>
            {pair((side) => (
              <View key={side} style={styles.valueCol}>
                {phase.kinds[side] ? (
                  <MoveBadge kind={phase.kinds[side]!} size={26} />
                ) : (
                  <Text style={styles.dash}>—</Text>
                )}
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.watermark}>
          Noxari <Text style={{ color: colors.brandText }}>Chess</Text> · Stockfish 19
        </Text>
        </View>

        <View style={styles.actions}>
          <ActionButton
            icon="import"
            label={saving ? 'SALVANDO…' : 'BAIXAR IMAGEM'}
            onPress={saveImage}
            busy={saving}
          />
          {onCopyPgn && <ActionButton icon="copy" label="COPIAR PGN" onPress={onCopyPgn} />}
        </View>

        <Text style={styles.note}>
          Toque num número para ir aos lances daquela categoria. Rating estimado a partir da precisão (não é oficial).
          {report.pending > 0 ? ` ${report.pending} lance(s) ainda sem avaliação.` : ''}
        </Text>

        <Pressable onPress={onStart} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
          <Text style={styles.primaryText}>VER LANCES</Text>
        </Pressable>

        {coachInput && <CoachPanel input={coachInput} defaultStudent={defaultStudent} pending={report.pending} />}
      </ScrollView>
    </Sheet>
  );
};

function ActionButton({
  icon,
  label,
  onPress,
  busy = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : <Icon name={icon} size={17} color={colors.text} />}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Count({ value, color, onPress }: { value: number; color: string; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.valueCol, pressed && value > 0 && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={value === 0 || !onPress}
      hitSlop={6}
      accessibilityLabel={value > 0 ? 'Ver esses lances' : undefined}
    >
      <Text style={[styles.count, { color }, value === 0 && { opacity: 0.35 }]}>{value}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  capture: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 12,
  },
  watermark: {
    color: colors.textMuted,
    fontFamily: fonts.condensedHeavy,
    fontSize: 11,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  actionText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 13,
    letterSpacing: 1,
  },
  opening: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textDim,
    fontSize: 13,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  rowTall: {
    minHeight: 56,
  },
  labelCol: {
    flex: 1.3,
  },
  label: {
    flex: 1.3,
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
  },
  labelStrong: {
    fontFamily: 'Nunito_800ExtraBold',
  },
  valueCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  badgeCol: {
    width: 40,
    alignItems: 'center',
  },
  swatch: {
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
  player: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    maxWidth: 120,
  },
  elo: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 11,
  },
  box: {
    minWidth: 84,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  boxWhite: {
    backgroundColor: '#ece8e1',
  },
  boxBlack: {
    backgroundColor: '#2e2e33',
  },
  boxText: {
    fontFamily: fonts.condensedHeavy,
    fontSize: 22,
  },
  boxTextWhite: {
    color: '#1a1a1d',
  },
  boxTextBlack: {
    color: '#f3f1ee',
  },
  count: {
    fontFamily: fonts.condensedHeavy,
    fontSize: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  dash: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 16,
  },
  note: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 10,
  },
  primary: {
    marginTop: 14,
    alignItems: 'center',
    backgroundColor: colors.red,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.redDark,
  },
  primaryText: {
    color: '#fff',
    fontFamily: fonts.condensedHeavy,
    fontSize: 16,
    letterSpacing: 1.5,
  },
}));
