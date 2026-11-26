import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Sheet } from './Sheet';
import { Piece } from './Piece';
import { BoardView } from './BoardView';
import { Celebration, CelebrationEvent } from './Celebration';
import { BOARD_THEMES, colors, fonts, ThemeMode, themed } from '../theme';
import { PIECE_SETS } from '../pieces/pieceSets';
import {
  AnimationPrefs,
  celebrationAllowed,
  DEFAULT_ANIMATION,
  INTENSITY_OPTIONS,
  MOTION_STYLE_OPTIONS,
  PIECE_SPEED_OPTIONS,
} from '../settings/animation';
import { playSound, SoundName, SoundPrefs, SoundVolume } from '../services/sounds';
import { Icon } from './Icon';
import { AboutSection } from './AboutSection';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  showArrows: boolean;
  onShowArrowsChange: (v: boolean) => void;
  themeIdx: number;
  onThemeChange: (idx: number) => void;
  pieceSet: string;
  onPieceSetChange: (id: string) => void;
  variantVeil: boolean;
  onVariantVeilChange: (v: boolean) => void;
  animation: AnimationPrefs;
  onAnimationChange: (a: AnimationPrefs) => void;
  sound: SoundPrefs;
  onSoundChange: (s: SoundPrefs) => void;
  appTheme: ThemeMode;
  onAppThemeChange: (m: ThemeMode) => void;
  /** Troca de tema esperando a partida em andamento acabar. */
  themePending: boolean;
}

type Tab = 'board' | 'animation' | 'sound' | 'about';

