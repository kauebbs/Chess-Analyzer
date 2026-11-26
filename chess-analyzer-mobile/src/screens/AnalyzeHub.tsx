import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header, ui } from '../components/play/ui';
import { PosterHeading, PosterRow } from '../components/poster';
import type { MenuAction } from './MainMenu';

interface AnalyzeHubProps {
  onAction: (action: MenuAction) => void;
  onOpenMenu: () => void;
  /** Análise em andamento, se houver. */
  current: { title: string; subtitle: string } | null;
}

/** Aba "Analisar": de onde vem a partida a ser analisada. */
export function AnalyzeHub({ onAction, onOpenMenu, current }: AnalyzeHubProps) {
  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <Header title="ANALISAR" icon="home" onBack={onOpenMenu} />
      <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
        <View style={ui.hero}>
          <PosterHeading>{'Analise\nsua partida'}</PosterHeading>
          <Text style={ui.heroText}>Stockfish 19 no aparelho · precisão, lances e relatório.</Text>
        </View>
        {current && (
          <PosterRow icon="play" title="Continuar análise" subtitle={current.title} onPress={() => onAction('continue')} />
        )}
        <PosterRow title="Chess.com" subtitle="Suas partidas pelo usuário" onPress={() => onAction('chesscom')} />
        <PosterRow title="Lichess" subtitle="Suas partidas pelo usuário" onPress={() => onAction('lichess')} />
        <PosterRow title="Colar PGN" subtitle="De qualquer site ou arquivo" onPress={() => onAction('pgn')} />
        <PosterRow title="Tabuleiro livre" subtitle="Monte e explore lances" onPress={() => onAction('free')} />
      </ScrollView>
    </SafeAreaView>
  );
}
