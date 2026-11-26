import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  Appearance,
  Easing,
  Linking,
  PanResponder,
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MainMenu, MenuAction } from './src/screens/MainMenu';
import type { AnalysisSummary } from './src/screens/AnalysisScreen';
import { AnalyzeHub } from './src/screens/AnalyzeHub';
import { AnalysisScreen } from './src/screens/AnalysisScreen';
import { OnlineScreen } from './src/screens/OnlineScreen';
import { PlayAction, PlayScreen } from './src/screens/PlayScreen';
import { NavBar, NavTab } from './src/components/NavBar';
import { SettingsModal } from './src/components/SettingsModal';
import { codeFromUrl } from './src/online/gameService';
import { tournamentCodeFromUrl } from './src/online/tournamentService';
import { BOARD_THEMES, colors, DEFAULT_THEME_IDX, applyPalette, isDark, ThemeMode, themed } from './src/theme';
import { AnimationPrefs, DEFAULT_ANIMATION, normalizeAnimation } from './src/settings/animation';
import { configureSounds, DEFAULT_SOUND, preloadSounds, SoundPrefs } from './src/services/sounds';

const PREFS_KEY = 'prefs:v1';

// Telas pesadas só redesenham quando as props delas mudam (trocar de aba fica leve)
const MainMenuM = React.memo(MainMenu);
const AnalysisScreenM = React.memo(AnalysisScreen);
const OnlineScreenM = React.memo(OnlineScreen);
const PlayScreenM = React.memo(PlayScreen);

type Screen = 'menu' | 'analyze' | 'analysis' | 'online' | 'play';

