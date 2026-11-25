import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { Icon } from '../components/Icon';
import { Barcode, Wordmark } from '../components/Logo';
import { Cross, MetaRow, PosterRow, SectionLabel } from '../components/poster';
import { HERO_RATIO, HERO_SVG } from '../brand/brandSvgs';
import { colors, fonts } from '../theme';

export type MenuAction =
  | 'chesscom'
  | 'lichess'
  | 'pgn'
  | 'free'
  | 'continue'
  | 'settings'
  | 'online'
  | 'play'
  | 'bot'
  | 'botbot'
  | 'tournament';

interface MainMenuProps {
  onAction: (action: MenuAction) => void;
  pieceSet: string;
  /** Resumo da análise em andamento (para "Continuar"), se houver. */
  current: { title: string; subtitle: string } | null;
}

const PLAY: { action: MenuAction; title: string }[] = [
  { action: 'bot', title: 'Contra o bot' },
  { action: 'online', title: 'Contra um amigo' },
  { action: 'tournament', title: 'Torneio' },
  { action: 'botbot', title: 'Bot x Bot' },
];

const ANALYZE: { action: MenuAction; title: string }[] = [
  { action: 'chesscom', title: 'Chess.com' },
  { action: 'lichess', title: 'Lichess' },
  { action: 'pgn', title: 'Colar PGN' },
  { action: 'free', title: 'Tabuleiro livre' },
];

const pad = (n: number) => String(n).padStart(2, '0');

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onAction, current }) => {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 520);
  const now = useClock();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: 520 }]} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho do cartaz */}
        <View style={styles.marks}>
          <Cross />
          <Wordmark height={20} />
          <Cross />
        </View>

        <View style={styles.pad}>
          <MetaRow
            items={[
              { label: 'TÍTULO', value: 'Xadrez' },
              { label: 'DATA', value: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}` },
              { label: 'HORA', value: `${pad(now.getHours())}:${pad(now.getMinutes())}` },
              { label: 'MOTOR', value: 'Stockfish 19' },
            ]}
          />
        </View>

        <SvgXml xml={HERO_SVG} width={pageWidth} height={pageWidth * HERO_RATIO} />

        <View style={styles.pad}>
          <View style={styles.cta}>
            <Pressable onPress={() => onAction('play')} accessibilityLabel="Jogar" style={({ pressed }) => [styles.ctaMain, pressed && { opacity: 0.8 }]}>
              <Text style={styles.ctaMainText}>JOGAR</Text>
              <Icon name="next" size={20} color={colors.paper} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              onPress={() => onAction('chesscom')}
              accessibilityLabel="Analisar"
              style={({ pressed }) => [styles.ctaAlt, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.ctaAltText}>ANALISAR</Text>
            </Pressable>
          </View>

          {current && (
            <Pressable
              onPress={() => onAction('continue')}
              accessibilityLabel="Continuar análise"
              style={({ pressed }) => [styles.continue, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.continueLabel}>CONTINUAR —</Text>
              <Text style={styles.continueTitle} numberOfLines={1}>
                {current.title}
              </Text>
              <Icon name="next" size={16} color={colors.red} strokeWidth={2} />
            </Pressable>
          )}

          <SectionLabel index="01">Jogar</SectionLabel>
          {PLAY.map((p, i) => (
            <PosterRow key={p.action} index={pad(i + 1)} title={p.title} onPress={() => onAction(p.action)} />
          ))}

          <SectionLabel index="02">Analisar partida</SectionLabel>
          {ANALYZE.map((p, i) => (
            <PosterRow key={p.action} index={pad(i + 1)} title={p.title} onPress={() => onAction(p.action)} />
          ))}

          <View style={styles.footer}>
            <Barcode width={110} />
            <Text style={styles.footerText}>STOCKFISH 19 · ANÁLISE NO APARELHO</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 28,
  },
  marks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
  },
  pad: {
    paddingHorizontal: 18,
  },
  cta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  ctaMain: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.red,
    borderRadius: 3,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  ctaMainText: {
    color: colors.paper,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
  },
  ctaAlt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  ctaAltText: {
    color: colors.ink,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
  },
  continue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  continueLabel: {
    color: colors.red,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  continueTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 30,
  },
  footerText: {
    color: colors.textMuted,
    fontFamily: fonts.condensed,
    fontWeight: '700',
    fontSize: 10.5,
    letterSpacing: 1.6,
  },
});
