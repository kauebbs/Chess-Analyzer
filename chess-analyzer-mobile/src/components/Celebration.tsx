import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { MOVE_KINDS } from '../utils/moveClassifier';
import { colors, fonts, themed } from '../theme';
import { EffectIntensity, intensityScale } from '../settings/animation';
import { Piece } from './Piece';

export type CelebrationEvent =
  | { id: number; type: 'brilliant'; square: string }
  | { id: number; type: 'checkmate'; square: string }
  | { id: number; type: 'victory'; title: string; subtitle: string; winner: 'w' | 'b'; /** sem confete (quem perdeu) */ quiet?: boolean }
  | { id: number; type: 'draw'; title: string; subtitle: string };

interface CelebrationProps {
  event: CelebrationEvent | null;
  size: number;
  flipped: boolean;
  onDone: (id: number) => void;
  /** Quantidade de partículas e duração dos efeitos. */
  intensity?: EffectIntensity;
  /** Conjunto de peças (o painel de vitória mostra o rei do vencedor). */
  pieceSet?: string;
}

const NATIVE = Platform.OS !== 'web';

/** Camada de animações por cima do tabuleiro (não recebe toques). */
export const Celebration: React.FC<CelebrationProps> = ({
  event,
  size,
  flipped,
  onDone,
  intensity = 'normal',
  pieceSet = 'staunty',
}) => {
  if (!event) return null;
  const k = intensityScale(intensity);
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      {event.type === 'brilliant' && (
        <Brilliant
          key={event.id}
          {...center(event.square, size, flipped)}
          sq={size / 8}
          size={size}
          k={k}
          onDone={() => onDone(event.id)}
        />
      )}
      {event.type === 'checkmate' && (
        <Checkmate
          key={event.id}
          {...center(event.square, size, flipped)}
          sq={size / 8}
          size={size}
          k={k}
          onDone={() => onDone(event.id)}
        />
      )}
      {(event.type === 'victory' || event.type === 'draw') && (
        <Victory
          key={event.id}
          size={size}
          title={event.title}
          subtitle={event.subtitle}
          confetti={event.type === 'victory' && !event.quiet}
          winner={event.type === 'victory' ? event.winner : null}
          pieceSet={pieceSet}
          k={k}
          onDone={() => onDone(event.id)}
        />
      )}
    </View>
  );
};

function center(square: string, size: number, flipped: boolean) {
  const sq = size / 8;
  const file = square.charCodeAt(0) - 97;
  const rankIdx = 8 - parseInt(square[1], 10);
  const col = flipped ? 7 - file : file;
  const row = flipped ? 7 - rankIdx : rankIdx;
  return { cx: col * sq + sq / 2, cy: row * sq + sq / 2 };
}

/**
 * Tamanho de fonte para o texto caber numa linha só na largura dada (fonte condensada pesada,
 * em caixa alta). No celular o `adjustsFontSizeToFit` ainda corrige o que sobrar.
 */
function fitFont(text: string, width: number, max: number, min = 11, spacing = 0) {
  const n = Math.max(1, text.length);
  const f = (width - spacing * n) / (n * 0.8);
  return Math.max(min, Math.min(max, f));
}

function useProgress(duration: number, onDone: () => void, delay = 0) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(p, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    });
    anim.start(({ finished }) => finished && onDone());
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return p;
}

