import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { colors, fonts } from '../theme';

/**
 * Peças do estilo "cartaz": papel creme, tinta preta, vermelho de impressão, linhas finas,
 * tipografia condensada em caixa alta. Nada de sombras ou bordas grossas.
 */

/** Marca de registro "+" (dos cantos dos cartazes). */
export function Cross({ size = 16, color = colors.red, weight = 2 }: { size?: number; color?: string; weight?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: weight, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: weight, height: size, backgroundColor: color }} />
    </View>
  );
}

/** Linha de metadados: "TÍTULO — valor" em vermelho, como a ficha técnica dos cartazes. */
export function MetaRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={meta.row}>
      {items.map((it) => (
        <View key={it.label} style={{ flexShrink: 1 }}>
          <Text style={meta.label} numberOfLines={1}>
            {it.label} —
          </Text>
          <Text style={meta.value} numberOfLines={1}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Rótulo de seção: número + nome, com uma linha fina embaixo. */
export function SectionLabel({ index, children }: { index?: string; children: string }) {
  return (
    <View style={sec.wrap}>
      {index ? <Text style={sec.index}>{index}</Text> : null}
      <Text style={sec.text}>{children.toUpperCase()}</Text>
    </View>
  );
}

/** Item de menu: número em vermelho, título condensado e uma seta. Separado por linha fina. */
export function PosterRow({
  index,
  title,
  subtitle,
  onPress,
  icon = 'next',
  first = false,
}: {
  index?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: IconName;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={title}
      style={({ pressed }) => [row.box, first && row.first, pressed && { backgroundColor: colors.surface }]}
    >
      {index ? <Text style={row.index}>{index}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={row.title} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
        {subtitle ? (
          <Text style={row.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name={icon} size={18} color={colors.ink} strokeWidth={1.6} />
    </Pressable>
  );
}

/** Título grande, condensado, vermelho (os títulos das telas). */
export function PosterHeading({ children, size = 44, color = colors.red }: { children: string; size?: number; color?: string }) {
  return (
    <Text
      style={{
        color,
        fontFamily: fonts.condensedHeavy,
        fontWeight: '900',
        fontSize: size,
        lineHeight: size * 1.02,
        letterSpacing: -0.5,
        textAlign: 'left',
        alignSelf: 'stretch',
      }}
    >
      {children.toUpperCase()}
    </Text>
  );
}

/** Botão discreto: preenchido (tinta ou vermelho) ou só com contorno fino. */
export function PosterButton({
  icon,
  label,
  onPress,
  variant = 'ink',
  style,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
  variant?: 'ink' | 'red' | 'outline';
  style?: StyleProp<ViewStyle>;
}) {
  const filled = variant !== 'outline';
  const bg = variant === 'red' ? colors.red : variant === 'ink' ? colors.ink : 'transparent';
  const fg = filled ? colors.paper : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [btn.box, { backgroundColor: bg }, !filled && btn.outline, pressed && { opacity: 0.75 }, style]}
    >
      {icon ? <Icon name={icon} size={17} color={fg} strokeWidth={1.8} /> : null}
      <Text style={[btn.text, { color: fg }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const meta = {
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  label: {
    color: colors.red,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800' as const,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  value: {
    color: colors.red,
    fontSize: 10.5,
    fontStyle: 'italic' as const,
    marginTop: 1,
  },
};

const sec = {
  wrap: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 8,
    marginTop: 28,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderColor: colors.ink,
  },
  index: {
    color: colors.red,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800' as const,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  text: {
    color: colors.ink,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800' as const,
    fontSize: 12,
    letterSpacing: 2.2,
  },
};

const row = {
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  first: {},
  index: {
    width: 22,
    color: colors.red,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800' as const,
    fontSize: 13,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900' as const,
    fontSize: 21,
    letterSpacing: 0.2,
  },
  sub: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 1,
  },
};

const btn = {
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderRadius: 3,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  text: {
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800' as const,
    fontSize: 14,
    letterSpacing: 1.6,
  },
};
