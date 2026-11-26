import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { Icon } from '../components/Icon';
import { themeSvg, Wordmark } from '../components/Logo';
import { Cross } from '../components/poster';
import { HERO_RATIO, HERO_SVG } from '../brand/brandSvgs';
import { colors, fonts, themed } from '../theme';

export type MenuAction =
  | 'chesscom'
  | 'lichess'
  | 'pgn'
  | 'free'
  | 'continue'
  | 'settings'
  | 'online'
  | 'play'
  | 'analyze'
  | 'bot'
  | 'botbot'
  | 'tournament';

interface MainMenuProps {
  onAction: (action: MenuAction) => void;
  pieceSet: string;
  /** Resumo da análise em andamento, se houver (não aparece mais no menu; fica na aba Analisar). */
  current: { title: string; subtitle: string } | null;
}

/** Menu inicial em estilo cartaz: só a arte e dois botões. */
export const MainMenu: React.FC<MainMenuProps> = ({ onAction }) => {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 520);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.page}>
        <View style={styles.marks}>
          <Cross />
          <Wordmark height={20} />
          <Cross />
        </View>

        <View style={styles.heroWrap}>
          <SvgXml xml={themeSvg(HERO_SVG)} width={pageWidth} height={pageWidth * HERO_RATIO} />
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => onAction('play')}
            accessibilityLabel="Jogar"
            style={({ pressed }) => [styles.btn, styles.btnMain, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.btnText, { color: colors.onRed }]}>JOGAR</Text>
            <Icon name="next" size={20} color={colors.onRed} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            onPress={() => onAction('analyze')}
            accessibilityLabel="Analisar"
            style={({ pressed }) => [styles.btn, styles.btnAlt, pressed && { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>ANALISAR</Text>
            <Icon name="next" size={20} color={colors.ink} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = themed(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  marks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  heroWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: 18,
    paddingBottom: 22,
    gap: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 3,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  btnMain: {
    backgroundColor: colors.red,
  },
  btnAlt: {
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  btnText: {
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
  },
}));
