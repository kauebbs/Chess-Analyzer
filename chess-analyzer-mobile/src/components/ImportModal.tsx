import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { colors, fonts, themed } from '../theme';
import { fetchGames, GameSource, GameSummary } from '../services/gameSources';

export type Tab = 'pgn' | GameSource;

interface ImportModalProps {
  visible: boolean;
  onClose: () => void;
  /** Deve lançar erro se o PGN for inválido. */
  onLoadPgn: (pgn: string, orientation: 'white' | 'black') => void;
  /** Aba que abre primeiro (ex.: vindo do menu principal). */
  initialTab?: Tab;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'pgn', label: 'PGN' },
  { id: 'chesscom', label: 'Chess.com' },
  { id: 'lichess', label: 'Lichess' },
];

const SPEED_LABEL: Record<string, string> = {
  ultraBullet: 'UltraBullet',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rápida',
  classical: 'Clássica',
  daily: 'Diária',
  correspondence: 'Correspondência',
};

export const ImportModal: React.FC<ImportModalProps> = ({ visible, onClose, onLoadPgn, initialTab }) => {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'chesscom');
  useEffect(() => {
    if (visible && initialTab) setTab(initialTab);
  }, [visible, initialTab]);
  const [pgnText, setPgnText] = useState('');
  const [pgnError, setPgnError] = useState<string | null>(null);

  const [nick, setNick] = useState<Record<GameSource, string>>({ chesscom: '', lichess: '' });
  const [results, setResults] = useState<Record<GameSource, GameSummary[] | null>>({
    chesscom: null,
    lichess: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (source: GameSource) => {
    const user = nick[source].trim();
    if (!user || loading) return;
    setLoading(true);
    setError(null);
    try {
      const games = await fetchGames(source, user);
      setResults((r) => ({ ...r, [source]: games }));
      if (games.length === 0) setError('Nenhuma partida encontrada para esse usuário.');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível buscar as partidas. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  const loadPgnText = () => {
    try {
      setPgnError(null);
      onLoadPgn(pgnText, 'white');
      onClose();
    } catch (e: any) {
      setPgnError(e?.message ?? 'PGN inválido.');
    }
  };

  const pickGame = (game: GameSummary, source: GameSource) => {
    const me = nick[source].trim().toLowerCase();
    const orientation = game.black.toLowerCase() === me ? 'black' : 'white';
    try {
      onLoadPgn(game.pgn, orientation);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível abrir essa partida.');
    }
  };

  const renderGame = (game: GameSummary, source: GameSource) => {
    const me = nick[source].trim().toLowerCase();
    const meWhite = game.white.toLowerCase() === me;
    const meBlack = game.black.toLowerCase() === me;
    let outcome: { label: string; color: string } = { label: '½', color: colors.textDim };
    if (game.result === '1-0') outcome = meBlack ? { label: 'D', color: colors.red } : { label: 'V', color: colors.mint };
    if (game.result === '0-1') outcome = meWhite ? { label: 'D', color: colors.red } : { label: 'V', color: colors.mint };
    if (!meWhite && !meBlack && game.result !== '1/2-1/2') outcome = { label: game.result, color: colors.textDim };

    return (
      <Pressable
        onPress={() => pickGame(game, source)}
        style={({ pressed }) => [styles.gameRow, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.playerLine}>
            <View style={[styles.dot, { backgroundColor: '#ece8e1' }]} />
            <Text style={[styles.playerName, meWhite && styles.me]} numberOfLines={1}>
              {game.white} {game.whiteElo ? <Text style={styles.elo}>({game.whiteElo})</Text> : null}
            </Text>
          </View>
          <View style={styles.playerLine}>
            <View style={[styles.dot, { backgroundColor: '#1a1a1d', borderColor: colors.textMuted, borderWidth: 1 }]} />
            <Text style={[styles.playerName, meBlack && styles.me]} numberOfLines={1}>
              {game.black} {game.blackElo ? <Text style={styles.elo}>({game.blackElo})</Text> : null}
            </Text>
          </View>
        </View>
        <View style={styles.gameMeta}>
          <View style={[styles.outcome, { borderColor: outcome.color }]}>
            <Text style={[styles.outcomeText, { color: outcome.color }]}>{outcome.label}</Text>
          </View>
          <Text style={styles.metaText}>
            {SPEED_LABEL[game.speed] ?? game.speed}
            {game.speed ? ' · ' : ''}
            {game.date}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} title="Importar partida" onClose={onClose}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              setTab(t.id);
              setError(null);
            }}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'pgn' ? (
        <View>
          <TextInput
            value={pgnText}
            onChangeText={setPgnText}
            placeholder={'Cole o PGN aqui\n\n1. e4 e5 2. Nf3 Nc6 ...'}
            placeholderTextColor={colors.textMuted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.pgnInput}
            textAlignVertical="top"
          />
          {pgnError && <Text style={styles.error}>{pgnError}</Text>}
          <Pressable
            onPress={loadPgnText}
            disabled={!pgnText.trim()}
            style={({ pressed }) => [
              styles.primary,
              !pgnText.trim() && { opacity: 0.4 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Icon name="review" size={18} color="#fff" />
            <Text style={styles.primaryText}>ANALISAR PARTIDA</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexShrink: 1 }}>
          <View style={styles.searchRow}>
            <TextInput
              value={nick[tab]}
              onChangeText={(v) => setNick((n) => ({ ...n, [tab]: v }))}
              placeholder={tab === 'chesscom' ? 'Nick no Chess.com' : 'Nick no Lichess'}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => search(tab)}
              style={styles.searchInput}
            />
            <Pressable
              onPress={() => search(tab)}
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
              accessibilityLabel="Buscar partidas"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Icon name="search" size={20} color="#fff" />}
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <FlatList
            data={results[tab] ?? []}
            keyExtractor={(g) => g.id}
            renderItem={({ item }) => renderGame(item, tab)}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loading && !error ? (
                <Text style={styles.hint}>
                  Digite o nick e toque na lupa para ver as últimas partidas.
                </Text>
              ) : undefined
            }
          />
        </View>
      )}
    </Sheet>
  );
};

const styles = themed(() => StyleSheet.create({
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
    fontSize: 14,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.text,
  },
  pgnInput: {
    height: 190,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 4,
    padding: 12,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  primary: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.red,
    borderRadius: 4,
    paddingVertical: 13,
  },
  primaryText: {
    color: '#fff',
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1.2,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  searchBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    borderRadius: 4,
  },
  error: {
    color: colors.red,
    marginTop: 10,
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  list: {
    marginTop: 10,
    minHeight: 120,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  playerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  playerName: {
    color: colors.textDim,
    fontSize: 14,
    flexShrink: 1,
  },
  me: {
    color: colors.text,
    fontWeight: '700',
  },
  elo: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  gameMeta: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  outcome: {
    minWidth: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  outcomeText: {
    fontFamily: fonts.condensedHeavy,
    fontWeight: '800',
    fontSize: 12,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
  },
}));