// Prévia: 1.e4 d5 → 2.exd5 (mostra deslize, captura e o selo do lance)
const PREVIEW_A = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
const PREVIEW_B = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
const PREVIEW_SIZE = 192;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  showArrows,
  onShowArrowsChange,
  themeIdx,
  onThemeChange,
  pieceSet,
  onPieceSetChange,
  variantVeil,
  onVariantVeilChange,
  animation,
  onAnimationChange,
  sound,
  onSoundChange,
  appTheme,
  onAppThemeChange,
  themePending,
}) => {
  const [tab, setTab] = useState<Tab>('board');
  const theme = BOARD_THEMES[themeIdx];
  const currentSet = PIECE_SETS.find((s) => s.id === pieceSet) ?? PIECE_SETS[0];
  const set = <K extends keyof AnimationPrefs>(key: K, value: AnimationPrefs[K]) =>
    onAnimationChange({ ...animation, [key]: value });

  return (
    <Sheet visible={visible} title="Configurações" onClose={onClose}>
      <View style={styles.tabs}>
        {(
          [
            ['board', 'TABULEIRO'],
            ['animation', 'ANIMAÇÕES'],
            ['sound', 'SONS'],
            ['about', 'SOBRE'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {tab === 'about' ? (
          <AboutSection />
        ) : tab === 'sound' ? (
          <>
            <ToggleRow
              title="Sons"
              hint="Lances, capturas, xeque, roque, promoção, início e fim de partida e mensagens"
              value={sound.enabled}
              onChange={(v) => onSoundChange({ ...sound, enabled: v })}
            />
            <Text style={styles.label}>Volume</Text>
            <Segment
              options={[
                { id: 'low' as SoundVolume, label: 'Baixo' },
                { id: 'mid' as SoundVolume, label: 'Médio' },
                { id: 'high' as SoundVolume, label: 'Alto' },
              ]}
              value={sound.volume}
              onChange={(v) => {
                onSoundChange({ ...sound, volume: v });
                setTimeout(() => playSound('move'), 30);
              }}
              disabled={!sound.enabled}
            />
            <Text style={styles.section}>OUVIR</Text>
            <View style={styles.soundGrid}>
              {(
                [
                  ['move', 'Lance'],
                  ['capture', 'Captura'],
                  ['check', 'Xeque'],
                  ['castle', 'Roque'],
                  ['promote', 'Promoção'],
                  ['start', 'Início'],
                  ['end', 'Fim'],
                  ['chat', 'Mensagem'],
                  ['lowtime', 'Pouco tempo'],
                ] as [SoundName, string][]
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  disabled={!sound.enabled}
                  onPress={() => playSound(id)}
                  style={({ pressed }) => [styles.soundBtn, pressed && { backgroundColor: colors.border }, !sound.enabled && { opacity: 0.35 }]}
                >
                  <Icon name="play" size={13} color={colors.mint} />
                  <Text style={styles.soundText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : tab === 'board' ? (
          <>
            <Text style={[styles.section, { marginTop: 4 }]}>TEMA DO APP</Text>
            <Segment
              options={[
                { id: 'light' as ThemeMode, label: 'Claro' },
                { id: 'dark' as ThemeMode, label: 'Escuro' },
                { id: 'system' as ThemeMode, label: 'Sistema' },
              ]}
              value={appTheme}
              onChange={onAppThemeChange}
            />
            <Text style={styles.themeHint}>
              {themePending
                ? 'O tema muda assim que a partida em andamento acabar.'
                : 'Escuro é o negativo do cartaz: fundo quase preto e tinta creme. "Sistema" segue o celular.'}
            </Text>
            <ToggleRow
              title="Setas do motor"
              hint="Mostra o melhor lance e as boas alternativas no tabuleiro"
              value={showArrows}
              onChange={onShowArrowsChange}
            />
            <ToggleRow
              title="Véu no modo variante"
              hint="Clareia o tabuleiro quando você sai da partida original"
              value={variantVeil}
              onChange={onVariantVeilChange}
            />

            <Text style={styles.section}>TEMA DO TABULEIRO</Text>
            <View style={styles.grid}>
              {BOARD_THEMES.map((t, i) => (
                <Pressable key={t.name} onPress={() => onThemeChange(i)} style={styles.option}>
                  <View style={[styles.mini, i === themeIdx && styles.selected]}>
                    <View style={styles.miniRow}>
                      <View style={[styles.miniSq, { backgroundColor: t.light }]} />
                      <View style={[styles.miniSq, { backgroundColor: t.dark }]} />
                    </View>
                    <View style={styles.miniRow}>
                      <View style={[styles.miniSq, { backgroundColor: t.dark }]} />
                      <View style={[styles.miniSq, { backgroundColor: t.light }]} />
                    </View>
                  </View>
                  <Text style={[styles.optionLabel, i === themeIdx && styles.optionLabelActive]}>{t.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.section}>PEÇAS</Text>
            <View style={styles.grid}>
              {PIECE_SETS.map((ps) => (
                <Pressable key={ps.id} onPress={() => onPieceSetChange(ps.id)} style={styles.option}>
                  <View
                    style={[styles.piecePreview, { backgroundColor: theme.light }, ps.id === pieceSet && styles.selected]}
                  >
                    <View style={[styles.pieceHalf, { backgroundColor: theme.light }]}>
                      <Piece setId={ps.id} color="w" type="n" size={34} />
                    </View>
                    <View style={[styles.pieceHalf, { backgroundColor: theme.dark }]}>
                      <Piece setId={ps.id} color="b" type="q" size={34} />
                    </View>
                  </View>
                  <Text style={[styles.optionLabel, ps.id === pieceSet && styles.optionLabelActive]}>{ps.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.credit}>Peças: {currentSet.credit}</Text>
          </>
        ) : (
          <>
            <AnimationPreview animation={animation} themeIdx={themeIdx} pieceSet={pieceSet} />

            <Text style={styles.section}>MOVIMENTO DAS PEÇAS</Text>
            <Text style={styles.label}>Velocidade</Text>
            <Segment options={PIECE_SPEED_OPTIONS} value={animation.pieceSpeed} onChange={(v) => set('pieceSpeed', v)} />
            <Text style={styles.label}>Estilo</Text>
            <Segment
              options={MOTION_STYLE_OPTIONS}
              value={animation.motionStyle}
              onChange={(v) => set('motionStyle', v)}
              disabled={animation.pieceSpeed === 'off'}
            />

            <Text style={styles.section}>DETALHES</Text>
            <View style={styles.stack}>
              <ToggleRow
                title="Efeito de captura"
                hint="A peça capturada encolhe e some; ao voltar o lance ela reaparece"
                value={animation.captureEffect}
                onChange={(v) => set('captureEffect', v)}
              />
              <ToggleRow
                title="Selo do lance com pulo"
                hint="O ícone (!!, ?, ★…) aparece na peça com um pulinho"
                value={animation.badgePop}
                onChange={(v) => set('badgePop', v)}
              />
              <ToggleRow
                title="Setas suaves"
                hint="As setas do motor surgem com fade"
                value={animation.arrowFade}
                onChange={(v) => set('arrowFade', v)}
              />
              <ToggleRow
                title="Barra de avaliação deslizando"
                hint="A barra corre até o novo valor em vez de pular"
                value={animation.evalBarSmooth}
                onChange={(v) => set('evalBarSmooth', v)}
              />
            </View>

            <Text style={styles.section}>COMEMORAÇÕES</Text>
            <View style={styles.stack}>
              <ToggleRow
                title="Lance brilhante"
                hint="Faíscas e anéis na casa do lance"
                value={animation.celebrateBrilliant}
                onChange={(v) => set('celebrateBrilliant', v)}
              />
              <ToggleRow
                title="Xeque-mate"
                hint="Ondas vermelhas no rei e o texto na tela"
                value={animation.celebrateCheckmate}
                onChange={(v) => set('celebrateCheckmate', v)}
              />
              <ToggleRow
                title="Vitória e empate"
                hint="Faixa com o resultado e confete para quem venceu"
                value={animation.celebrateVictory}
                onChange={(v) => set('celebrateVictory', v)}
              />
            </View>
            <Text style={styles.label}>Intensidade dos efeitos</Text>
            <Segment options={INTENSITY_OPTIONS} value={animation.intensity} onChange={(v) => set('intensity', v)} />

            <Pressable
              onPress={() => onAnimationChange(DEFAULT_ANIMATION)}
              style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.resetText}>Restaurar padrão</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
};

/** Mini tabuleiro para testar as animações na hora. */
function AnimationPreview({ animation, themeIdx, pieceSet }: { animation: AnimationPrefs; themeIdx: number; pieceSet: string }) {
  const [atB, setAtB] = useState(false);
  const [event, setEvent] = useState<CelebrationEvent | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const play = (ev: CelebrationEvent) => {
    if (!celebrationAllowed(animation, ev.type)) {
      setNote('Essa comemoração está desligada');
      setTimeout(() => setNote(null), 1600);
      return;
    }
    setEvent(ev);
  };

  return (
    <View style={styles.previewCard}>
      <View style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}>
        <BoardView
          fen={atB ? PREVIEW_B : PREVIEW_A}
          size={PREVIEW_SIZE}
          onMove={() => {}}
          interactive={false}
          theme={BOARD_THEMES[themeIdx]}
          pieceSet={pieceSet}
          lastMove={atB ? { from: 'e4', to: 'd5' } : { from: 'd7', to: 'd5' }}
          moveBadge={atB ? { square: 'd5', kind: 'best' } : null}
          animation={animation}
        />
        <Celebration
          event={event}
          size={PREVIEW_SIZE}
          flipped={false}
          intensity={animation.intensity}
          pieceSet={pieceSet}
          onDone={(id) => setEvent((e) => (e?.id === id ? null : e))}
        />
      </View>
      <View style={styles.previewBtns}>
        <PreviewBtn label={atB ? 'Voltar lance' : 'Jogar lance'} onPress={() => setAtB((v) => !v)} />
        <PreviewBtn label="Brilhante" onPress={() => play({ id: Date.now(), type: 'brilliant', square: 'd5' })} />
        <PreviewBtn label="Xeque-mate" onPress={() => play({ id: Date.now(), type: 'checkmate', square: 'e8' })} />
        <PreviewBtn
          label="Vitória"
          onPress={() =>
            play({ id: Date.now(), type: 'victory', winner: 'w', title: 'VOCÊ VENCEU!', subtitle: '1-0 · XEQUE-MATE' })
          }
        />
      </View>
      <Text style={styles.previewNote}>{note ?? 'Toque para testar as animações com suas configurações'}</Text>
    </View>
  );
}

function PreviewBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.previewBtn, pressed && { backgroundColor: colors.border }]}>
      <Text style={styles.previewBtnText}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.mintDark }}
        thumbColor={value ? colors.mint : colors.textDim}
      />
    </View>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.segment, disabled && { opacity: 0.35 }]}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          disabled={disabled}
          onPress={() => onChange(o.id)}
          style={[styles.segItem, value === o.id && styles.segItemActive]}
        >
          <Text style={[styles.segText, value === o.id && styles.segTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  themeHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
    marginBottom: 14,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 4,
    padding: 3,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 4,
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
  },
  tabText: {
    color: colors.textDim,
    fontFamily: fonts.condensed,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: colors.text,
  },
  stack: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: 4,
    padding: 14,
    marginBottom: 8,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    color: colors.textDim,
    fontFamily: fonts.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.8,
    marginTop: 18,
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 4,
    padding: 3,
    marginBottom: 10,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 4,
  },
  segItemActive: {
    backgroundColor: colors.red,
  },
  segText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  segTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  option: {
    alignItems: 'center',
    gap: 6,
  },
  mini: {
    width: 52,
    height: 52,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  miniRow: {
    flex: 1,
    flexDirection: 'row',
  },
  miniSq: {
    flex: 1,
  },
  selected: {
    borderColor: colors.mint,
  },
  optionLabel: {
    color: colors.textDim,
    fontSize: 12,
  },
  optionLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  piecePreview: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pieceHalf: {
    width: 42,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  credit: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 18,
    marginBottom: 4,
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  previewBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  previewBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  previewBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  previewNote: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
  soundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  soundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  soundText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  resetBtn: {
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resetText: {
    color: colors.textDim,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
}));
