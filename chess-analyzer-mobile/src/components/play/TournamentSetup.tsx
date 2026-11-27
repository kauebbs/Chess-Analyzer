import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../Icon';
import { Card, Chips, FieldLabel, Header, Label, PrimaryButton, ui } from './ui';
import { colors, fonts, themed } from '../../theme';
import { botName, clampRating, ratingLabel } from '../../bots/botPlayer';
import type { BestOf, Format } from '../../play/tournament';
import { BEST_OF_OPTIONS, TC_OPTIONS } from './BotSetup';

export interface TournamentSettings {
  name: string;
  format: Format;
  bestOf: BestOf;
  tcId: string;
  youPlay: boolean;
  yourName: string;
  bots: { name: string; rating: number }[];
}

export const MAX_PLAYERS = 16;

export function defaultBots(n: number, from = 800, step = 300) {
  return Array.from({ length: n }, (_, i) => ({ name: botName(i), rating: clampRating(from + i * step) }));
}

export function TournamentSetup({
  online,
  initial,
  busy,
  error,
  onBack,
  onCreate,
}: {
  online: boolean;
  initial: TournamentSettings;
  busy?: boolean;
  error?: string | null;
  onBack: () => void;
  onCreate: (s: TournamentSettings) => void;
}) {
  const [s, setS] = useState(initial);
  const set = <K extends keyof TournamentSettings>(k: K, v: TournamentSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const total = s.bots.length + (s.youPlay ? 1 : 0);
  const canCreate = online || total >= 2;

  const setBot = (i: number, patch: Partial<{ name: string; rating: number }>) =>
    set(
      'bots',
      s.bots.map((b, k) => (k === i ? { ...b, ...patch } : b))
    );
  const addBot = () => {
    if (total >= MAX_PLAYERS) return;
    const used = new Set(s.bots.map((b) => b.name));
    let idx = s.bots.length;
    while (used.has(botName(idx)) && idx < s.bots.length + 16) idx++;
    const last = s.bots[s.bots.length - 1]?.rating ?? 1200;
    set('bots', [...s.bots, { name: botName(idx), rating: clampRating(last + 200) }]);
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header title={online ? 'TORNEIO ONLINE' : 'NOVO TORNEIO'} onBack={onBack} />
      <ScrollView style={ui.scroll} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>NOME DO TORNEIO</Label>
          <TextInput
            value={s.name}
            onChangeText={(v) => set('name', v)}
            placeholder="Copa dos Amigos"
            placeholderTextColor={colors.textMuted}
            maxLength={32}
            style={ui.input}
          />
          <FieldLabel>Formato</FieldLabel>
          <Chips
            options={[
              { id: 'roundrobin' as Format, label: 'Pontos corridos' },
              { id: 'knockout' as Format, label: 'Mata-mata' },
            ]}
            value={s.format}
            onChange={(v) => set('format', v)}
          />
          <Text style={ui.hint}>
            {s.format === 'roundrobin'
              ? 'Todos jogam contra todos; quem somar mais pontos é campeão.'
              : 'Quem perde o confronto sai. Empate na série vai para jogos de desempate.'}
          </Text>
          <FieldLabel>Cada confronto</FieldLabel>
          <Chips options={BEST_OF_OPTIONS} value={s.bestOf} onChange={(v) => set('bestOf', v)} />
          <FieldLabel>Tempo das partidas com pessoas</FieldLabel>
          <Chips options={TC_OPTIONS.map(({ id, label }) => ({ id, label }))} value={s.tcId} onChange={(v) => set('tcId', v)} />
        </Card>

        <Card>
          <Label>PARTICIPANTES {online ? '' : `· ${total}`}</Label>
          <View style={styles.youRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.youTitle}>{online ? 'Eu também jogo' : 'Eu jogo'}</Text>
              <Text style={styles.youHint}>
                {online ? 'Desligado: você só organiza e acompanha' : 'Desligado: torneio só de bots (você assiste)'}
              </Text>
            </View>
            <Switch
              value={s.youPlay}
              onValueChange={(v) => set('youPlay', v)}
              trackColor={{ false: colors.border, true: colors.mintDark }}
              thumbColor={s.youPlay ? colors.mint : colors.textDim}
            />
          </View>
          {(s.youPlay || online) && (
            <TextInput
              value={s.yourName}
              onChangeText={(v) => set('yourName', v)}
              placeholder="Seu nome"
              placeholderTextColor={colors.textMuted}
              maxLength={24}
              style={ui.input}
            />
          )}

          <FieldLabel>Bots {online ? '(os amigos entram depois, pelo link)' : ''}</FieldLabel>
          {s.bots.map((b, i) => (
            <View key={i} style={styles.botRow}>
              <Icon name="bot" size={18} color={colors.textDim} />
              <View style={{ flex: 1 }}>
                <Text style={styles.botName} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={styles.botLevel}>{ratingLabel(b.rating)}</Text>
              </View>
              <Pressable
                onPress={() => setBot(i, { rating: clampRating(b.rating - 100) })}
                accessibilityLabel={`Diminuir rating de ${b.name}`}
                style={styles.step}
              >
                <Icon name="minus" size={16} color={colors.text} />
              </Pressable>
              <Text style={styles.botRating}>{b.rating}</Text>
              <Pressable
                onPress={() => setBot(i, { rating: clampRating(b.rating + 100) })}
                accessibilityLabel={`Aumentar rating de ${b.name}`}
                style={styles.step}
              >
                <Icon name="plus" size={16} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => set('bots', s.bots.filter((_, k) => k !== i))}
                accessibilityLabel={`Remover ${b.name}`}
                style={styles.step}
              >
                <Icon name="close" size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable onPress={addBot} disabled={total >= MAX_PLAYERS} style={[styles.addBtn, total >= MAX_PLAYERS && { opacity: 0.4 }]}>
              <Icon name="plus" size={16} color={colors.mint} />
              <Text style={styles.addText}>Adicionar bot</Text>
            </Pressable>
            {[4, 8].map((n) => (
              <Pressable key={n} onPress={() => set('bots', defaultBots(n, 600, n === 4 ? 500 : 250))} style={styles.quick}>
                <Text style={styles.quickText}>{n} bots</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {error ? <Text style={ui.error}>{error}</Text> : null}
        {!online && total < 2 && <Text style={ui.hint}>O torneio precisa de pelo menos 2 participantes.</Text>}
        <PrimaryButton
          icon="trophy"
          label={online ? 'CRIAR E CONVIDAR' : 'COMEÇAR TORNEIO'}
          onPress={() => onCreate(s)}
          busy={busy}
          disabled={!canCreate}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() => ({
  youRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  youTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
  },
  youHint: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  botRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  botName: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
  },
  botLevel: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontSize: 11,
  },
  botRating: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontSize: 16,
    minWidth: 42,
    textAlign: 'center' as const,
  },
  step: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.mint,
    borderStyle: 'dashed' as const,
    borderRadius: 12,
    paddingVertical: 10,
  },
  addText: {
    color: colors.mint,
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
  },
  quick: {
    paddingHorizontal: 12,
    justifyContent: 'center' as const,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  quickText: {
    color: colors.textDim,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
  },
}));
