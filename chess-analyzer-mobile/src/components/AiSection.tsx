import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAiConfig } from '../ai/config';
import { cancelDownload, deleteModel, DEVICE_MODELS, deviceAiSupported, DOWNLOAD_CANCELLED, downloadModel, isModelDownloaded } from '../ai/device';
import { generate, resetAiBackoff } from '../ai';
import { botLine } from '../ai/botVoice';
import { personalityFor } from '../ai/personalities';
import { colors, fonts, themed } from '../theme';

/** Aba "IA" dos Ajustes: IA no celular para a personalidade dos bots e os professores da análise. */
export function AiSection() {
  const [cfg, setCfg] = useAiConfig();
  const native = deviceAiSupported();
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<{ id: string; p: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<string | null>(null);
  const [sampling, setSampling] = useState(false);

  const refresh = () =>
    Promise.all(DEVICE_MODELS.map(async (m) => [m.id, await isModelDownloaded(m)] as const)).then((l) =>
      setDownloaded(Object.fromEntries(l))
    );
  useEffect(() => {
    if (native) refresh();
  }, [native]);

  const current = DEVICE_MODELS.find((m) => m.id === cfg.deviceModel) ?? DEVICE_MODELS[0];
  const ready = native && cfg.enabled && !!downloaded[current.id];

  const startDownload = async (id: string) => {
    const m = DEVICE_MODELS.find((x) => x.id === id)!;
    setError(null);
    setProgress({ id, p: 0 });
    try {
      await downloadModel(m, (p) => setProgress({ id, p }));
      setCfg({ deviceModel: id });
      resetAiBackoff();
    } catch (e: any) {
      if (e?.message !== DOWNLOAD_CANCELLED) setError(`Não deu para baixar: ${e?.message ?? e}. Confira a internet e tente de novo.`);
    }
    setProgress(null);
    refresh();
  };

  const trySample = async () => {
    setSampling(true);
    setSample(null);
    resetAiBackoff();
    const t0 = Date.now();
    const name = 'Gambito Gil';
    const probe = await generate([{ role: 'user', content: 'Responda só: ok' }], { maxTokens: 4, timeoutMs: 60000 });
    if (!probe) {
      setSample('A IA não respondeu. Os bots vão usar as frases prontas.');
    } else {
      const line = await botLine({ name, rating: 1500 }, { type: 'greet' }, { opponent: 'Kauê', recent: [], plies: 0 });
      const s = ((Date.now() - t0) / 1000).toFixed(1).replace('.', ',');
      setSample(`${name} (${personalityFor(name).label}): ${line}\n\nRespondeu em ${s} s (a 1ª vez demora mais: o modelo carrega na memória).`);
    }
    setSampling(false);
  };

  // ---------- Expo Go: sem IA nativa ----------
  if (!native) {
    return (
      <View>
        <View style={styles.status}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTag}>IA LOCAL</Text>
            <Text style={styles.statusTitle}>Indisponível no Expo Go</Text>
            <Text style={styles.statusText}>
              A IA roda dentro do app instalado pelo build (EAS). Aqui os bots usam frases prontas. O passo a passo está no
              arquivo IA-LOCAL.md do projeto.
            </Text>
          </View>
        </View>
        <Foot />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.status}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTag}>IA LOCAL</Text>
          <Text style={styles.statusTitle}>
            {!cfg.enabled ? 'Desligada' : ready ? 'Pronta' : progress ? 'Baixando…' : 'Falta baixar o modelo'}
          </Text>
          <Text style={styles.statusText}>
            {ready
              ? `Usando ${current.label}. Roda no celular, sem internet.`
              : 'Dá personalidade aos bots no chat e escreve a explicação dos professores.'}
          </Text>
        </View>
        <Switch
          value={cfg.enabled}
          onValueChange={(v) => {
            setCfg({ enabled: v });
            resetAiBackoff();
          }}
          trackColor={{ false: colors.border, true: colors.mintDark }}
          thumbColor={cfg.enabled ? colors.mint : colors.textDim}
          accessibilityLabel="Ligar a IA local"
        />
      </View>

      <View style={[styles.status, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.modelTitle}>Voz</Text>
          <Text style={styles.hint}>Bots e professor falam em voz alta. Funciona mesmo sem o modelo baixado.</Text>
        </View>
        <Switch
          value={cfg.voice}
          onValueChange={(v) => setCfg({ voice: v })}
          trackColor={{ false: colors.border, true: colors.mintDark }}
          thumbColor={cfg.voice ? colors.mint : colors.textDim}
          accessibilityLabel="Voz dos bots e do professor"
        />
      </View>

      <Text style={styles.section}>MODELO</Text>
      {DEVICE_MODELS.map((m) => {
        const dl = progress?.id === m.id;
        const has = !!downloaded[m.id];
        const active = cfg.deviceModel === m.id && has;
        return (
          <View key={m.id} style={[styles.model, active && styles.modelOn]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modelTitle}>
                {m.label} <Text style={styles.modelSize}>· {m.sizeLabel}</Text>
              </Text>
              <Text style={styles.hint}>{active ? 'Em uso.' : m.hint}</Text>
              {dl && (
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round((progress?.p ?? 0) * 100)}%` }]} />
                </View>
              )}
              {dl && <Text style={styles.hint}>{Math.round((progress?.p ?? 0) * 100)}% · use Wi-Fi</Text>}
            </View>
            {dl ? (
              <Btn label="PARAR" onPress={() => cancelDownload()} />
            ) : has ? (
              active ? (
                <Btn
                  label="APAGAR"
                  onPress={() => deleteModel(m).then(refresh)}
                />
              ) : (
                <Btn label="USAR" onPress={() => setCfg({ deviceModel: m.id })} />
              )
            ) : (
              <Btn label="BAIXAR" onPress={() => startDownload(m.id)} disabled={!!progress} />
            )}
          </View>
        );
      })}
      {error && <Text style={[styles.msg, { color: colors.danger }]}>{error}</Text>}

      <Pressable
        onPress={trySample}
        disabled={!ready || sampling}
        style={({ pressed }) => [styles.test, (!ready || sampling) && { opacity: 0.45 }, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
      >
        {sampling ? <ActivityIndicator size="small" color={colors.text} /> : null}
        <Text style={styles.testText}>{sampling ? 'PENSANDO…' : 'OUVIR UM BOT'}</Text>
      </Pressable>
      {sample && <Text style={styles.msg}>{sample}</Text>}
      <Foot />
    </View>
  );
}

function Foot() {
  return (
    <Text style={styles.foot}>
      Quem joga e quem avalia os lances continua sendo o Stockfish. A IA é só a voz dos bots e dos professores, e nada vai
      para a internet.
    </Text>
  );
}

function Btn({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, disabled && { opacity: 0.45 }, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 14,
    },
    statusTag: {
      color: colors.textDim,
      fontFamily: fonts.condensed,
      fontSize: 11,
      letterSpacing: 1.8,
    },
    statusTitle: {
      color: colors.text,
      fontFamily: fonts.condensedHeavy,
      fontSize: 22,
      marginTop: 2,
    },
    statusText: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
    section: {
      color: colors.textDim,
      fontFamily: fonts.condensed,
      fontSize: 12,
      letterSpacing: 1.8,
      marginTop: 18,
      marginBottom: 8,
    },
    model: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
      padding: 12,
      marginBottom: 8,
    },
    modelOn: { borderColor: colors.text },
    modelTitle: { color: colors.text, fontSize: 14, fontFamily: 'Nunito_700Bold',},
    modelSize: { color: colors.textMuted, fontFamily: 'Nunito_600SemiBold',},
    hint: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12, marginTop: 2 },
    bar: { height: 4, backgroundColor: colors.border, borderRadius: 8, marginTop: 8, overflow: 'hidden' },
    barFill: { height: 4, backgroundColor: colors.red },
    btn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    btnText: { color: colors.text, fontFamily: fonts.condensedHeavy,  fontSize: 13, letterSpacing: 1 },
    test: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.text,
      marginTop: 10,
    },
    testText: { color: colors.text, fontFamily: fonts.condensedHeavy,  fontSize: 13, letterSpacing: 1 },
    msg: { fontFamily: 'Nunito_600SemiBold', color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 10 },
    foot: { fontFamily: 'Nunito_600SemiBold', color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 18, marginBottom: 10 },
  })
);
