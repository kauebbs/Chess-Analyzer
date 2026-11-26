import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import appJson from '../../app.json';
import { Icon, IconName } from './Icon';
import { LogoMark, Wordmark } from './Logo';
import { PIECE_SETS } from '../pieces/pieceSets';
import { colors, fonts, themed } from '../theme';

export const APP_VERSION: string = appJson.expo.version;
const REPO = 'https://github.com/kauebbs/Chess-Analyzer';

/** Aba "Sobre" dos Ajustes: o que é o app, quem faz, privacidade e créditos. */
export function AboutSection() {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <LogoMark size={56} />
        <View style={{ flex: 1, gap: 6 }}>
          <Wordmark height={20} />
          <Text style={styles.version}>Versão {APP_VERSION} · Stockfish 19</Text>
        </View>
      </View>

      <Kicker n="01">Sobre nós</Kicker>
      <Text style={styles.lead}>
        O Chess Analyzer nasceu de um jogador querendo entender as próprias partidas sem depender de assinatura.
      </Text>
      <Text style={styles.body}>
        Aqui você analisa partidas do Chess.com, do Lichess ou de qualquer PGN com o Stockfish rodando no seu
        celular. Também dá para jogar contra bots de 400 a 3000, desafiar amigos online e organizar torneios, tudo
        em português.
      </Text>
      <Text style={styles.body}>
        É um projeto independente, feito por Kauê (kauebbs no GitHub). Sugestões e bugs são muito bem-vindos.
      </Text>

      <Kicker n="02">No que acreditamos</Kicker>
      <Principle title="Análise de verdade, de graça" text="Precisão, classificação dos lances e relatório completo, sem limite diário." />
      <Principle title="Seu celular, seus dados" text="A análise roda no aparelho. Nada da sua partida vai para um servidor para ser analisado." />
      <Principle title="Xadrez é para jogar junto" text="Salas com amigos, séries MD3 e MD5, torneios e quem foi eliminado pode assistir e conversar." />

      <Kicker n="03">Privacidade</Kicker>
      <Text style={styles.body}>
        Para jogar online o app cria uma conta anônima (Firebase). Ficam guardados só o nome que você escolhe,
        os lances, o chat e o placar das salas e torneios. Ao importar partidas, o app consulta as APIs públicas do
        Chess.com e do Lichess com o usuário que você digitar. Preferências ficam só no aparelho.
      </Text>

      <Kicker n="04">Créditos</Kicker>
      <Credit name="Stockfish" detail="Motor de xadrez · os desenvolvedores do Stockfish · GPLv3" />
      <Credit name="chess.js" detail="Regras e PGN · Jeff Hlywa · BSD-2" />
      <Credit name="Aberturas" detail="lichess-org/chess-openings · CC0" />
      {PIECE_SETS.map((s) => (
        <Credit key={s.id} name={`Peças: ${s.name}`} detail={s.credit} />
      ))}
      <Credit name="League Gothic" detail="Letreiro da marca · The League of Moveable Type · OFL" />
      <Credit name="Expo, React Native e Firebase" detail="Base do app e do jogo online" />

      <View style={styles.links}>
        <LinkBtn icon="link" label="CÓDIGO-FONTE" onPress={() => Linking.openURL(REPO)} />
        <LinkBtn icon="flag" label="REPORTAR PROBLEMA" onPress={() => Linking.openURL(`${REPO}/issues`)} />
      </View>
      <Text style={styles.footer}>Feito com ♞ no Brasil</Text>
    </View>
  );
}

function Kicker({ n, children }: { n: string; children: string }) {
  return (
    <View style={styles.kicker}>
      <Text style={styles.kickerNum}>{n}</Text>
      <Text style={styles.kickerText}>{children.toUpperCase()}</Text>
    </View>
  );
}

function Principle({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.principle}>
      <View style={styles.bullet} />
      <View style={{ flex: 1 }}>
        <Text style={styles.principleTitle}>{title}</Text>
        <Text style={styles.principleText}>{text}</Text>
      </View>
    </View>
  );
}

function Credit({ name, detail }: { name: string; detail: string }) {
  return (
    <View style={styles.credit}>
      <Text style={styles.creditName}>{name}</Text>
      <Text style={styles.creditDetail}>{detail}</Text>
    </View>
  );
}

function LinkBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label.toLowerCase()}
      style={({ pressed }) => [styles.linkBtn, pressed && { backgroundColor: colors.surface }]}
    >
      <Icon name={icon} size={16} color={colors.ink} strokeWidth={1.8} />
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    paddingBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  version: {
    color: colors.textDim,
    fontStyle: 'italic',
    fontSize: 13,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 22,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderColor: colors.ink,
  },
  kickerNum: {
    color: colors.red,
    fontFamily: fonts.condensed,
    fontWeight: '800',
    fontSize: 13,
  },
  kickerText: {
    color: colors.ink,
    fontFamily: fonts.condensed,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
  },
  lead: {
    color: colors.text,
    fontFamily: fonts.condensedHeavy,
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 10,
  },
  body: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  principle: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  bullet: {
    width: 8,
    height: 8,
    marginTop: 6,
    backgroundColor: colors.red,
  },
  principleTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  principleText: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  credit: {
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  creditName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  creditDetail: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 1,
  },
  links: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  linkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  linkText: {
    color: colors.ink,
    fontFamily: fonts.condensed,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.4,
  },
  footer: {
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 18,
  },
}));
