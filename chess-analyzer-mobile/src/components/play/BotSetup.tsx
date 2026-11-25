import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Piece } from '../Piece';
import { Card, Chips, FieldLabel, Header, Label, PrimaryButton, RatingPicker, ui } from './ui';
import { colors } from '../../theme';
import type { BestOf } from '../../play/tournament';
import type { WatchSpeed } from './BotGame';
import { SPEED_LABEL } from './BotGame';

export const BEST_OF_OPTIONS: { id: BestOf; label: string }[] = [
  { id: 1, label: 'Única' },
  { id: 3, label: 'MD3' },
  { id: 5, label: 'MD5' },
];

export const TC_OPTIONS: { id: string; label: string; tc: { minutes: number; increment: number } | null }[] = [
  { id: 'none', label: 'Livre', tc: null },
  { id: '3+2', label: '3+2', tc: { minutes: 3, increment: 2 } },
  { id: '5+0', label: '5+0', tc: { minutes: 5, increment: 0 } },
  { id: '10+0', label: '10+0', tc: { minutes: 10, increment: 0 } },
  { id: '15+10', label: '15+10', tc: { minutes: 15, increment: 10 } },
];

export interface VsBotSettings {
  rating: number;
  color: 'w' | 'b' | 'random';
  bestOf: BestOf;
  tcId: string;
}

export interface BotBotSettings {
  ratingA: number;
  ratingB: number;
  bestOf: BestOf;
  speed: WatchSpeed;
}

export function VsBotSetup({
  pieceSet,
  initial,
  onBack,
  onStart,
}: {
  pieceSet: string;
  initial: VsBotSettings;
  onBack: () => void;
  onStart: (s: VsBotSettings) => void;
}) {
  const [s, setS] = useState(initial);
  const set = <K extends keyof VsBotSettings>(k: K, v: VsBotSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header title="CONTRA O BOT" onBack={onBack} />
      <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
        <Card>
          <Label>NÍVEL DO BOT</Label>
          <RatingPicker value={s.rating} onChange={(v) => set('rating', v)} />
        </Card>

        <Card>
          <Label>PARTIDA</Label>
          <FieldLabel>Jogar de</FieldLabel>
          <View style={ui.segment}>
            {(['w', 'random', 'b'] as const).map((c) => (
              <Pressable
                key={c}
                onPress={() => set('color', c)}
                accessibilityLabel={c === 'w' ? 'Brancas' : c === 'b' ? 'Pretas' : 'Aleatório'}
                style={[ui.segmentItem, s.color === c && ui.segmentActive]}
              >
                {c === 'random' ? (
                  <View style={{ flexDirection: 'row' }}>
                    <Piece setId={pieceSet} color="w" type="k" size={24} />
                    <Piece setId={pieceSet} color="b" type="k" size={24} />
                  </View>
                ) : (
                  <Piece setId={pieceSet} color={c} type="k" size={30} />
                )}
                <Text style={[ui.segmentText, s.color === c && ui.segmentTextActive]}>
                  {c === 'w' ? 'Brancas' : c === 'b' ? 'Pretas' : 'Aleatório'}
                </Text>
              </Pressable>
            ))}
          </View>
          <FieldLabel>Formato (as cores trocam a cada jogo da série)</FieldLabel>
          <Chips options={BEST_OF_OPTIONS} value={s.bestOf} onChange={(v) => set('bestOf', v)} />
          <FieldLabel>Tempo</FieldLabel>
          <Chips options={TC_OPTIONS.map(({ id, label }) => ({ id, label }))} value={s.tcId} onChange={(v) => set('tcId', v)} />
        </Card>

        <PrimaryButton icon="play" label="JOGAR" onPress={() => onStart(s)} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function BotBotSetup({
  initial,
  onBack,
  onStart,
}: {
  initial: BotBotSettings;
  onBack: () => void;
  onStart: (s: BotBotSettings) => void;
}) {
  const [s, setS] = useState(initial);
  const set = <K extends keyof BotBotSettings>(k: K, v: BotBotSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header title="BOT X BOT" onBack={onBack} />
      <ScrollView style={ui.scroll} contentContainerStyle={ui.content}>
        <Card>
          <Label>BOT 1 · COMEÇA DE BRANCAS</Label>
          <RatingPicker value={s.ratingA} onChange={(v) => set('ratingA', v)} compact />
        </Card>
        <Text style={{ color: colors.red, textAlign: 'center', fontWeight: '900', fontSize: 16, letterSpacing: 2 }}>VS</Text>
        <Card>
          <Label>BOT 2</Label>
          <RatingPicker value={s.ratingB} onChange={(v) => set('ratingB', v)} compact />
        </Card>
        <Card>
          <Label>CONFRONTO</Label>
          <FieldLabel>Formato</FieldLabel>
          <Chips options={BEST_OF_OPTIONS} value={s.bestOf} onChange={(v) => set('bestOf', v)} />
          <FieldLabel>Velocidade</FieldLabel>
          <Chips
            options={(['normal', 'fast', 'instant'] as WatchSpeed[]).map((id) => ({ id, label: SPEED_LABEL[id] }))}
            value={s.speed}
            onChange={(v) => set('speed', v)}
          />
        </Card>
        <PrimaryButton icon="play" label="ASSISTIR" onPress={() => onStart(s)} />
      </ScrollView>
    </SafeAreaView>
  );
}
