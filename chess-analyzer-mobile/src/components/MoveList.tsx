import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MoveClassification } from '../utils/moveClassifier';
import { colors, themed } from '../theme';

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

/** Quanto o lance atual fica afastado da borda esquerda ao rolar (igual ao comportamento antigo). */
const SCROLL_MARGIN = 120;

interface MoveItemData {
  key: string;
  i: number;
  san: string;
  number: string | null;
  openParen: boolean;
  closeParen: boolean;
  inVariation: boolean;
  symbol: string | null;
  symbolColor: string | undefined;
}

/**
 * Um lance da lista. Memoizado: ao avançar/voltar só os dois lances que mudam de "ativo" redesenham
 * (antes a lista inteira — 160 lances numa partida de 80 — redesenhava a cada toque na seta).
 */
const MoveItem = memo(function MoveItem({
  item,
  active,
  onSelect,
}: {
  item: MoveItemData;
  active: boolean;
  onSelect: (index: number) => void;
}) {
  const press = useCallback(() => onSelect(item.i + 1), [onSelect, item.i]);
  return (
    <View style={styles.item}>
      {item.openParen && <Text style={styles.paren}>(</Text>}
      {item.number !== null && <Text style={styles.number}>{item.number}</Text>}
      <Pressable onPress={press} style={[styles.move, active && styles.moveActive]} hitSlop={4}>
        <Text style={[styles.san, item.inVariation && styles.sanVariation, active && styles.sanActive]}>{item.san}</Text>
        {item.symbol && <Text style={[styles.symbol, { color: item.symbolColor }]}>{item.symbol}</Text>}
      </Pressable>
      {item.closeParen && <Text style={styles.paren}>)</Text>}
    </View>
  );
},
(a, b) => a.active === b.active && a.onSelect === b.onSelect && sameItem(a.item, b.item));

/** Compara pelo conteúdo: telas que recriam a lista a cada render não fazem todos os lances redesenharem. */
function sameItem(a: MoveItemData, b: MoveItemData) {
  return (
    a === b ||
    (a.i === b.i &&
      a.san === b.san &&
      a.number === b.number &&
      a.openParen === b.openParen &&
      a.closeParen === b.closeParen &&
      a.inVariation === b.inVariation &&
      a.symbol === b.symbol &&
      a.symbolColor === b.symbolColor)
  );
}

/**
 * Lista horizontal de lances, virtualizada (FlatList): numa partida longa só os lances perto da tela
 * ficam montados.
 */
export const MoveList = memo(function MoveList({
  sans,
  classifications,
  index,
  firstMoveNumber,
  blackStarts,
  onSelect,
  variationFrom = null,
}: MoveListProps) {
  const listRef = useRef<FlatList<MoveItemData>>(null);
  // Callback estável para os itens (a tela pode mandar uma função nova a cada render)
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const select = useCallback((i: number) => onSelectRef.current(i), []);

  const items = useMemo<MoveItemData[]>(
    () =>
      sans.map((san, i) => {
        const ply = i + (blackStarts ? 1 : 0);
        const isWhite = ply % 2 === 0;
        const moveNo = firstMoveNumber + Math.floor(ply / 2);
        const cls = classifications[i];
        const inVariation = variationFrom !== null && i >= variationFrom;
        const showNumber = isWhite || i === 0 || i === variationFrom;
        const showSymbol = !!cls && SHOW_SYMBOL.has(cls.symbol);
        return {
          key: `${i}`,
          i,
          san,
          number: showNumber ? `${moveNo}${isWhite ? '.' : '...'}` : null,
          openParen: i === variationFrom,
          closeParen: inVariation && i === sans.length - 1,
          inVariation,
          symbol: showSymbol ? cls!.symbol : null,
          symbolColor: showSymbol ? cls!.color : undefined,
        };
      }),
    [sans, classifications, firstMoveNumber, blackStarts, variationFrom]
  );

  const activeIdx = index - 1;
  const renderItem = useCallback(
    ({ item }: { item: MoveItemData }) => <MoveItem item={item} active={item.i === activeIdx} onSelect={select} />,
    [activeIdx, select]
  );

  // Mantém o lance atual visível
  const retried = useRef(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list || items.length === 0) return;
    retried.current = false;
    if (index <= 0) {
      list.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    list.scrollToIndex({ index: Math.min(index - 1, items.length - 1), viewOffset: SCROLL_MARGIN, animated: true });
  }, [index, items.length]);

  // Lance ainda não medido (longe da parte já desenhada): rola para uma posição estimada e tenta de novo
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const list = listRef.current;
      if (!list) return;
      list.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index - SCROLL_MARGIN), animated: false });
      if (retried.current) return;
      retried.current = true;
      setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ index: info.index, viewOffset: SCROLL_MARGIN, animated: true });
        } catch {
          // a lista mudou nesse meio tempo: sem problema
        }
      }, 60);
    },
    []
  );

  if (sans.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum lance ainda</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyOf}
      extraData={activeIdx}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      initialNumToRender={24}
      maxToRenderPerBatch={16}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
      onScrollToIndexFailed={onScrollToIndexFailed}
    />
  );
});

const keyOf = (item: MoveItemData) => item.key;

const styles = themed(() => StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  number: {
    fontFamily: 'Nunito_600SemiBold',
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
    fontFamily: 'Nunito_600SemiBold',
  },
  sanVariation: {
    color: colors.mint,
    fontStyle: 'italic',
  },
  paren: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.mint,
    fontSize: 15,
    marginLeft: 6,
  },
  sanActive: {
    color: colors.text,
  },
  symbol: {
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
    marginLeft: 2,
  },
  empty: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 13,
  },
}));
