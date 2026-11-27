import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { cpToWinPercent, EvalData } from '../utils/moveClassifier';
import { colors, fonts, themed } from '../theme';

interface EvalBarProps {
  evaluation: EvalData | null;
  width: number;
  flipped?: boolean;
  /** Desliza até o novo valor em vez de pular. */
  smooth?: boolean;
}

/**
 * Barra horizontal acima do tabuleiro. As brancas ficam do lado esquerdo (ou do direito com o
 * tabuleiro girado) e o placar aparece na ponta de quem está vencendo.
 */
export const EvalBar: React.FC<EvalBarProps> = ({ evaluation, width, flipped = false, smooth = true }) => {
  const ev = evaluation ?? { cp: 0, mate: null, bestMove: '', secondBestMove: '', depth: 0 };
  const whitePercent = Math.max(2, Math.min(98, cpToWinPercent(ev.cp, ev.mate)));
  const isWhiteWinning = whitePercent >= 50;

  const anim = useRef(new Animated.Value(whitePercent)).current;
  useEffect(() => {
    if (!smooth) {
      anim.setValue(whitePercent);
      return;
    }
    Animated.timing(anim, {
      toValue: whitePercent,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web', // desliza com translate (fora da thread do JS)
    }).start();
  }, [whitePercent, smooth]); // eslint-disable-line react-hooks/exhaustive-deps
  // A parte branca ocupa a barra toda e é empurrada para fora conforme as pretas ganham
  const shift = anim.interpolate({
    inputRange: [0, 100],
    outputRange: flipped ? [width, 0] : [-width, 0],
  });

  const score = (() => {
    if (ev.result) return ev.result === '½-½' ? '½-½' : ev.result;
    if (ev.mate !== null) return `M${Math.abs(ev.mate)}`;
    const pawns = (Math.abs(ev.cp) / 100).toFixed(1);
    return ev.cp > 0 ? `+${pawns}` : ev.cp < 0 ? `-${pawns}` : '0.0';
  })();

  // Brancas à esquerda, a não ser com o tabuleiro girado
  const scoreAtLeft = isWhiteWinning !== flipped;

  return (
    <View style={[styles.container, { width }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2e2e33', overflow: 'hidden' }]}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#ece8e1', transform: [{ translateX: shift }] }]}
        />
      </View>
      <View style={styles.midLine} />
      <Text
        style={[
          styles.score,
          scoreAtLeft ? { left: 8 } : { right: 8 },
          { color: isWhiteWinning ? '#1a1a1d' : '#ece8e1' },
        ]}
        numberOfLines={1}
      >
        {score}
      </Text>
    </View>
  );
};

const styles = themed(() => StyleSheet.create({
  container: {
    height: 18,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  midLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.red,
    opacity: 0.75,
  },
  score: {
    position: 'absolute',
    fontFamily: fonts.condensedHeavy,
    fontSize: 12,
    letterSpacing: 0.3,
  },
}));
