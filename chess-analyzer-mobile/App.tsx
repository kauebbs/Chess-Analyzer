import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MainMenu, MenuAction } from './src/screens/MainMenu';
import { AnalysisScreen } from './src/screens/AnalysisScreen';
import { OnlineScreen } from './src/screens/OnlineScreen';
import { PlayAction, PlayScreen } from './src/screens/PlayScreen';
import { NavBar, NavTab } from './src/components/NavBar';
import { SettingsModal } from './src/components/SettingsModal';
import { codeFromUrl } from './src/online/gameService';
import { tournamentCodeFromUrl } from './src/online/tournamentService';
import { BOARD_THEMES, colors, DEFAULT_THEME_IDX } from './src/theme';
import { AnimationPrefs, DEFAULT_ANIMATION, normalizeAnimation } from './src/settings/animation';
import { configureSounds, DEFAULT_SOUND, preloadSounds, SoundPrefs } from './src/services/sounds';

const PREFS_KEY = 'prefs:v1';

type Screen = 'menu' | 'analysis' | 'online' | 'play';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [intent, setIntent] = useState<{ action: MenuAction; nonce: number } | null>(null);
  const [summary, setSummary] = useState<{ title: string; subtitle: string } | null>(null);
  const [loadRequest, setLoadRequest] = useState<{ pgn: string; orientation: 'white' | 'black'; nonce: number } | null>(null);
  const [joinRequest, setJoinRequest] = useState<{ code: string; nonce: number } | null>(null);
  const [onlineMounted, setOnlineMounted] = useState(false);
  const [playMounted, setPlayMounted] = useState(false);
  const [playRequest, setPlayRequest] = useState<{ action: PlayAction; code?: string; nonce: number } | null>(null);
  // Barra de navegação: aparece no início, nos menus de jogo e no saguão online (some durante as partidas e na análise)
  const [playNav, setPlayNav] = useState<{ visible: boolean; tab: NavTab }>({ visible: true, tab: 'play' });
  const [onlineNav, setOnlineNav] = useState(true);

  // Preferências (compartilhadas entre as telas)
  const [showArrows, setShowArrows] = useState(true);
  const [themeIdx, setThemeIdx] = useState(DEFAULT_THEME_IDX);
  const [pieceSet, setPieceSet] = useState('staunty');
  const [variantVeil, setVariantVeil] = useState(true);
  const [animation, setAnimation] = useState<AnimationPrefs>(DEFAULT_ANIMATION);
  const [sound, setSound] = useState<SoundPrefs>(DEFAULT_SOUND);
  useEffect(() => configureSounds(sound), [sound]);
  useEffect(() => preloadSounds(), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const prefs = useMemo(
    () => ({ showArrows, themeIdx, pieceSet, variantVeil, animation, sound }),
    [showArrows, themeIdx, pieceSet, variantVeil, animation, sound]
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
      })
      .catch(() => {})
      .finally(() => {
        prefsLoaded.current = true;
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

  const onMenuAction = (action: MenuAction) => {
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
    setIntent({ action, nonce: Date.now() });
    setScreen('analysis');
  };

  const onSummaryChange = useCallback((s: { title: string; subtitle: string } | null) => setSummary(s), []);

  const navVisible =
    screen === 'menu' || (screen === 'play' && playNav.visible) || (screen === 'online' && onlineNav);
  const navActive: NavTab | null =
    screen === 'menu' ? 'home' : screen === 'play' ? playNav.tab : screen === 'online' ? 'play' : null;
  const onNav = (tab: NavTab) => {
    if (tab === 'home') setScreen('menu');
    else if (tab === 'play') openPlay('hub');
    else if (tab === 'tournament') openPlay('tournament');
    else if (tab === 'settings') setSettingsOpen(true);
    else if (tab === 'analyze') {
      if (summary) setScreen('analysis');
      else onMenuAction('chesscom');
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.root}>
      <View style={styles.stage}>
        {/* As telas ficam montadas por trás do menu, para voltar ao mesmo ponto */}
        <View style={[StyleSheet.absoluteFill, screen !== 'analysis' && styles.hidden]}>
          <AnalysisScreen
            visible={screen === 'analysis'}
            intent={intent}
            loadRequest={loadRequest}
            prefs={prefs}
            onOpenMenu={() => setScreen('menu')}
            onOpenSettings={() => setSettingsOpen(true)}
            onSummaryChange={onSummaryChange}
          />
        </View>
        {onlineMounted && (
          <View style={[StyleSheet.absoluteFill, screen !== 'online' && styles.hidden]}>
            <OnlineScreen
              visible={screen === 'online'}
              joinRequest={joinRequest}
              prefs={prefs}
              onOpenMenu={() => setScreen('menu')}
              onAnalyze={(pgn, orientation) => {
                setLoadRequest({ pgn, orientation, nonce: Date.now() });
                setScreen('analysis');
              }}
              onBackToTournament={(code) => openPlay('tournament', code)}
              onNavVisible={setOnlineNav}
            />
          </View>
        )}
        {playMounted && (
          <View style={[StyleSheet.absoluteFill, screen !== 'play' && styles.hidden]}>
            <PlayScreen
              visible={screen === 'play'}
              prefs={prefs}
              request={playRequest}
              onOpenMenu={() => setScreen('menu')}
              onOpenFriend={openOnline}
              onNavChange={setPlayNav}
              onOpenOnlineGame={(code) => {
                setJoinRequest({ code, nonce: Date.now() });
                openOnline();
              }}
              onAnalyze={(pgn, orientation) => {
                setLoadRequest({ pgn, orientation, nonce: Date.now() });
                setScreen('analysis');
              }}
            />
          </View>
        )}
        {screen === 'menu' && (
          <View style={StyleSheet.absoluteFill}>
            <MainMenu onAction={onMenuAction} pieceSet={pieceSet} current={summary} />
          </View>
        )}
      </View>
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
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  stage: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
});
