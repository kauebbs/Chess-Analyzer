import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BARCODE_SVG, MARK_SVG, WORDMARK_RATIO, WORDMARK_SVG } from '../brand/brandSvgs';
import { colors } from '../theme';

/**
 * Os SVGs da marca são desenhados com as cores do tema claro; aqui elas viram as do tema atual
 * (no escuro: tinta creme, papel escuro, vermelho um pouco mais vivo).
 */
export function themeSvg(svg: string): string {
  // Uma passada só: trocar uma cor de cada vez faria a tinta (já trocada para creme) virar papel de novo
  const map: Record<string, string> = { '#141414': colors.ink, '#ece6da': colors.bg, '#d7261e': colors.red };
  return svg.replace(/#141414|#ece6da|#d7261e/gi, (c) => map[c.toLowerCase()] ?? c);
}

/**
 * Marca do Chess Analyzer no estilo cartaz: papel creme, círculo vermelho e o cavalo em silhueta.
 * Fontes em assets/brand (veja BRAND.md).
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  return <SvgXml xml={themeSvg(MARK_SVG)} width={size} height={size} />;
}

/** Letreiro "CHESS ANALYZER" (vermelho + tinta, condensado alto). */
export function Wordmark({ height = 24 }: { height?: number }) {
  return <SvgXml xml={themeSvg(WORDMARK_SVG)} width={height * WORDMARK_RATIO} height={height} />;
}

/** Marca + letreiro lado a lado. */
export function Lockup({ height = 30 }: { height?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.3 }}>
      <LogoMark size={height} />
      <Wordmark height={height * 0.62} />
    </View>
  );
}

/** Código de barras decorativo (detalhe dos cartazes). */
export function Barcode({ width = 120 }: { width?: number }) {
  return <SvgXml xml={themeSvg(BARCODE_SVG)} width={width} height={width / 6} />;
}
