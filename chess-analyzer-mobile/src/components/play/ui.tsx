import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon, IconName } from '../Icon';
import { colors, fonts } from '../../theme';
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
  const fg = tone === 'mint' ? colors.bg : colors.paper;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        ui.primary,
        tone === 'mint' && { backgroundColor: colors.mint },
        pressed && { opacity: 0.85 },
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
      style={({ pressed }) => [ui.secondary, pressed && { opacity: 0.8 }, disabled && { opacity: 0.4 }]}
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
  const fg = color === 'w' ? colors.ink : colors.paper;
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
}: {
  name: string;
  sub?: string;
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
        </Text>
        <Text style={[ui.playerSub, (active || thinking) && { color: colors.mint }]} numberOfLines={1}>
          {thinking ? 'pensando…' : sub}
        </Text>
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

export const ui = StyleSheet.create({
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
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 1.5,
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
    fontWeight: '900',
    fontSize: 26,
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroText: {
    color: colors.textDim,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 16,
    gap: 10,
  },
  cardLabel: {
    color: colors.red,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.red,
    borderRadius: 3,
    paddingVertical: 14,
  },
  primaryText: {
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
    backgroundColor: 'transparent',
    borderRadius: 3,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  secondaryText: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.2,
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
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.bg,
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
    borderRadius: 3,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  segmentActive: {
    borderColor: colors.ink,
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 46,
    height: 46,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 40,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  ratingLabel: {
    color: colors.red,
    fontFamily: fonts.condensed,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 2,
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  presetActive: {
    backgroundColor: colors.red,
  },
  presetText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  playerSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  seriesScore: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
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
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: 3,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: {
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
    color: colors.red,
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
