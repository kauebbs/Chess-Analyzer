import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { Chess, Square } from 'chess.js';
import Svg, { G, Line, Polygon } from 'react-native-svg';
import { Piece } from './Piece';
import { MoveBadge } from './MoveBadge';
import { MoveKind } from '../utils/moveClassifier';
import { BOARD_THEMES, BoardTheme, fonts } from '../theme';
import { AnimationPrefs, DEFAULT_ANIMATION, motionEasing, pieceDuration } from '../settings/animation';
import { playSound, soundForPosition } from '../services/sounds';

interface ArrowMove {
  from: string;
  to: string;
}

/** Seta no tabuleiro. `width` na escala do Lichess/chessground (64 = uma casa inteira). */
export interface BoardArrow {
  from: string;
  to: string;
  width: number;
  color: string;
  opacity: number;
}

interface PieceMove {
  code: string; // ex.: 'wN'
  from: string;
  to: string;
}

/** Mapa casa → peça a partir da parte de posição do FEN. */
function placement(fen: string): Record<string, string> {
  const map: Record<string, string> = {};
  fen
    .split(' ')[0]
    .split('/')
    .forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += parseInt(ch, 10);
        else {
          map[`${'abcdefgh'[f]}${8 - r}`] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
          f += 1;
        }
      }
    });
  return map;
}

interface PieceGhost {
  code: string;
  square: string;
}

interface BoardDiff {
  moves: PieceMove[];
  /** Peças que sumiram (capturas, en passant). */
  removed: PieceGhost[];
  /** Peças que surgiram sem origem (voltar uma captura). */
  added: PieceGhost[];
}

/**
 * Descobre quais peças "andaram" entre duas posições (serve para avançar, voltar,
 * roque, promoção e saltos maiores): cada peça que apareceu numa casa vem da casa vaga mais
 * próxima que tinha a mesma peça. O que sobra vira captura (some) ou peça que reaparece.
 */
function diffMoves(oldFen: string, newFen: string): BoardDiff {
  const before = placement(oldFen);
  const after = placement(newFen);
  const vacated = Object.keys(before).filter((sq) => after[sq] !== before[sq]);
  const appeared = Object.keys(after).filter((sq) => before[sq] !== after[sq]);
  const used = new Set<string>();
  const dist = (a: string, b: string) =>
    Math.hypot(a.charCodeAt(0) - b.charCodeAt(0), a.charCodeAt(1) - b.charCodeAt(1));

  const moves: PieceMove[] = [];
  const orphans: string[] = [];
  for (const to of appeared) {
    const code = after[to];
    const from = vacated
      .filter((sq) => !used.has(sq) && before[sq] === code)
      .sort((a, b) => dist(a, to) - dist(b, to))[0];
    if (from) {
      used.add(from);
      moves.push({ code, from, to });
    } else {
      orphans.push(to);
    }
  }

  // Promoção (ou voltar uma promoção): peão ↔ peça da mesma cor numa casa vizinha da última fileira
  const added: PieceGhost[] = [];
  for (const to of orphans) {
    const code = after[to];
    const from = vacated.find((sq) => {
      if (used.has(sq) || before[sq][0] !== code[0]) return false;
      const pawnInvolved = (before[sq][1] === 'P') !== (code[1] === 'P');
      const ranks = [sq[1], to[1]].sort().join('');
      const edge = code[0] === 'w' ? '78' : '12';
      return pawnInvolved && ranks === edge && Math.abs(sq.charCodeAt(0) - to.charCodeAt(0)) <= 1;
    });
    if (from) {
      used.add(from);
      moves.push({ code, from, to });
    } else {
      added.push({ code, square: to });
    }
  }

  const removed = vacated.filter((sq) => !used.has(sq)).map((sq) => ({ code: before[sq], square: sq }));
  return { moves, removed, added };
}


