import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Piece } from './Piece';
import { colors, themed } from '../theme';

type Kind = 'p' | 'n' | 'b' | 'r' | 'q';
type Count = Record<Kind, number>;

const START: Count = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUE: Count = { p: 1, n: 3, b: 3, r: 5, q: 9 };
/** Ordem do Chess.com: peões, bispos, cavalos, torres, dama. */
const ORDER: Kind[] = ['p', 'b', 'n', 'r', 'q'];

const empty = (): Count => ({ p: 0, n: 0, b: 0, r: 0, q: 0 });

/**
 * Material a partir da posição: peças que cada lado perdeu e a vantagem (Brancas − Pretas, em pontos).
 * Peças a mais que as iniciais vêm de promoção — cada uma é um peão que não foi capturado.
 */
export function materialFromFen(fen: string): { lost: Record<'w' | 'b', Count>; diff: number } {
  const onBoard: Record<'w' | 'b', Count> = { w: empty(), b: empty() };
  for (const ch of fen.split(' ')[0]) {
    const lower = ch.toLowerCase() as Kind;
    if (!(lower in START)) continue;
    onBoard[ch === lower ? 'b' : 'w'][lower] += 1;
  }
  const lost: Record<'w' | 'b', Count> = { w: empty(), b: empty() };
  let diff = 0;
  for (const c of ['w', 'b'] as const) {
    let promoted = 0;
    for (const k of ['n', 'b', 'r', 'q'] as const) {
      promoted += Math.max(0, onBoard[c][k] - START[k]);
      lost[c][k] = Math.max(0, START[k] - onBoard[c][k]);
    }
    lost[c].p = Math.max(0, START.p - onBoard[c].p - promoted);
    const material = ORDER.reduce((sum, k) => sum + onBoard[c][k] * VALUE[k], 0);
    diff += c === 'w' ? material : -material;
  }
  return { lost, diff };
}

/**
 * Peças que `color` capturou (as do adversário) e o "+N" de vantagem material, como no Chess.com.
 * Não mostra nada no começo da partida.
 */
export const CapturedRow = memo(function CapturedRow({
  fen,
  color,
  pieceSet,
  size = 15,
}: {
  fen: string;
  color: 'w' | 'b';
  pieceSet: string;
  size?: number;
}) {
  const { lost, diff } = materialFromFen(fen);
  const victim = color === 'w' ? 'b' : 'w';
  const taken = lost[victim];
  const lead = color === 'w' ? diff : -diff;
  const any = ORDER.some((k) => taken[k] > 0);
  if (!any && lead <= 0) return null;
  return (
    <View style={styles.row} accessibilityLabel={lead > 0 ? `Vantagem de ${lead} pontos` : undefined}>
      {ORDER.map((k) =>
        taken[k] > 0 ? (
          <View key={k} style={styles.group}>
            {Array.from({ length: taken[k] }, (_, i) => (
              <View key={i} style={i > 0 ? { marginLeft: -size * 0.55 } : undefined}>
                <Piece setId={pieceSet} color={victim} type={k} size={size} />
              </View>
            ))}
          </View>
        ) : null
      )}
      {lead > 0 && <Text style={[styles.lead, { fontSize: Math.max(10, size * 0.78) }]}>+{lead}</Text>}
    </View>
  );
});

const styles = themed(() => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lead: {
    color: colors.textDim,
    fontWeight: '700',
    marginLeft: 2,
  },
}));
