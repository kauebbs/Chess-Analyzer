import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CapturedRow } from '../Captured';
import { Icon, IconName } from '../Icon';
import { colors, fonts, themed } from '../../theme';
import { clampRating, ratingLabel, RATING_PRESETS } from '../../bots/botPlayer';

/** Peças de interface usadas nas telas de jogo (bot, séries, torneios). */

export function formatClock(ms: number) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  if (total < 10000) return `${s}.${Math.floor((total % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Header({
  title,
  onBack,
  icon = 'prev',
  right,
}: {
  title: string;
  onBack: () => void;
  icon?: IconName;
  right?: React.ReactNode;
}) {
  return (
    <View style={ui.header}>
      <IconBtn name={icon} label="Voltar" onPress={onBack} />
      <Text style={ui.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function IconBtn({
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
        ui.iconBtn,
        active && { backgroundColor: `${activeColor}26` },
        pressed && { backgroundColor: colors.surfaceAlt },
        disabled && { opacity: 0.3 },
      ]}
    >
      <Icon name={name} size={21} color={active ? activeColor : colors.text} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export const Label = ({ children }: { children: React.ReactNode }) => <Text style={ui.cardLabel}>{children}</Text>;
export const FieldLabel = ({ children }: { children: React.ReactNode }) => <Text style={ui.fieldLabel}>{children}</Text>;

export function PrimaryButton({
  icon,
  label,
  onPress,
  busy = false,
  disabled = false,
  tone = 'red',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: 'red' | 'mint';
}) {
  const fg = tone === 'mint' ? colors.bg : colors.onRed;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        ui.primary,
        tone === 'mint' && { backgroundColor: colors.mint, borderColor: colors.mint },
        pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 2, marginBottom: 3 },
        (busy || disabled) && { opacity: 0.5 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Icon name={icon} size={18} color={fg} />}
      <Text style={[ui.primaryText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [ui.secondary, pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2, marginBottom: 2 }, disabled && { opacity: 0.4 }]}
    >
      <Icon name={icon} size={18} color={colors.text} />
      <Text style={ui.secondaryText}>{label}</Text>
    </Pressable>
  );
}

/** Botões iguais lado a lado (ex.: Partida única · MD3 · MD5). */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={ui.chips}>
      {options.map((o) => (
        <Pressable
          key={String(o.id)}
          onPress={() => onChange(o.id)}
          accessibilityLabel={o.label}
          style={[ui.chip, value === o.id && ui.chipActive]}
        >
          <Text style={[ui.chipText, value === o.id && ui.chipTextActive]} numberOfLines={1}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Seletor de rating do bot: número grande com − / + e atalhos. */
export function RatingPicker({ value, onChange, compact = false }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={ui.ratingRow}>
        <Pressable
          onPress={() => onChange(clampRating(value - 100))}
          accessibilityLabel="Diminuir rating"
          style={({ pressed }) => [ui.stepBtn, pressed && { backgroundColor: colors.border }]}
        >
          <Icon name="minus" size={20} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[ui.ratingValue, compact && { fontSize: 30 }]}>{value}</Text>
          <Text style={ui.ratingLabel}>{ratingLabel(value).toUpperCase()}</Text>
        </View>
        <Pressable
          onPress={() => onChange(clampRating(value + 100))}
          accessibilityLabel="Aumentar rating"
          style={({ pressed }) => [ui.stepBtn, pressed && { backgroundColor: colors.border }]}
        >
          <Icon name="plus" size={20} color={colors.text} />
        </Pressable>
      </View>
      {!compact && (
        <View style={ui.presetWrap}>
          {RATING_PRESETS.map((r) => (
            <Pressable key={r} onPress={() => onChange(r)} style={[ui.preset, value === r && ui.presetActive]}>
              <Text style={[ui.presetText, value === r && ui.presetTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Avatar quadrado: inicial do nome (pessoa) ou ícone de bot. */
export function Avatar({ name, color, bot, size = 36 }: { name: string; color: 'w' | 'b'; bot?: boolean; size?: number }) {
  const fg = color === 'w' ? '#141414' : '#ece6da'; // cores reais das peças, iguais nos dois temas
  return (
    <View
      style={[
        ui.avatar,
        { width: size, height: size, borderRadius: size * 0.28 },
        color === 'w' ? ui.avatarWhite : ui.avatarBlack,
      ]}
    >
      {bot ? (
        <Icon name="bot" size={size * 0.56} color={fg} />
      ) : (
        <Text style={[ui.avatarText, { color: fg, fontSize: size * 0.5 }]}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
      )}
    </View>
  );
}

export function PlayerRow({
  name,
  sub,
  color,
  bot,
  time,
  active,
  thinking,
  score,
  fen,
  pieceSet = 'staunty',
}: {
  name: string;
  sub?: string;
  /** Posição atual: mostra as peças capturadas e a vantagem material. */
  fen?: string;
  pieceSet?: string;
  color: 'w' | 'b';
  bot?: boolean;
  time: number | null;
  active: boolean;
  thinking?: boolean;
  score?: string | null;
}) {
  const low = active && time !== null && time < 20000;
  return (
    <View style={ui.playerRow}>
      <Avatar name={name} color={color} bot={bot} />
      <View style={{ flex: 1 }}>
        <Text style={ui.playerName} numberOfLines={1}>
          {name}
          {sub ? <Text style={ui.playerSubInline}>{`  ${sub}`}</Text> : null}
        </Text>
        <View style={ui.playerLine2}>
          {thinking ? (
            <Text style={[ui.playerSub, { color: colors.mint }]} numberOfLines={1}>
              pensando…
            </Text>
          ) : fen ? (
            <CapturedRow fen={fen} color={color} pieceSet={pieceSet} />
          ) : null}
        </View>
      </View>
      {score ? <Text style={ui.seriesScore}>{score}</Text> : null}
      {time !== null ? (
        <View style={[ui.clock, active && ui.clockActive, low && ui.clockLow]}>
          {active && <Icon name="clock" size={14} color={low ? '#fff' : colors.bg} />}
          <Text style={[ui.clockText, active && ui.clockTextActive, low && { color: '#fff' }]}>{formatClock(time)}</Text>
        </View>
      ) : (
        active && <View style={ui.turnDot} />
      )}
    </View>
  );
}

export function ActionBtn({
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
      style={({ pressed }) => [ui.actionBtn, pressed && { backgroundColor: colors.surfaceAlt }, disabled && { opacity: 0.3 }]}
    >
      <Icon name={icon} size={22} color={tint} />
      <Text style={[ui.actionText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Toast({ text, bottom }: { text: string; bottom: number }) {
  return (
    <View style={[ui.toast, { bottom }]} pointerEvents="none">
      <Text style={ui.toastText}>{text}</Text>
    </View>
  );
}

/** Bolinhas com o resultado de cada jogo da série (V/E/D do ponto de vista de um jogador). */
export function SeriesPips({ marks }: { marks: ('w' | 'd' | 'l' | null)[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {marks.map((m, i) => (
        <View
          key={i}
          style={[
            ui.pip,
            m === 'w' && { backgroundColor: colors.mint, borderColor: colors.mint },
            m === 'l' && { backgroundColor: colors.red, borderColor: colors.red },
            m === 'd' && { backgroundColor: colors.textDim, borderColor: colors.textDim },
          ]}
        />
      ))}
    </View>
  );
}

export const ui = themed(() => StyleSheet.create({
  playerSubInline: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
  },
  playerLine2: {
    minHeight: 17,
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  scroll: {
    alignSelf: 'stretch',
    width: '100%',
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 6,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 26,
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardLabel: {
    color: colors.brandText,
    fontFamily: fonts.condensedHeavy,
    fontSize: 12,
    letterSpacing: 1.4,
  },
  fieldLabel: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    fontFamily: 'Nunito_700Bold',
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.red,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.redDark,
    paddingVertical: 13,
  },
  primaryText: {
    fontFamily: fonts.condensedHeavy,
    fontSize: 16,
    letterSpacing: 1,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 15,
    letterSpacing: 0.8,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.red + '26',
    borderColor: colors.red,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
  },
  chipTextActive: {
    color: colors.brandText,
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
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
  },
  segmentActive: {
    borderColor: colors.red,
    backgroundColor: colors.red + '26',
  },
  segmentText: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
  },
  segmentTextActive: {
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 40,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  ratingLabel: {
    color: colors.brandText,
    fontFamily: fonts.condensed,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetActive: {
    backgroundColor: colors.red,
    borderColor: colors.redDark,
  },
  presetText: {
    color: colors.textDim,
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
  },
  presetTextActive: {
    color: '#fff',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWhite: {
    backgroundColor: '#ece8e1',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarBlack: {
    backgroundColor: '#2e2e33',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    fontFamily: fonts.condensedHeavy,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  playerName: {
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
  },
  playerSub: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  seriesScore: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 20,
    marginRight: 4,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 92,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  clockActive: {
    backgroundColor: colors.ink,
  },
  clockLow: {
    backgroundColor: colors.danger,
  },
  clockText: {
    color: colors.textDim,
    fontFamily: fonts.condensedHeavy,
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
    borderRadius: 12,
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  toastText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.paper,
    fontSize: 13,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  error: {
    fontFamily: 'Nunito_700Bold',
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
}));