interface BoardViewProps {
  fen: string;
  size: number;
  onMove: (from: string, to: string) => void;
  lastMove?: ArrowMove | null;
  arrows?: BoardArrow[];
  flipped?: boolean;
  theme?: BoardTheme;
  pieceSet?: string;
  interactive?: boolean;
  /** Selo da classificação do último lance, no canto da peça que se moveu. */
  moveBadge?: { square: string; kind: MoveKind } | null;
  /** Cor para pintar as casas do último lance (ex.: cor da classificação). */
  lastMoveColor?: string | null;
  /** Preferências de animação (velocidade, estilo, efeitos). */
  animation?: AnimationPrefs;
  /** Véu branco translúcido por cima das casas e peças (modo variante). */
  veil?: boolean;
  /** Toca o som do lance quando a posição muda (padrão: sim). */
  sound?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

/**
 * Cada peça do tabuleiro é um "sprite" que vive enquanto a peça existir: avançar ou voltar só
 * anima a posição dele. Assim nada é recriado a cada lance e, se um lance novo chega no meio da
 * animação, a peça sai exatamente de onde está na tela (o próprio Animated continua do valor atual).
 */
interface Sprite {
  id: number;
  code: string;
  square: string;
  pos: Animated.ValueXY;
  opacity: Animated.Value;
  scale: Animated.Value;
  dying: boolean;
  moving: boolean;
}

let SPRITE_SEQ = 1;

function makeSprite(code: string, square: string, xy: { x: number; y: number }, visible = true): Sprite {
  return {
    id: SPRITE_SEQ++,
    code,
    square,
    pos: new Animated.ValueXY(xy),
    opacity: new Animated.Value(visible ? 1 : 0),
    scale: new Animated.Value(visible ? 1 : 0.6),
    dying: false,
    moving: false,
  };
}

function squareXY(square: string, sq: number, flipped: boolean) {
  const fileIdx = FILES.indexOf(square[0]);
  const rankIdx = RANKS.indexOf(square[1]);
  return { x: (flipped ? 7 - fileIdx : fileIdx) * sq, y: (flipped ? 7 - rankIdx : rankIdx) * sq };
}

/** Distância (px) que o dedo precisa andar para virar arraste em vez de toque. */
const DRAG_THRESHOLD = 6;

interface GestureState {
  startX: number;
  startY: number;
  from: Square | null;
  canDrag: boolean;
  dragging: boolean;
  wasSelected: boolean;
  hover: Square | null;
}

const BoardViewBase: React.FC<BoardViewProps> = ({
  fen,
  size,
  onMove,
  lastMove,
  arrows = [],
  flipped = false,
  theme = BOARD_THEMES[0],
  pieceSet = 'staunty',
  interactive = true,
  moveBadge = null,
  lastMoveColor = null,
  animation = DEFAULT_ANIMATION,
  veil = false,
  sound = true,
}) => {
  const native = Platform.OS !== 'web';
  const duration = pieceDuration(animation.pieceSpeed);
  const sq = size / 8;
  const lift = Platform.OS === 'web' ? 0 : sq * 0.45; // no toque, a peça sobe acima do dedo

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const gestureRef = useRef<GestureState | null>(null);

  const game = useMemo(() => new Chess(fen), [fen]);
  const board = useMemo(() => game.board(), [game]);

  // ---------- Peças (sprites) ----------
  const skipAnimRef = useRef(false); // no arraste a peça já está no destino
  const xy = (square: string) => squareXY(square, sq, flipped);
  const spritesRef = useRef<Sprite[] | null>(null);
  if (!spritesRef.current) {
    spritesRef.current = Object.entries(placement(fen)).map(([square, code]) => makeSprite(code, square, xy(square)));
  }
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  // Enquanto as peças andam, setas e selo ficam escondidos
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFenRef = useRef(fen);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const animCfg = useRef({ duration, animation, native });
  animCfg.current = { duration, animation, native };

  // Quando a posição muda: limpa a seleção (a animação é montada logo abaixo, antes de pintar)
  const [lastFen, setLastFen] = useState(fen);
  if (lastFen !== fen) {
    setLastFen(fen);
    setSelectedSquare(null);
    setDragFrom(null);
    setHoverSquare(null);
  }

  useLayoutEffect(() => {
    const prevFen = prevFenRef.current;
    if (prevFen === fen) return;
    prevFenRef.current = fen;
    const { duration: ms, animation: prefs, native: useNative } = animCfg.current;
    const skip = skipAnimRef.current || ms === 0;
    skipAnimRef.current = false;

    const diff = diffMoves(prevFen, fen);
    const animate = !skip && diff.moves.length <= 12;

    // Som do lance (um lance só; saltos grandes como "ir para o início" ficam em silêncio)
    if (soundRef.current && diff.moves.length > 0 && diff.moves.length <= 2) {
      const before = placement(prevFen);
      playSound(
        soundForPosition(fen, {
          captured: diff.removed.length > 0,
          castled: diff.moves.length === 2 && diff.moves.some((m) => m.code[1] === 'K'),
          promoted: diff.moves.some((m) => before[m.from]?.[1] === 'P' && m.code[1] !== 'P'),
        })
      );
    }
    const fade = animate && prefs.captureEffect;
    const easing = motionEasing(prefs.motionStyle);
    const after = placement(fen);

    const current = spritesRef.current ?? [];
    const dying = current.filter((sp) => sp.dying);
    const bySquare = new Map(current.filter((sp) => !sp.dying).map((sp) => [sp.square, sp]));
    const next: Sprite[] = [];
    const taken = new Set<string>();

    const moveTo = (sp: Sprite, square: string) => {
      sp.square = square;
      if (animate) {
        sp.moving = true;
        Animated.timing(sp.pos, { toValue: xy(square), duration: ms, easing, useNativeDriver: useNative }).start(
          ({ finished }) => {
            if (finished) sp.moving = false;
          }
        );
      } else {
        sp.pos.stopAnimation();
        sp.pos.setValue(xy(square));
        sp.moving = false;
      }
    };

    // 1. Peças que andaram (também roque, promoção e saltos de vários lances)
    const fromSquares = new Set(diff.moves.map((m) => m.from));
    for (const m of diff.moves) {
      const sp = bySquare.get(m.from) ?? makeSprite(m.code, m.from, xy(m.from));
      sp.code = m.code;
      moveTo(sp, m.to);
      next.push(sp);
      taken.add(m.to);
    }
    for (const sqName of fromSquares) bySquare.delete(sqName);

    // 2. Peças capturadas: encolhem e somem
    for (const g of diff.removed) {
      const sp = bySquare.get(g.square);
      if (!sp) continue;
      bySquare.delete(g.square);
      if (!fade) continue;
      sp.dying = true;
      sp.moving = false;
      dying.push(sp);
      Animated.parallel([
        Animated.timing(sp.opacity, { toValue: 0, duration: ms, easing: Easing.in(Easing.quad), useNativeDriver: useNative }),
        Animated.timing(sp.scale, { toValue: 0.55, duration: ms, useNativeDriver: useNative }),
      ]).start(() => {
        spritesRef.current = (spritesRef.current ?? []).filter((x) => x !== sp);
        rerender();
      });
    }

    // 3. Peças paradas continuam (se ainda estavam terminando um movimento, terminam sozinhas)
    for (const [square, sp] of bySquare) {
      if (after[square] === sp.code && !taken.has(square)) {
        next.push(sp);
        taken.add(square);
      }
    }

    // 4. Peças que reaparecem (voltar uma captura) e qualquer casa que ficou sem peça
    for (const [square, code] of Object.entries(after)) {
      if (taken.has(square)) continue;
      const sp = makeSprite(code, square, xy(square), !fade);
      if (fade) {
        Animated.parallel([
          Animated.timing(sp.opacity, { toValue: 1, duration: ms, useNativeDriver: useNative }),
          Animated.timing(sp.scale, { toValue: 1, duration: ms, easing: Easing.out(Easing.back(1.4)), useNativeDriver: useNative }),
        ]).start();
      }
      next.push(sp);
      taken.add(square);
    }

    spritesRef.current = [...dying, ...next];
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (animate && (diff.moves.length > 0 || diff.added.length > 0)) {
      setSettling(true);
      settleTimer.current = setTimeout(() => setSettling(false), ms + 40);
    } else {
      setSettling(false);
    }
    rerender();
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Girar o tabuleiro ou mudar o tamanho: reposiciona tudo na hora
  useEffect(() => {
    for (const sp of spritesRef.current ?? []) {
      sp.pos.stopAnimation();
      sp.pos.setValue(xy(sp.square));
    }
    rerender();
  }, [flipped, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  // Véu do modo variante (entra e sai com fade)
  const veilOpacity = useRef(new Animated.Value(veil ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(veilOpacity, {
      toValue: veil ? 1 : 0,
      duration: duration === 0 ? 0 : 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: native,
    }).start();
  }, [veil]); // eslint-disable-line react-hooks/exhaustive-deps

  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    return game.moves({ square: selectedSquare, verbose: true });
  }, [game, selectedSquare]);

  const checkSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    const turn = game.turn();
    for (const row of board) {
      for (const p of row) {
        if (p && p.type === 'k' && p.color === turn) return p.square;
      }
    }
    return null;
  }, [game, board]);

  const squareAt = (x: number, y: number): Square | null => {
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    const col = Math.floor(x / sq);
    const row = Math.floor(y / sq);
    const fileIdx = flipped ? 7 - col : col;
    const rankIdx = flipped ? 7 - row : row;
    return `${FILES[fileIdx]}${RANKS[rankIdx]}` as Square;
  };

  const squareOrigin = (square: string) => {
    const fileIdx = FILES.indexOf(square[0]);
    const rankIdx = RANKS.indexOf(square[1]);
    const col = flipped ? 7 - fileIdx : fileIdx;
    const row = flipped ? 7 - rankIdx : rankIdx;
    return { x: col * sq, y: row * sq };
  };

  const isOwnPiece = (square: Square) => {
    const piece = game.get(square);
    return !!piece && piece.color === game.turn();
  };

  const isLegal = (from: Square, to: Square) =>
    game.moves({ square: from, verbose: true }).some((m) => m.to === to);

  const handleTap = (square: Square, wasSelected: boolean) => {
    if (isOwnPiece(square)) {
      // Tocar de novo na peça já selecionada desmarca
      setSelectedSquare(wasSelected ? null : square);
      return;
    }
    if (selectedSquare && isLegal(selectedSquare, square)) {
      onMove(selectedSquare, square);
    }
    setSelectedSquare(null);
  };

  const finishDrag = (from: Square, target: Square | null) => {
    setHoverSquare(null);

    if (target && target !== from && isLegal(from, target)) {
      setDragFrom(null);
      setSelectedSquare(null);
      skipAnimRef.current = true;
      onMove(from, target);
      return;
    }

    // Lance inválido: a peça volta para a casa de origem (e continua selecionada)
    Animated.timing(dragPos, {
      toValue: squareOrigin(from),
      duration: 140,
      useNativeDriver: false,
    }).start(() => setDragFrom(null));
  };

  // O PanResponder é criado uma vez; esta ref sempre aponta para os dados da renderização atual
  const live = useRef({ squareAt, isOwnPiece, handleTap, finishDrag, selectedSquare, sq, lift });
  live.current = { squareAt, isOwnPiece, handleTap, finishDrag, selectedSquare, sq, lift };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const L = live.current;
        const { locationX, locationY } = e.nativeEvent;
        const from = L.squareAt(locationX, locationY);
        const canDrag = !!from && L.isOwnPiece(from);
        const wasSelected = !!from && L.selectedSquare === from;

        gestureRef.current = {
          startX: locationX,
          startY: locationY,
          from,
          canDrag,
          dragging: false,
          wasSelected,
          hover: from,
        };

        // Selecionar já no toque deixa os lances legais visíveis durante o arraste
        if (canDrag && from) setSelectedSquare(from);
      },

