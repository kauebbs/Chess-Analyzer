import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

/**
 * Nox, a capivara da Noxari Chess. As poses são ilustrações emolduradas tiradas da arte oficial, com o
 * fundo creme original (nada de recorte: o recorte deixava a borda serrilhada). Use sempre por aqui,
 * para a mascote ficar igual em todo lugar.
 */
export const MASCOT = {
  hero: { src: require('../../assets/mascote/hero.png'), ratio: 1.1628 },
  festa: { src: require('../../assets/mascote/festa.png'), ratio: 0.9292 },
  pensa: { src: require('../../assets/mascote/pensa.png'), ratio: 0.844 },
  rei: { src: require('../../assets/mascote/rei.png'), ratio: 0.8411 },
  tonta: { src: require('../../assets/mascote/tonta.png'), ratio: 1.0652 },
  oculos: { src: require('../../assets/mascote/oculos.png'), ratio: 1.1798 },
  livro: { src: require('../../assets/mascote/livro.png'), ratio: 1.5412 },
  av_festa: { src: require('../../assets/mascote/av_festa.png'), ratio: 1 },
  av_livro: { src: require('../../assets/mascote/av_livro.png'), ratio: 1 },
  av_oculos: { src: require('../../assets/mascote/av_oculos.png'), ratio: 1 },
};
export type MascotPose = keyof typeof MASCOT;

/** A mascote numa pose, emoldurada (cantos arredondados). A largura sai da proporção da arte. */
export function Mascot({
  pose,
  height,
  radius,
  style,
}: {
  pose: MascotPose;
  height: number;
  /** Raio do canto; padrão ~16% da altura. Para avatar redondo, passe height / 2. */
  radius?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const m = MASCOT[pose];
  return (
    <Image
      source={m.src}
      style={[{ height, width: height * m.ratio, borderRadius: radius ?? Math.round(height * 0.16) }, style]}
      resizeMode="cover"
      accessible={false}
    />
  );
}
