import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark, Wordmark } from '../components/Logo';
import { Mascot } from '../components/Mascot';
import { PosterButton } from '../components/poster';
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

/** Início: a Nox apresenta a marca e dois caminhos — jogar ou analisar. */
export const MainMenu: React.FC<MainMenuProps> = ({ onAction }) => {
  const { width, height } = useWindowDimensions();
  const pageWidth = Math.min(width, 520);
  const artH = Math.min((pageWidth - 46) / 1.1628, height * 0.36);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.page}>
        <View style={styles.top}>
          <LogoMark size={34} />
          <Wordmark height={18} />
        </View>

        <View style={styles.stage}>
          <View style={styles.heroFrame}>
            <Mascot pose="hero" height={artH} radius={28} />
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>Pronto para a próxima partida?</Text>
          <Text style={styles.text}>Jogue contra bots com personalidade ou entenda cada lance das suas partidas.</Text>
        </View>

        <View style={styles.actions}>
          <PosterButton label="Jogar" icon="play" onPress={() => onAction('play')} />
          <PosterButton label="Analisar" icon="search" variant="outline" onPress={() => onAction('analyze')} />
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  heroFrame: {
    borderRadius: 32,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.red,
    overflow: 'hidden',
  },
  copy: {
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  text: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 12,
  },
}));