      onPanResponderMove: (_, g) => {
        const gr = gestureRef.current;
        const L = live.current;
        if (!gr || !gr.canDrag || !gr.from) return;

        if (!gr.dragging) {
          if (Math.hypot(g.dx, g.dy) < DRAG_THRESHOLD) return;
          gr.dragging = true;
          setDragFrom(gr.from);
        }

        const x = gr.startX + g.dx;
        const y = gr.startY + g.dy;
        dragPos.setValue({ x: x - L.sq / 2, y: y - L.sq / 2 - L.lift });

        const hover = L.squareAt(x, y);
        if (hover !== gr.hover) {
          gr.hover = hover;
          setHoverSquare(hover);
        }
      },

      onPanResponderRelease: (_, g) => {
        const gr = gestureRef.current;
        gestureRef.current = null;
        const L = live.current;
        if (!gr || !gr.from) {
          setSelectedSquare(null);
          return;
        }

        if (gr.dragging) {
          L.finishDrag(gr.from, L.squareAt(gr.startX + g.dx, gr.startY + g.dy));
        } else {
          L.handleTap(gr.from, gr.wasSelected);
        }
      },

      onPanResponderTerminate: () => {
        const gr = gestureRef.current;
        gestureRef.current = null;
        if (gr?.dragging && gr.from) live.current.finishDrag(gr.from, null);
      },
    })
  ).current;

  const getSquareCenter = (square: string) => {
    const o = squareOrigin(square);
    return { x: o.x + sq / 2, y: o.y + sq / 2 };
  };

  const renderArrow = (
    move: ArrowMove,
    color: string,
    strokeWidth: number,
    headLen: number,
    opacity: number
  ) => {
    if (!move.from || !move.to || move.from === move.to) return null;

    const start = getSquareCenter(move.from);
    const end = getSquareCenter(move.to);
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist < 1) return null;

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const startOffset = sq * 0.18;
    const headBaseDist = headLen * 0.78;
    const spread = Math.PI / 5.5;

    const p1 = `${end.x},${end.y}`;
    const p2 = `${end.x - headLen * Math.cos(angle - spread)},${end.y - headLen * Math.sin(angle - spread)}`;
    const p3 = `${end.x - headLen * Math.cos(angle + spread)},${end.y - headLen * Math.sin(angle + spread)}`;

    return (
      <G opacity={opacity}>
        <Line
          x1={start.x + startOffset * Math.cos(angle)}
          y1={start.y + startOffset * Math.sin(angle)}
          x2={end.x - headBaseDist * Math.cos(angle)}
          y2={end.y - headBaseDist * Math.sin(angle)}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        <Polygon points={`${p1} ${p2} ${p3}`} fill={color} />
      </G>
    );
  };

  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const draggedPiece = dragFrom ? game.get(dragFrom) : null;
  const coordFont = Math.max(8, sq * 0.17);

  return (
    <View style={[styles.frame, { borderColor: theme.frame }]}>
      <View style={{ width: size, height: size }} {...(interactive ? panResponder.panHandlers : {})}>
        {/* Casas e peças (não recebem toques; quem trata é o PanResponder do tabuleiro) */}
        <View style={styles.noTouch}>
          {displayRanks.map((rank, rIdx) => (
            <View key={rank} style={{ flexDirection: 'row', height: sq }}>
              {displayFiles.map((file, fIdx) => {
                const square = `${file}${rank}` as Square;
                const rankIdx = RANKS.indexOf(rank);
                const fileIdx = FILES.indexOf(file);
                const isLight = (rankIdx + fileIdx) % 2 === 0;
                const piece = board[rankIdx][fileIdx];
                const moveOption = legalMoves.find((m) => m.to === square);
                const isLast = lastMove?.from === square || lastMove?.to === square;

                return (
                  <View
                    key={square}
                    style={[
                      styles.square,
                      { width: sq, height: sq, backgroundColor: isLight ? theme.light : theme.dark },
                    ]}
                  >
                    {isLast && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          lastMoveColor
                            ? { backgroundColor: lastMoveColor, opacity: 0.5 }
                            : { backgroundColor: theme.lastMove },
                        ]}
                      />
                    )}
                    {selectedSquare === square && (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.selected }]} />
                    )}
                    {checkSquare === square && <View style={[StyleSheet.absoluteFill, styles.check]} />}
                    {hoverSquare === square && dragFrom && (
                      <View style={[StyleSheet.absoluteFill, styles.hover]} />
                    )}

                    {fIdx === 0 && (
                      <Text
                        style={[
                          styles.coord,
                          styles.coordRank,
                          { fontSize: coordFont, color: isLight ? theme.dark : theme.light },
                        ]}
                      >
                        {rank}
                      </Text>
                    )}
                    {rIdx === 7 && (
                      <Text
                        style={[
                          styles.coord,
                          styles.coordFile,
                          { fontSize: coordFont, color: isLight ? theme.dark : theme.light },
                        ]}
                      >
                        {file}
                      </Text>
                    )}

                    {moveOption && !piece && (
                      <View
                        style={{
                          position: 'absolute',
                          width: sq * 0.3,
                          height: sq * 0.3,
                          borderRadius: sq,
                          backgroundColor: theme.hint,
                        }}
                      />
                    )}
                    {moveOption && piece && (
                      <View
                        style={{
                          position: 'absolute',
                          width: sq * 0.92,
                          height: sq * 0.92,
                          borderRadius: sq,
                          borderWidth: Math.max(3, sq * 0.08),
                          borderColor: theme.hint,
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Peças */}
        <View style={[StyleSheet.absoluteFill, styles.noTouch]}>
          {(spritesRef.current ?? []).map((sp) => (
            <SpriteView
              key={sp.id}
              sprite={sp}
              code={sp.code}
              sq={sq}
              pieceSet={pieceSet}
              dim={!!dragFrom && dragFrom === sp.square && !sp.dying}
              layer={sp.dying ? 1 : sp.moving ? 3 : 2}
            />
          ))}
        </View>

        {/* Véu branco do modo variante: por cima das casas e peças, por baixo das setas e do selo */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.noTouch, styles.veil, { opacity: veilOpacity }]}
        />

        {arrows.length > 0 && !dragFrom && !settling && (
          <FadeIn key={`arrows-${fen}`} enabled={animation.arrowFade && duration > 0} style={[StyleSheet.absoluteFill, styles.noTouch, { zIndex: 9 }]}>
            <Svg width={size} height={size} pointerEvents="none">
              {arrows.map((a, i) => {
                const stroke = (sq * a.width) / 64;
                return (
                  <React.Fragment key={`${a.from}${a.to}${i}`}>
                    {renderArrow(a, a.color, stroke, sq * 0.1 + stroke * 1.4, a.opacity)}
                  </React.Fragment>
                );
              })}
            </Svg>
          </FadeIn>
        )}

        {/* Selo do lance no canto superior direito da peça */}
        {moveBadge && !dragFrom && !settling && (() => {
          const b = Math.round(sq * 0.42);
          const o = squareOrigin(moveBadge.square);
          const left = Math.min(size - b, o.x + sq - b * 0.72);
          const top = Math.max(0, o.y - b * 0.28);
          return (
            <PopIn
              key={`badge-${fen}-${moveBadge.kind}`}
              enabled={animation.badgePop && duration > 0}
              style={[styles.noTouch, { position: 'absolute', left, top, zIndex: 9 }]}
            >
              <MoveBadge kind={moveBadge.kind} size={b} outlined />
            </PopIn>
          );
        })()}

        {/* Peça sendo arrastada */}
        {draggedPiece && (
          <Animated.View
            style={[
              styles.dragged,
              styles.noTouch,
              {
                width: sq,
                height: sq,
                transform: [...dragPos.getTranslateTransform(), { scale: 1.25 }],
              },
            ]}
          >
            <Piece setId={pieceSet} type={draggedPiece.type} color={draggedPiece.color} size={sq * 0.92} />
          </Animated.View>
        )}
      </View>
    </View>
  );
};

/** Uma peça no tabuleiro (só redesenha quando muda de tipo, de camada ou fica apagada no arraste). */
const SpriteView = React.memo(function SpriteView({
  sprite,
  code,
  sq,
  pieceSet,
  dim,
  layer,
}: {
  sprite: Sprite;
  code: string;
  sq: number;
  pieceSet: string;
  dim: boolean;
  layer: number;
}) {
  return (
    <Animated.View
      style={[
        styles.sprite,
        {
          width: sq,
          height: sq,
          zIndex: layer,
          opacity: sprite.opacity,
          transform: [...sprite.pos.getTranslateTransform(), { scale: sprite.scale }],
        },
      ]}
    >
      <View style={{ opacity: dim ? 0.25 : 1 }}>
        <Piece setId={pieceSet} color={code[0] as 'w' | 'b'} type={code[1].toLowerCase()} size={sq * 0.92} />
      </View>
    </Animated.View>
  );
});

/** Aparece com fade (setas do motor). */
function FadeIn({ enabled, style, children }: { enabled: boolean; style: any; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  useEffect(() => {
    if (!enabled) return;
    Animated.timing(v, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

/** Entra com um "pulo" (selo do lance). */
function PopIn({ enabled, style, children }: { enabled: boolean; style: any; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  useEffect(() => {
    if (!enabled) return;
    Animated.spring(v, { toValue: 1, friction: 4.5, tension: 170, useNativeDriver: Platform.OS !== 'web' }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Só redesenha quando alguma prop muda (navegar não trava esperando a tela inteira). */
export const BoardView = React.memo(BoardViewBase);

const styles = StyleSheet.create({
  frame: {
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  noTouch: {
    pointerEvents: 'none',
  },
  square: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    backgroundColor: 'rgba(229, 36, 43, 0.55)',
    borderRadius: 999,
    transform: [{ scale: 0.95 }],
  },
  hover: {
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  coord: {
    position: 'absolute',
    userSelect: 'none', // evita selecionar o texto ao arrastar com o mouse (web)
    fontFamily: fonts.condensed,
    fontWeight: '700',
  },
  coordRank: {
    top: 1,
    left: 3,
  },
  coordFile: {
    bottom: 0,
    right: 3,
  },
  veil: {
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    zIndex: 8,
  },
  sprite: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  animPiece: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  dragged: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 12,
  },
});
