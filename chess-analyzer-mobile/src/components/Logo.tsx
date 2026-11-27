import React from 'react';
import { Image, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * Marca NOXARI CHESS. Símbolo: a capivara Nox no quadrado verde-floresta (o mesmo do ícone do app).
 * Letreiro: "Noxari" em Nunito Black + "CHESS" pequeno e espaçado, como complemento.
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      accessibilityLabel="Noxari Chess"
    />
  );
}

/** Letreiro "Noxari CHESS". `height` é a altura da palavra Noxari. */
export function Wordmark({ height = 24, color }: { height?: number; color?: string }) {
  const c = color ?? colors.brandText;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: height * 0.28 }} accessibilityLabel="Noxari Chess">
      <Text style={{ fontFamily: fonts.condensedHeavy, fontSize: height * 1.25, lineHeight: height * 1.4, color: c, letterSpacing: -0.5 }}>
        Noxari
      </Text>
      <Text style={{ fontFamily: fonts.condensedHeavy, fontSize: height * 0.48, color: c, letterSpacing: height * 0.12, opacity: 0.75 }}>
        CHESS
      </Text>
    </View>
  );
}

/** Símbolo + letreiro lado a lado. */
export function Lockup({ height = 30 }: { height?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.32 }}>
      <LogoMark size={height} />
      <Wordmark height={height * 0.6} />
    </View>
  );
}
