import { Platform } from 'react-native';

/**
 * Identidade visual "cartaz": papel creme, tinta preta e vermelho de impressão, tipografia condensada
 * alta (veja BRAND.md). `mint` é a cor de destaque (agora a tinta preta); o nome ficou para não mexer
 * no app todo — onde há fundo `mint` o texto usa `bg` (papel), e vice-versa.
 */
export const colors = {
  bg: '#ece6da', // Papel
  surface: '#e2dbcc',
  surfaceAlt: '#d7cfbe',
  border: '#c4baa7',
  red: '#d7261e', // Vermelho de impressão
  redDark: '#8f1712',
  mint: '#141414', // destaque = tinta
  mintDark: '#d7261e', // trilho dos interruptores ligados
  text: '#141414', // Tinta
  textDim: '#57524a',
  textMuted: '#8a8378',
  paper: '#ece6da',
  ink: '#141414',
};

/** Fonte condensada nativa de cada plataforma (sem dependências extras). */
export const fonts = {
  condensed: Platform.select({
    android: 'sans-serif-condensed',
    ios: 'AvenirNextCondensed-Bold',
    default: '"Oswald", "Bebas Neue", "Arial Narrow", Impact, sans-serif',
  }) as string,
  condensedHeavy: Platform.select({
    android: 'sans-serif-condensed',
    ios: 'AvenirNextCondensed-Heavy',
    default: '"Oswald", "Bebas Neue", "Arial Narrow", Impact, sans-serif',
  }) as string,
};

export interface BoardTheme {
  name: string;
  light: string;
  dark: string;
  lastMove: string; // sobreposição translúcida
  selected: string; // sobreposição translúcida
  hint: string; // pontos de lance legal
  bestArrow: string;
  secondArrow: string;
  frame: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    name: 'Verde',
    light: '#ebecd0',
    dark: '#739552',
    lastMove: 'rgba(255, 255, 51, 0.45)',
    selected: 'rgba(255, 255, 51, 0.6)',
    hint: 'rgba(0, 0, 0, 0.16)',
    bestArrow: '#e5242b',
    secondArrow: '#1d4ed8',
    frame: '#000000',
  },
  {
    name: 'Menta',
    light: '#e4ede8',
    dark: '#4f9c86',
    lastMove: 'rgba(255, 232, 120, 0.55)',
    selected: 'rgba(229, 36, 43, 0.42)',
    hint: 'rgba(10, 10, 11, 0.28)',
    bestArrow: '#e5242b',
    secondArrow: '#141416',
    frame: '#000000',
  },
  {
    name: 'Noir',
    light: '#cfc9c0',
    dark: '#34343a',
    lastMove: 'rgba(229, 36, 43, 0.38)',
    selected: 'rgba(125, 226, 195, 0.55)',
    hint: 'rgba(125, 226, 195, 0.55)',
    bestArrow: '#7de2c3',
    secondArrow: '#e5242b',
    frame: '#e5242b',
  },
  {
    name: 'Madeira',
    light: '#f0d9b5',
    dark: '#b58863',
    lastMove: 'rgba(205, 210, 106, 0.75)',
    selected: 'rgba(20, 85, 30, 0.45)',
    hint: 'rgba(20, 30, 20, 0.25)',
    bestArrow: '#15803d',
    secondArrow: '#0369a1',
    frame: '#2b1d12',
  },
  {
    name: 'Azul',
    light: '#dee3e6',
    dark: '#8ca2ad',
    lastMove: 'rgba(155, 199, 0, 0.41)',
    selected: 'rgba(255, 214, 10, 0.55)',
    hint: 'rgba(15, 23, 42, 0.25)',
    bestArrow: '#e5242b',
    secondArrow: '#0f172a',
    frame: '#0f172a',
  },
  {
    name: 'Neon',
    light: '#262b3d',
    dark: '#151826',
    lastMove: 'rgba(255, 43, 214, 0.28)',
    selected: 'rgba(57, 255, 136, 0.35)',
    hint: 'rgba(57, 255, 136, 0.55)',
    bestArrow: '#39ff88',
    secondArrow: '#ff2bd6',
    frame: '#39ff88',
  },
  {
    name: 'Pôster',
    light: '#f2ede2',
    dark: '#a39b8a',
    lastMove: 'rgba(215, 38, 30, 0.34)',
    selected: 'rgba(20, 20, 20, 0.22)',
    hint: 'rgba(20, 20, 20, 0.28)',
    bestArrow: '#d7261e',
    secondArrow: '#141414',
    frame: '#141414',
  },
];

/** Tema padrão para quem instala agora (o salvo nas configurações continua valendo). */
export const DEFAULT_THEME_IDX = 6;
