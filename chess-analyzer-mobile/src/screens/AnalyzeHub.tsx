import React, { useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header, ui } from '../components/play/ui';
import { MascotHero, PosterRow } from '../components/poster';
import type { MenuAction } from './MainMenu';
import type { AnalysisPrefs } from './AnalysisScreen';
import { OpeningTrainer } from './OpeningTrainer';

interface AnalyzeHubProps {
  onAction: (action: MenuAction) => void;
  onOpenMenu: () => void;
  /** Análise em andamento, se houver. */
  current: { title: string; subtitle: string } | null;
  /** Tabuleiro, peças e animações (para o treino de aberturas). */
  prefs: AnalysisPrefs;
}

/** Aba "Analisar": de onde vem a partida a ser analisada. */
export function AnalyzeHub({ onAction, onOpenMenu, current, prefs }: AnalyzeHubProps) {
  const [trainer, setTrainer] = useState(false);
  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <Header title="ANALISAR" icon="home" onBack={onOpenMenu} />
      <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
        <MascotHero
          pose="pensa"
          tone="blue"
          title={'Vamos entender\nsua partida?'}
          text="Stockfish 19 no aparelho: precisão, lance a lance e o porquê de cada erro."
        />
        {current && (
          <PosterRow icon="play" badge="review" tone="green" title="Continuar análise" subtitle={current.title} onPress={() => onAction('continue')} />
        )}
        <PosterRow badge="import" tone="green" title="Chess.com" subtitle="Suas partidas pelo usuário" onPress={() => onAction('chesscom')} />
        <PosterRow badge="import" tone="forest" title="Lichess" subtitle="Suas partidas pelo usuário" onPress={() => onAction('lichess')} />
        <PosterRow badge="paste" tone="orange" title="Colar PGN" subtitle="De qualquer site ou arquivo" onPress={() => onAction('pgn')} />
        <PosterRow badge="board" tone="blue" title="Tabuleiro livre" subtitle="Monte e explore lances" onPress={() => onAction('free')} />
        <PosterRow badge="layers" tone="yellow" title="Treino de aberturas" subtitle="Seu repertório, montado com suas partidas" onPress={() => setTrainer(true)} />
      </ScrollView>
      <Modal visible={trainer} animationType="slide" onRequestClose={() => setTrainer(false)}>
        <OpeningTrainer prefs={prefs} onClose={() => setTrainer(false)} />
      </Modal>
    </SafeAreaView>
  );
}
