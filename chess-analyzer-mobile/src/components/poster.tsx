import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { Mascot, MascotPose } from './Mascot';
import { colors, fonts, themed } from '../theme';

/**
 * Peças base da identidade Noxari Chess (o arquivo manteve o nome antigo "poster" para não mexer nos
 * imports). Princípios: volume com intenção (borda inferior mais escura = "botão de verdade"), cantos
 * bem arredondados, verde para ação, cores de apoio só para diferenciar, mascote como ilustração.
 */

export type Tone = 'green' | 'yellow' | 'blue' | 'orange' | 'brown' | 'forest';

/** Cor de fundo / borda 3D / ícone para cada tom de apoio. */
export function toneColors(tone: Tone) {
  switch (tone) {
    case 'yellow':
      return { fill: colors.yellow, edge: colors.yellowDark, fg: '#3B2A05' };
    case 'blue':
      return { fill: colors.blue, edge: colors.blueDark, fg: '#FFFFFF' };
    case 'orange':
      return { fill: colors.orange, edge: colors.orangeDark, fg: '#FFFFFF' };
    case 'brown':
      return { fill: colors.brown, edge: '#7E4A2C', fg: '#FFFFFF' };
    case 'forest':
      return { fill: colors.forest, edge: '#122219', fg: '#FFF5DF' };
    default:
      return { fill: colors.red, edge: colors.redDark, fg: colors.onRed };
  }
}

/** Mantido por compatibilidade (era a marca "+" dos cartazes): hoje é um brilho pequeno amarelo. */
export function Cross({ size = 14 }: { size?: number; color?: string; weight?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] }}>
      <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.12, backgroundColor: colors.yellow }} />
    </View>
  );
}

/** Linha de metadados: rótulo pequeno em cima, valor embaixo. */
export function MetaRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={meta.row}>
      {items.map((it) => (
        <View key={it.label} style={{ flexShrink: 1 }}>
          <Text style={meta.label} numberOfLines={1}>
            {it.label}
          </Text>
          <Text style={meta.value} numberOfLines={1}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Rótulo de seção: texto pequeno, espaçado, sem linhas. */
export function SectionLabel({ index, children }: { index?: string; children: string }) {
  return (
    <View style={sec.wrap}>
      {index ? <Text style={sec.index}>{index}</Text> : null}
      <Text style={sec.text}>{children.toUpperCase()}</Text>
    </View>
  );
}

/**
 * Item de menu: selo colorido com ícone, título e subtítulo, seta. Fica num "bloco" com volume (borda
 * inferior mais grossa) que afunda ao tocar.
 */
export function PosterRow({
  title,
  subtitle,
  onPress,
  icon = 'next',
  badge,
  tone = 'green',
}: {
  index?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: IconName;
  badge?: IconName;
  tone?: Tone;
  first?: boolean;
}) {
  const t = toneColors(tone);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {({ pressed }) => (
        <View style={[row.box, pressed && row.pressed]}>
          {badge ? (
            <View style={[row.badge, { backgroundColor: t.fill, borderColor: t.edge }]}>
              <Icon name={badge} size={22} color={t.fg} strokeWidth={2.2} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={row.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={row.sub} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Icon name={icon} size={18} color={colors.textMuted} strokeWidth={2.2} />
        </View>
      )}
    </Pressable>
  );
}

/** Título de tela: Nunito Black, em frase (não em caixa alta). */
export function PosterHeading({ children, size = 32, color }: { children: string; size?: number; color?: string }) {
  return (
    <Text
      style={{
        color: color ?? colors.text,
        fontFamily: fonts.condensedHeavy,
        fontSize: size,
        lineHeight: size * 1.12,
        letterSpacing: -0.4,
        alignSelf: 'stretch',
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Abertura das telas-menu: título + texto ao lado da mascote. `side` alterna o lado da ilustração e
 * `tone` a cor do "morro" atrás dela, para cada tela ter a sua cara.
 */
export function MascotHero({
  pose,
  title,
  text,
  side = 'right',
  tone = 'green',
  mascotHeight = 132,
}: {
  pose: MascotPose;
  title: string;
  text?: string;
  side?: 'left' | 'right';
  tone?: Tone;
  mascotHeight?: number;
}) {
  const art = (
    <View style={[hero.art, { borderColor: toneColors(tone).fill }]}>
      <Mascot pose={pose} height={mascotHeight} radius={Math.round(mascotHeight * 0.18)} />
    </View>
  );
  return (
    <View style={[hero.wrap, side === 'left' && { flexDirection: 'row-reverse' }]}>
      <View style={{ flex: 1, gap: 6 }}>
        <PosterHeading>{title}</PosterHeading>
        {text ? <Text style={hero.text}>{text}</Text> : null}
      </View>
      {art}
    </View>
  );
}

/** Botão com volume. `variant`: verde (ação), branco (secundário) ou contorno. */
export function PosterButton({
  icon,
  label,
  onPress,
  variant = 'ink',
  tone,
  style,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
  variant?: 'ink' | 'red' | 'outline';
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const solid = variant !== 'outline';
  const t = toneColors(tone ?? 'green');
  const bg = solid ? t.fill : colors.surface;
  const edge = solid ? t.edge : colors.border;
  const fg = solid ? t.fg : colors.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={style}>
      {({ pressed }) => (
        <View style={[btn.box, { backgroundColor: bg, borderColor: edge }, pressed && btn.pressed]}>
          {icon ? <Icon name={icon} size={18} color={fg} strokeWidth={2.2} /> : null}
          <Text style={[btn.text, { color: fg }]}>{label.toUpperCase()}</Text>
        </View>
      )}
    </Pressable>
  );
}

const meta = themed(() => ({
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.condensed,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  value: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
    marginTop: 1,
  },
}));

const sec = themed(() => ({
  wrap: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 8,
    marginTop: 22,
    paddingBottom: 2,
  },
  index: {
    color: colors.brandText,
    fontFamily: fonts.condensedHeavy,
    fontSize: 12,
  },
  text: {
    color: colors.textMuted,
    fontFamily: fonts.condensedHeavy,
    fontSize: 12,
    letterSpacing: 1.6,
  },
}));

const row = themed(() => ({
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
  },
  pressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
    marginBottom: 2,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderBottomWidth: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 17,
  },
  sub: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 1,
  },
}));

const hero = themed(() => ({
  wrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  art: {
    borderWidth: 3,
    borderRadius: 26,
    padding: 0,
    overflow: 'hidden' as const,
  },
  text: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
}));

const btn = themed(() => ({
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 5,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  pressed: {
    transform: [{ translateY: 3 }],
    borderBottomWidth: 2,
    marginBottom: 3,
  },
  text: {
    fontFamily: fonts.condensedHeavy,
    fontSize: 15,
    letterSpacing: 1,
  },
}));