/** Abas que dá para percorrer deslizando para os lados (Ajustes abre por toque). */
const SWIPE_TABS: NavTab[] = ['home', 'play', 'analyze', 'tournament'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [intent, setIntent] = useState<{ action: MenuAction; nonce: number } | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [loadRequest, setLoadRequest] = useState<{
    pgn: string;
    orientation: 'white' | 'black';
    nonce: number;
    silent?: boolean;
  } | null>(null);
  const [joinRequest, setJoinRequest] = useState<{ code: string; nonce: number; watch?: boolean } | null>(null);
  const [onlineMounted, setOnlineMounted] = useState(false);
  const [playMounted, setPlayMounted] = useState(false);
  const [playRequest, setPlayRequest] = useState<{ action: PlayAction; code?: string; nonce: number } | null>(null);
  // Barra de navegação: aparece no início, nos menus de jogo e no saguão online (some durante as partidas e na análise)
  const [playNav, setPlayNav] = useState<{ visible: boolean; tab: NavTab; root: boolean }>({
    visible: true,
    tab: 'play',
    root: true,
  });
  const [onlineNav, setOnlineNav] = useState(true);

  // Preferências (compartilhadas entre as telas)
  const [showArrows, setShowArrows] = useState(true);
  const [themeIdx, setThemeIdx] = useState(DEFAULT_THEME_IDX);
  const [pieceSet, setPieceSet] = useState('staunty');
  const [variantVeil, setVariantVeil] = useState(true);
  const [animation, setAnimation] = useState<AnimationPrefs>(DEFAULT_ANIMATION);
  const [sound, setSound] = useState<SoundPrefs>(DEFAULT_SOUND);
  const [themeMode, setThemeMode] = useState<ThemeMode>(isDark ? 'dark' : 'light');
  const [prefsReady, setPrefsReady] = useState(false);
  useEffect(() => configureSounds(sound), [sound]);
  useEffect(() => preloadSounds(), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const prefs = useMemo(
    () => ({ showArrows, themeIdx, pieceSet, variantVeil, animation, sound, themeMode }),
    [showArrows, themeIdx, pieceSet, variantVeil, animation, sound, themeMode]
  );

  // Preferências ficam salvas no aparelho
  const prefsLoaded = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.showArrows === 'boolean') setShowArrows(saved.showArrows);
        if (typeof saved.themeIdx === 'number' && saved.themeIdx >= 0 && saved.themeIdx < BOARD_THEMES.length) {
          setThemeIdx(saved.themeIdx);
        }
        if (typeof saved.pieceSet === 'string') setPieceSet(saved.pieceSet);
        if (typeof saved.variantVeil === 'boolean') setVariantVeil(saved.variantVeil);
        setAnimation(normalizeAnimation(saved.animation));
        if (saved.sound && typeof saved.sound.enabled === 'boolean') {
          setSound({ enabled: saved.sound.enabled, volume: ['low', 'mid', 'high'].includes(saved.sound.volume) ? saved.sound.volume : 'mid' });
        }
        if (['light', 'dark', 'system'].includes(saved.themeMode)) setThemeMode(saved.themeMode);
      })
      .catch(() => {})
      .finally(() => {
        prefsLoaded.current = true;
        setPrefsReady(true);
      });
  }, []);
  useEffect(() => {
    if (!prefsLoaded.current) return;
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [prefs]);

  const openOnline = useCallback(() => {
    setOnlineMounted(true);
    setScreen('online');
  }, []);
  // A tela Jogar já fica montada (escondida) pouco depois de abrir o app, para a primeira
  // ida até ela (tocando ou deslizando) não travar a animação
  useEffect(() => {
    const timer = setTimeout(() => setPlayMounted(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  const openPlay = useCallback((action: PlayAction, code?: string) => {
    setPlayMounted(true);
    setPlayRequest({ action, code, nonce: Date.now() });
    setScreen('play');
  }, []);

  // Convites por link: chessanalyzer://jogo/ABC123 ou https://...?jogo=ABC123
  useEffect(() => {
    const handle = (url: string | null | undefined) => {
      const tCode = tournamentCodeFromUrl(url);
      if (tCode) {
        openPlay('tournament', tCode);
        return;
      }
      const code = codeFromUrl(url);
      if (!code) return;
      setJoinRequest({ code, nonce: Date.now() });
      openOnline();
    };
    if (Platform.OS === 'web') {
      handle(typeof window !== 'undefined' ? window.location.href : null);
      if (typeof window !== 'undefined' && /jogo=|torneio=/.test(window.location.search)) {
        window.history.replaceState(null, '', window.location.pathname); // limpa o link da barra
      }
      return;
    }
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [openOnline, openPlay]);

  const goMenu = useCallback(() => setScreen('menu'), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const analyzePgn = useCallback((pgn: string, orientation: 'white' | 'black') => {
    setLoadRequest({ pgn, orientation, nonce: Date.now() });
    setScreen('analysis');
  }, []);
  const backToTournament = useCallback((code: string) => openPlay('tournament', code), [openPlay]);
  const openOnlineGame = useCallback(
    (code: string, watch?: boolean) => {
      setJoinRequest({ code, nonce: Date.now(), watch });
      openOnline();
    },
    [openOnline]
  );

  // Momento do último arrasto lateral: o toque que termina um deslize não deve virar clique
  const lastSwipeAt = useRef(0);
  const onMenuAction = useCallback((action: MenuAction) => {
    if (Date.now() - lastSwipeAt.current < 400) return;
    if (action === 'settings') {
      setSettingsOpen(true);
      return;
    }
    if (action === 'online') {
      openOnline();
      return;
    }
    if (action === 'bot' || action === 'botbot' || action === 'tournament') {
      openPlay(action);
      return;
    }
    if (action === 'play') {
      openPlay('hub');
      return;
    }
    if (action === 'analyze') {
      setScreen('analyze');
      return;
    }
    setIntent({ action, nonce: Date.now() });
    setScreen('analysis');
  }, [openOnline, openPlay]);

  const onSummaryChange = useCallback((s: AnalysisSummary | null) => setSummary(s), []);

  const navVisible =
    screen === 'menu' ||
    screen === 'analyze' ||
    (screen === 'play' && playNav.visible) ||
    (screen === 'online' && onlineNav);
  const navActive: NavTab | null =
    screen === 'menu'
      ? 'home'
      : screen === 'analyze'
        ? 'analyze'
        : screen === 'play'
          ? playNav.tab
          : screen === 'online'
            ? 'play'
            : null;
  const onNav = (tab: NavTab) => {
    if (tab === 'home') setScreen('menu');
    else if (tab === 'play') openPlay('hub');
    else if (tab === 'tournament') openPlay('tournament');
    else if (tab === 'settings') setSettingsOpen(true);
    else if (tab === 'analyze') setScreen('analyze');
  };

  // Deslizar para os lados troca de aba (só nas páginas principais de cada aba)
  const { width: winW } = useWindowDimensions();
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeFade = useRef(new Animated.Value(1)).current;
  const swipeBusy = useRef(false);
  // A entrada da nova aba começa logo depois que ela foi desenhada (não antes, para não travar)
  const pendingEnter = useRef(false);
  const [enterTick, setEnterTick] = useState(0);
  useEffect(() => {
    if (!pendingEnter.current) return;
    pendingEnter.current = false;
    Animated.parallel([
      Animated.timing(swipeX, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(swipeFade, { toValue: 1, duration: 170, useNativeDriver: true }),
    ]).start(() => {
      swipeBusy.current = false;
    });
  }, [enterTick, swipeX, swipeFade]);
  const swipeable = screen === 'menu' || screen === 'analyze' || (screen === 'play' && playNav.visible && playNav.root);
  const swipeState = useRef({ swipeable, navActive, winW, onNav });
  swipeState.current = { swipeable, navActive, winW, onNav };
  const swipe = useMemo(() => {
    const neighbor = (dir: 1 | -1) => {
      const i = SWIPE_TABS.indexOf(swipeState.current.navActive as NavTab);
      return i < 0 ? null : SWIPE_TABS[i + dir] ?? null;
    };
    const settle = () =>
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        swipeState.current.swipeable &&
        !swipeBusy.current &&
        Math.abs(g.dx) > 14 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderGrant: () => {
        lastSwipeAt.current = Date.now();
      },
      onPanResponderMove: (_e, g) => {
        lastSwipeAt.current = Date.now();
        // Sem aba vizinha naquele lado: resistência elástica
        const has = neighbor(g.dx < 0 ? 1 : -1);
        swipeX.setValue(has ? g.dx : g.dx * 0.25);
      },
      onPanResponderRelease: (_e, g) => {
        lastSwipeAt.current = Date.now();
        const dir: 1 | -1 = g.dx < 0 ? 1 : -1;
        const target = neighbor(dir);
        const w = swipeState.current.winW;
        const far = Math.abs(g.dx) > w * 0.22 || (Math.abs(g.vx) > 0.45 && Math.abs(g.dx) > 30);
        if (!target || !far) {
          settle();
          return;
        }
        swipeBusy.current = true;
        // Sai deslizando e esmaecendo; a próxima aba entra pelo lado oposto já com a tela pronta
        Animated.parallel([
          Animated.timing(swipeX, {
            toValue: -dir * w * 0.5,
            duration: 110,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(swipeFade, { toValue: 0, duration: 110, useNativeDriver: true }),
        ]).start(() => {
          swipeX.setValue(dir * w * 0.22);
          swipeState.current.onNav(target);
          pendingEnter.current = true;
          setEnterTick((t) => t + 1);
        });
      },
      onPanResponderTerminate: settle,
      onPanResponderTerminationRequest: () => false,
    });
  }, [swipeX, swipeFade]);

  // ---------- Tema claro / escuro ----------
  // As cores são lidas na montagem das telas; trocar o tema remonta a árvore (key). Nunca no meio de uma
  // partida: aí a troca fica pendente até ela acabar. A análise aberta é reaberta sozinha.
  // O Android segue o tema escolhido no app (texto sem cor definida, teclado e a barra de botões do
  // sistema usam o modo do aparelho). "Sistema" devolve o controle ao celular.
  useEffect(() => {
    try {
      Appearance.setColorScheme?.(themeMode === 'system' ? 'auto' : themeMode);
    } catch {
      // web / plataformas sem suporte
    }
  }, [themeMode]);
  const systemScheme = useColorScheme();
  const wantDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
  const [appliedDark, setAppliedDark] = useState(isDark);
  const [themeKey, setThemeKey] = useState(0);
  // Partida aberta em qualquer aba (mesmo escondida atrás do Início) segura a troca de tema
  const inGame = (playMounted && !playNav.visible) || (onlineMounted && !onlineNav);
  const themePending = prefsReady && wantDark !== appliedDark && inGame;
  useEffect(() => {
    if (!prefsReady || wantDark === appliedDark || inGame) return;
    applyPalette(wantDark);
    setAppliedDark(wantDark);
    setThemeKey((k) => k + 1);
    // Pedidos antigos não podem ser refeitos pelas telas remontadas
    setIntent(null);
    setJoinRequest(null);
    setPlayRequest(playNav.tab === 'tournament' ? { action: 'tournament', nonce: Date.now() } : null);
    setLoadRequest(summary?.pgn ? { pgn: summary.pgn, orientation: summary.orientation, nonce: Date.now(), silent: true } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsReady, wantDark, appliedDark, inGame]);

  if (!prefsReady) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider key={themeKey}>
      <StatusBar style={appliedDark ? 'light' : 'dark'} />
      <View style={styles.root}>
      <Animated.View
        style={[styles.stage, { opacity: swipeFade, transform: [{ translateX: swipeX }] }]}
        {...swipe.panHandlers}
      >
        {/* As telas ficam montadas por trás do menu, para voltar ao mesmo ponto */}
        <View style={[StyleSheet.absoluteFill, screen !== 'analysis' && styles.hidden]}>
          <AnalysisScreenM
            visible={screen === 'analysis'}
            intent={intent}
            loadRequest={loadRequest}
            prefs={prefs}
            onOpenMenu={goMenu}
            onOpenSettings={openSettings}
            onSummaryChange={onSummaryChange}
          />
        </View>
        {onlineMounted && (
          <View style={[StyleSheet.absoluteFill, screen !== 'online' && styles.hidden]}>
            <OnlineScreenM
              visible={screen === 'online'}
              joinRequest={joinRequest}
              prefs={prefs}
              onOpenMenu={goMenu}
              onAnalyze={analyzePgn}
              onBackToTournament={backToTournament}
              onNavVisible={setOnlineNav}
            />
          </View>
        )}
        {playMounted && (
          <View style={[StyleSheet.absoluteFill, screen !== 'play' && styles.hidden]}>
            <PlayScreenM
              visible={screen === 'play'}
              prefs={prefs}
              request={playRequest}
              onOpenMenu={goMenu}
              onOpenFriend={openOnline}
              onNavChange={setPlayNav}
              onOpenOnlineGame={openOnlineGame}
              onAnalyze={analyzePgn}
            />
          </View>
        )}
        {screen === 'menu' && (
          <View style={StyleSheet.absoluteFill}>
            <MainMenuM onAction={onMenuAction} pieceSet={pieceSet} current={summary} />
          </View>
        )}
        {screen === 'analyze' && (
          <View style={StyleSheet.absoluteFill}>
            <AnalyzeHub onAction={onMenuAction} onOpenMenu={goMenu} current={summary} />
          </View>
        )}
      </Animated.View>
      {navVisible && <NavBar active={navActive} onSelect={onNav} />}
      </View>

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        showArrows={showArrows}
        onShowArrowsChange={setShowArrows}
        themeIdx={themeIdx}
        onThemeChange={setThemeIdx}
        pieceSet={pieceSet}
        onPieceSetChange={setPieceSet}
        variantVeil={variantVeil}
        onVariantVeilChange={setVariantVeil}
        animation={animation}
        onAnimationChange={setAnimation}
        sound={sound}
        onSoundChange={setSound}
        appTheme={themeMode}
        onAppThemeChange={setThemeMode}
        themePending={themePending}
      />
    </SafeAreaProvider>
  );
}

const styles = themed(() => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
}));