// ---------- Brilhante: casa acesa + anéis + faíscas + "!!" subindo ----------
function Brilliant({
  cx,
  cy,
  sq,
  size,
  k,
  onDone,
}: {
  cx: number;
  cy: number;
  sq: number;
  size: number;
  k: number;
  onDone: () => void;
}) {
  // Selo "!! BRILHANTE": sobe da casa e fica dentro do tabuleiro
  const pillH = Math.max(24, sq * 0.62);
  const labelFont = Math.max(10, pillH * 0.42);
  const pillW = Math.min(size - 8, pillH + 6 + 9 * (labelFont * 0.74 + 1.6) + 16);
  const pillLeft = Math.max(4, Math.min(size - pillW - 4, cx - pillW / 2));
  const rise = Math.min(sq * 1.25, cy - pillH / 2 - 4);
  const p = useProgress(1000 + 250 * k, onDone);
  const color = MOVE_KINDS.brilliant.color;
  const count = Math.round(14 * k);
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
        const dist = sq * (1.1 + (i % 3) * 0.35) * (0.85 + 0.25 * k);
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: sq * (i % 2 ? 0.1 : 0.14) };
      }),
    [sq, count, k]
  );

  const ring = (delay: number) => {
    const t = p.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
    return {
      opacity: t.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.95, 0] }),
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2 + 0.6 * k] }) }],
    };
  };

  return (
    <>
      {/* A casa do lance acende e apaga */}
      <Animated.View
        style={{
          position: 'absolute',
          left: cx - sq / 2,
          top: cy - sq / 2,
          width: sq,
          height: sq,
          backgroundColor: color,
          opacity: p.interpolate({ inputRange: [0, 0.08, 0.3, 0.55, 1], outputRange: [0, 0.75, 0.35, 0.55, 0] }),
        }}
      />
      {(k > 1 ? [0, 0.14, 0.28] : [0, 0.18]).map((d) => (
        <Animated.View
          key={d}
          style={[
            styles.ring,
            { left: cx - sq / 2, top: cy - sq / 2, width: sq, height: sq, borderRadius: sq, borderColor: color },
            ring(d),
          ]}
        />
      ))}
      {sparks.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: cx - s.size / 2,
            top: cy - s.size / 2,
            width: s.size,
            height: s.size,
            borderRadius: i % 2 ? s.size : 2,
            backgroundColor: i % 3 === 0 ? '#ffffff' : color,
            opacity: p.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
            transform: [
              { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
              // as faíscas sobem e depois caem um pouco (gravidade)
              { translateY: p.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, s.dy * 0.85, s.dy + sq * 0.35] }) },
              { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${180 + i * 20}deg`] }) },
            ],
          }}
        />
      ))}
      <Animated.View
        style={[
          styles.brillPill,
          {
            left: pillLeft,
            top: cy - pillH / 2,
            width: pillW,
            height: pillH,
            borderRadius: pillH / 2,
            backgroundColor: color,
            opacity: p.interpolate({ inputRange: [0, 0.1, 0.78, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, -rise, -rise - sq * 0.25] }) },
              { scale: p.interpolate({ inputRange: [0, 0.14, 0.26, 1], outputRange: [0.3, 1.12, 1, 1] }) },
            ],
          },
        ]}
      >
        <View style={[styles.brillGlyphWrap, { width: pillH - 6, height: pillH - 6, borderRadius: pillH }]}>
          <Text style={[styles.brillGlyph, { color, fontSize: pillH * 0.48 }]} allowFontScaling={false}>
            !!
          </Text>
        </View>
        <Text
          style={[styles.brillText, { fontSize: fitFont('BRILHANTE', pillW - pillH - 22, labelFont, 9, 1.6) }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          BRILHANTE
        </Text>
      </Animated.View>
    </>
  );
}

// ---------- Xeque-mate: ondas vermelhas no rei + clarão + texto ----------
function Checkmate({
  cx,
  cy,
  sq,
  size,
  k,
  onDone,
}: {
  cx: number;
  cy: number;
  sq: number;
  size: number;
  k: number;
  onDone: () => void;
}) {
  const p = useProgress(1700, onDone);
  const MATE_FONT = Math.round(fitFont('XEQUE-MATE', size * 0.78, size * 0.13, 16, 3));
  const waves = k < 1 ? [0, 0.16] : k > 1 ? [0, 0.1, 0.2, 0.3] : [0, 0.12, 0.24];
  const wave = (delay: number) => {
    const t = p.interpolate({ inputRange: [0, delay, delay + 0.5, 1], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' });
    return {
      opacity: t.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 0.9, 0] }),
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 5] }) }],
    };
  };

  return (
    <>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.red,
            opacity: p.interpolate({ inputRange: [0, 0.08, 0.35, 1], outputRange: [0, 0.18 + 0.12 * k, 0, 0] }),
          },
        ]}
      />
      {/* Rei derrotado: a casa pisca em vermelho */}
      <Animated.View
        style={{
          position: 'absolute',
          left: cx - sq / 2,
          top: cy - sq / 2,
          width: sq,
          height: sq,
          backgroundColor: colors.red,
          opacity: p.interpolate({
            inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.85, 1],
            outputRange: [0, 0.85, 0.3, 0.85, 0.5, 0.5, 0],
          }),
        }}
      />
      {waves.map((d) => (
        <Animated.View
          key={d}
          style={[
            styles.ring,
            {
              left: cx - sq / 2,
              top: cy - sq / 2,
              width: sq,
              height: sq,
              borderRadius: sq,
              borderColor: colors.red,
              borderWidth: 4,
            },
            wave(d),
          ]}
        />
      ))}
      <View style={[StyleSheet.absoluteFill, styles.centerAll]}>
        {/* Faixa vermelha que "carimba" o tabuleiro */}
        <Animated.View
          style={[
            styles.mateBand,
            {
              width: size,
              height: MATE_FONT * 2.1,
              opacity: p.interpolate({ inputRange: [0, 0.1, 0.82, 1], outputRange: [0, 1, 1, 0] }),
              transform: [{ scaleX: p.interpolate({ inputRange: [0, 0.16, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }) }],
            },
          ]}
        />
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: p.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { scale: p.interpolate({ inputRange: [0, 0.14, 0.24, 1], outputRange: [2.2, 0.96, 1, 1.03] }) },
              // tremida rápida quando o texto "bate" no tabuleiro
              {
                translateX: p.interpolate({
                  inputRange: [0, 0.14, 0.17, 0.2, 0.23, 0.26, 1],
                  outputRange: [0, 0, -6 * k, 5 * k, -3 * k, 0, 0],
                }),
              },
            ],
          }}
        >
          <Text style={[styles.mateKicker, { fontSize: Math.max(9, MATE_FONT * 0.28) }]} allowFontScaling={false}>
            FIM DE JOGO
          </Text>
          <Text
            style={[styles.mateText, { fontSize: MATE_FONT, lineHeight: MATE_FONT * 1.08 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
          >
            XEQUE-MATE
          </Text>
        </Animated.View>
      </View>
    </>
  );
}

// ---------- Vitória / empate: cartão central + confete ----------
/** Confete nas cores do pôster (lido na hora, para seguir o tema claro/escuro). */
const confettiColors = () => [colors.red, colors.ink, colors.red, colors.textDim, '#f2c230', colors.redDark];

function Victory({
  size,
  title,
  subtitle,
  confetti,
  winner,
  pieceSet,
  k,
  onDone,
}: {
  size: number;
  title: string;
  subtitle: string;
  confetti: boolean;
  winner: 'w' | 'b' | null;
  pieceSet: string;
  k: number;
  onDone: () => void;
}) {
  const p = useProgress(2400 + 600 * k, onDone);
  const count = Math.round(30 * k);
  const pieces = useMemo(() => {
    const palette = confettiColors();
    return confetti
        ? Array.from({ length: count }, (_, i) => ({
            x: (((i * 37) % 100) / 100) * size,
            drift: ((i * 53) % 40) - 20,
            w: 6 + (i % 3) * 3,
            h: 10 + (i % 4) * 3,
            color: palette[i % palette.length],
            start: ((i * 13) % 30) / 100, // atraso relativo
            spin: 360 + (i % 5) * 180,
            sway: 8 + (i % 4) * 5,
          }))
        : [];
  }, [confetti, size, count]);

  const cardW = Math.min(size * 0.86, 340);
  const disc = Math.max(40, Math.min(70, size * 0.17));
  const titleFont = fitFont(title.toUpperCase(), cardW - 40, Math.min(40, size * 0.11), 12, 1);
  const accent = confetti ? colors.red : colors.textDim;
  const fade = p.interpolate({ inputRange: [0, 0.08, 0.86, 1], outputRange: [0, 1, 1, 0] });

  return (
    <>
      {/* Véu da cor do papel sobre o tabuleiro (no tema escuro, escuro) */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: Animated.multiply(fade, 0.72) }]}
      />

      <View style={[StyleSheet.absoluteFill, styles.centerAll]}>
        <Animated.View
          style={[
            styles.card,
            {
              width: cardW,
              paddingTop: disc * 0.55 + 14,
              marginTop: disc * 0.5,
              opacity: fade,
              transform: [
                { translateY: p.interpolate({ inputRange: [0, 0.1, 1], outputRange: [16, 0, 0], extrapolate: 'clamp' }) },
                { scale: p.interpolate({ inputRange: [0, 0.1, 0.15, 0.86, 1], outputRange: [0.9, 1.03, 1, 1, 0.98] }) },
              ],
            },
          ]}
        >
          {/* Marcas de registro, como nos cartazes */}
          <Text style={[styles.cross, { left: 8 }]} allowFontScaling={false}>+</Text>
          <Text style={[styles.cross, { right: 8 }]} allowFontScaling={false}>+</Text>

          {/* Disco com o rei do vencedor (ou os dois reis no empate) */}
          <View
            style={[
              styles.disc,
              {
                width: disc,
                height: disc,
                borderRadius: disc / 2,
                top: -disc / 2,
                left: cardW / 2 - disc / 2 - 1.5,
                backgroundColor: confetti ? colors.red : colors.surfaceAlt,
              },
            ]}
          >
            {winner ? (
              <Piece setId={pieceSet} color={winner} type="k" size={disc * 0.72} />
            ) : (
              <View style={{ flexDirection: 'row' }}>
                <Piece setId={pieceSet} color="w" type="k" size={disc * 0.48} />
                <Piece setId={pieceSet} color="b" type="k" size={disc * 0.48} />
              </View>
            )}
          </View>

          <Text
            style={[styles.kicker, { color: accent, fontSize: Math.max(8, Math.min(11, size * 0.032)) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
          >
            {confetti ? 'FIM DE PARTIDA —' : 'PARTIDA ENCERRADA —'}
          </Text>
          <Text
            style={[styles.cardTitle, { fontSize: titleFont, lineHeight: titleFont * 1.02 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
          >
            {title.toUpperCase()}
          </Text>
          <View style={[styles.cardRule, { backgroundColor: accent }]} />
          <Text
            style={[styles.resultText, { fontSize: fitFont(subtitle, cardW - 40, 14, 9, 0.2) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
          >
            {subtitle}
          </Text>
        </Animated.View>
      </View>

      {pieces.map((c, i) => {
        const t = p.interpolate({
          inputRange: [0, c.start, Math.min(1, c.start + 0.7), 1],
          outputRange: [0, 0, 1, 1],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: c.x,
              top: -20,
              width: c.w,
              height: c.h,
              borderRadius: 2,
              backgroundColor: c.color,
              opacity: t.interpolate({ inputRange: [0, 0.01, 0.85, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, size + 40] }) },
                // balança de um lado para o outro enquanto cai
                {
                  translateX: t.interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: [0, c.sway, c.drift * 0.5, -c.sway + c.drift, c.drift],
                  }),
                },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  layer: {
    overflow: 'hidden',
    zIndex: 20,
  },
  centerAll: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
  },
  brillPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 3,
    paddingRight: 12,
    gap: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  brillGlyphWrap: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brillGlyph: {
    fontWeight: '900',
    includeFontPadding: false,
    letterSpacing: -0.5,
  },
  brillText: {
    flex: 1,
    color: '#fff',
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    letterSpacing: 1.6,
    paddingLeft: 1.6, // compensa o espaço que o letterSpacing deixa depois da última letra
    textAlign: 'center',
    includeFontPadding: false,
  },
  mateBand: {
    position: 'absolute',
    backgroundColor: 'rgba(229, 36, 43, 0.9)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  mateKicker: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.condensed,
    fontWeight: '800',
    letterSpacing: 4,
    paddingLeft: 4,
    marginBottom: 1,
    includeFontPadding: false,
  },
  mateText: {
    color: '#fff',
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    letterSpacing: 3,
    paddingLeft: 3,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  cross: {
    position: 'absolute',
    top: 4,
    color: colors.red,
    fontSize: 18,
    fontWeight: '300',
    includeFontPadding: false,
  },
  disc: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: fonts.condensed,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 2.6,
    paddingLeft: 2.6,
    includeFontPadding: false,
  },
  cardTitle: {
    alignSelf: 'stretch',
    color: colors.ink,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    letterSpacing: 1,
    paddingLeft: 1,
    textAlign: 'center',
    marginTop: 6,
    includeFontPadding: false,
  },
  cardRule: {
    width: 40,
    height: 2,
    marginTop: 12,
    marginBottom: 10,
  },
  resultText: {
    color: colors.textDim,
    fontStyle: 'italic',
    fontSize: 14,
    includeFontPadding: false,
  },
}));
