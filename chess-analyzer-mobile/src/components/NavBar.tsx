import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { colors, fonts, themed } from '../theme';

export type NavTab = 'home' | 'play' | 'analyze' | 'tournament' | 'settings';

const TABS: { id: NavTab; icon: IconName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Início' },
  { id: 'play', icon: 'swords', label: 'Jogar' },
  { id: 'analyze', icon: 'search', label: 'Analisar' },
  { id: 'tournament', icon: 'trophy', label: 'Torneios' },
  { id: 'settings', icon: 'settings', label: 'Ajustes' },
];

export const NAV_HEIGHT = 58;

/** Barra de navegação inferior no estilo cartaz: linha fina, ícones em traço, aba ativa em vermelho. */
export function NavBar({ active, onSelect }: { active: NavTab | null; onSelect: (tab: NavTab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      <View style={styles.row}>
        {TABS.map((t) => {
          const on = active === t.id;
          const tint = on ? colors.red : colors.ink;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.marker, on && { backgroundColor: colors.red }]} />
              <Icon name={t.icon} size={21} color={tint} strokeWidth={on ? 2 : 1.6} />
              <Text style={[styles.label, { color: on ? colors.red : colors.textDim }]} numberOfLines={1}>
                {t.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = themed(() => ({
  bar: {
    backgroundColor: colors.bg,
    borderTopWidth: 1.5,
    borderColor: colors.ink,
  },
  row: {
    flexDirection: 'row' as const,
    height: NAV_HEIGHT,
    alignItems: 'stretch' as const,
  },
  tab: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  marker: {
    position: 'absolute' as const,
    top: -1.5,
    width: 22,
    height: 3,
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: fonts.condensed,
    fontWeight: '700' as const,
    fontSize: 10.5,
    letterSpacing: 1.1,
  },
}));
