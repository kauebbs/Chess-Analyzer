import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { MOVE_KINDS, MoveKind } from '../utils/moveClassifier';

interface MoveBadgeProps {
  kind: MoveKind;
  size?: number;
  /** Contorno escuro, para destacar o selo em cima das peças. */
  outlined?: boolean;
}

const TEXT_GLYPH: Partial<Record<MoveKind, string>> = {
  brilliant: '!!',
  great: '!',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

/** Selo redondo com o ícone da classificação do lance. */
export const MoveBadge: React.FC<MoveBadgeProps> = ({ kind, size = 22, outlined = false }) => {
  const { color } = MOVE_KINDS[kind];
  const text = TEXT_GLYPH[kind];
  const glyph = size * 0.62;

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        outlined && { borderWidth: Math.max(1, size * 0.07), borderColor: 'rgba(0,0,0,0.35)' },
      ]}
    >
      {text ? (
        <Text
          style={[
            styles.text,
            { fontSize: size * (text.length > 1 ? 0.46 : 0.56), lineHeight: size * 0.9 },
          ]}
          allowFontScaling={false}
        >
          {text}
        </Text>
      ) : (
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          {kind === 'best' && (
            <Polygon
              points="12 2.5 14.9 8.4 21.4 9.3 16.7 13.9 17.8 20.3 12 17.3 6.2 20.3 7.3 13.9 2.6 9.3 9.1 8.4"
              fill="#fff"
            />
          )}
          {kind === 'excellent' && (
            <>
              <Path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" fill="#fff" />
              <Path
                d="M9 10.5 12.4 3a2.6 2.6 0 0 1 2.9 3.2L14.5 9.5h5a2 2 0 0 1 1.95 2.45l-1.7 7.5A2 2 0 0 1 17.8 21H9z"
                fill="#fff"
              />
            </>
          )}
          {kind === 'good' && (
            <Path d="M20 6 9 17l-5-5" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          )}
          {kind === 'book' && (
            <>
              <Path d="M2 4.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z" fill="#fff" />
              <Path d="M22 4.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z" fill="#fff" opacity={0.85} />
            </>
          )}
          {kind === 'miss' && (
            <>
              <Path d="M18 6 6 18" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" />
              <Path d="m6 6 12 12" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" />
            </>
          )}
        </Svg>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: -0.5,
  },
});
