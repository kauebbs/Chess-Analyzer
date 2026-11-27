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

/** Barra inferior Noxari: aba ativa num "selo" verde arredondado, ícones de traço grosso. */
export function NavBar({ active, onSelect }: { active: NavTab | null; onSelect: (tab: NavTab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      <View style={styles.row}>
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.pill, on && styles.pillOn]}>
                <Icon name={t.icon} size={21} color={on ? colors.brandText : colors.textMuted} strokeWidth={on ? 2.4 : 2} />
              </View>
              <Text style={[styles.label, { color: on ? colors.brandText : colors.textMuted }]} numberOfLines={1}>
                {t.label}
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
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderColor: colors.border,
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
    gap: 2,
  },
  pill: {
    width: 48,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pillOn: {
    backgroundColor: colors.red + '33',
  },
  label: {
    fontFamily: fonts.condensed,
    fontSize: 11,
  },
}));
