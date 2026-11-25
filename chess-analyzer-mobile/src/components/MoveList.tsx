import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MoveClassification } from '../utils/moveClassifier';
import { colors } from '../theme';

interface MoveListProps {
  sans: string[];
  classifications: (MoveClassification | null)[];
  /** Quantos lances estão aplicados no tabuleiro (0 = posição inicial). */
  index: number;
  firstMoveNumber: number;
  blackStarts: boolean;
  onSelect: (index: number) => void;
  /** Índice do primeiro lance da variante (os lances a partir daqui não são da partida). */
  variationFrom?: number | null;
}

// Só lances especiais, imprecisões e erros ganham símbolo na lista (deixa a lista limpa)
const SHOW_SYMBOL = new Set(['!!', '!', '?!', '?', '??', '✕']);

export const MoveList: React.FC<MoveListProps> = ({
  sans,
  classifications,
  index,
  firstMoveNumber,
  blackStarts,
  onSelect,
  variationFrom = null,
}) => {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<number, number>>({});

  // Mantém o lance atual visível
  useEffect(() => {
    const x = positions.current[index - 1];
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - 120), animated: true });
    else if (index === 0) scrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [index, sans.length]);

  if (sans.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum lance ainda</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {sans.map((san, i) => {
        const ply = i + (blackStarts ? 1 : 0);
        const isWhite = ply % 2 === 0;
        const moveNo = firstMoveNumber + Math.floor(ply / 2);
        const cls = classifications[i];
        const active = i === index - 1;
        const inVariation = variationFrom !== null && i >= variationFrom;
        const showNumber = isWhite || i === 0 || i === variationFrom;

        return (
          <View
            key={i}
            style={styles.item}
            onLayout={(e) => {
              positions.current[i] = e.nativeEvent.layout.x;
            }}
          >
            {i === variationFrom && <Text style={styles.paren}>(</Text>}
            {showNumber && (
              <Text style={styles.number}>
                {moveNo}
                {isWhite ? '.' : '...'}
              </Text>
            )}
            <Pressable
              onPress={() => onSelect(i + 1)}
              style={[styles.move, active && styles.moveActive]}
              hitSlop={4}
            >
              <Text style={[styles.san, inVariation && styles.sanVariation, active && styles.sanActive]}>{san}</Text>
              {cls && SHOW_SYMBOL.has(cls.symbol) && (
                <Text style={[styles.symbol, { color: cls.color }]}>{cls.symbol}</Text>
              )}
            </Pressable>
            {inVariation && i === sans.length - 1 && <Text style={styles.paren}>)</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  number: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 8,
    marginRight: 2,
  },
  move: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
  },
  moveActive: {
    backgroundColor: colors.surfaceAlt,
  },
  san: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  sanVariation: {
    color: colors.mint,
    fontStyle: 'italic',
  },
  paren: {
    color: colors.mint,
    fontSize: 15,
    marginLeft: 6,
  },
  sanActive: {
    color: colors.text,
  },
  symbol: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 2,
  },
  empty: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
