import { Platform } from 'react-native';

/**
 * Identidade NOXARI CHESS ("Playful Chess Identity"): creme confortável, verde como cor de reconhecimento,
 * grafite para o texto, amarelo/azul/laranja como apoio (veja BRAND.md).
 *
 * Os nomes antigos dos tokens ficaram para não mexer no app todo:
 * - `red` = cor de AÇÃO da marca (verde Noxari); `redDark` = a "sombra" 3D dos botões verdes.
 * - `mint`/`ink` = traço forte (grafite no claro, creme no escuro); `paper` = contraste do traço.
 * - `onRed` = texto sobre o verde. `brandText` = verde legível como TEXTO sobre o fundo.
 * - `danger` = erro de verdade (download falhou, derrota) — não confundir com a cor da marca.
 */
export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  red: string;
  redDark: string;
  mint: string;
  mintDark: string;
  text: string;
  textDim: string;
  textMuted: string;
  paper: string;
  ink: string;
  onRed: string;
  brandText: string;
  forest: string;
  yellow: string;
  yellowDark: string;
  blue: string;
  blueDark: string;
  orange: string;
  orangeDark: string;
  brown: string;
  danger: string;
  shadow: string;
};

export const LIGHT: Palette = {
  bg: '#FFF5DF', // Creme
  surface: '#FFFBF1', // card
  surfaceAlt: '#F6E8C8', // card "afundado" / chips
  border: '#EBDAB4',
  red: '#58CC65', // Verde principal (ação)
  redDark: '#3E9E4C', // borda 3D dos botões verdes
  mint: '#303A35', // Grafite
  mintDark: '#58CC65', // trilho dos interruptores ligados
  text: '#303A35',
  textDim: '#56615B',
  textMuted: '#6A736D', // ≥ 4,5:1 sobre o creme
  paper: '#FFF5DF',
  ink: '#303A35',
  onRed: '#FFFFFF',
  brandText: '#287D42', // Verde escuro (texto)
  forest: '#254235', // verde-floresta da capa da mascote
  yellow: '#FFC83D',
  yellowDark: '#D69A12',
  blue: '#42B9E8',
  blueDark: '#2389B3',
  orange: '#FF994D',
  orangeDark: '#D9702A',
  brown: '#A96943',
  danger: '#E0453A',
  shadow: '#C9B68C',
};

/** Escuro: a "noite na floresta" — verde-floresta profundo, texto creme, o mesmo verde de ação. */
export const DARK: Palette = {
  bg: '#16211B',
  surface: '#1E2C24',
  surfaceAlt: '#27382E',
  border: '#33493C',
  red: '#58CC65',
  redDark: '#2F7F3C',
  mint: '#FFF5DF',
  mintDark: '#58CC65',
  text: '#FFF5DF',
  textDim: '#CFC6AE',
  textMuted: '#A9A28E',
  paper: '#16211B',
  ink: '#FFF5DF',
  onRed: '#FFFFFF',
  brandText: '#7FDC8A',
  forest: '#0F1A14',
  yellow: '#FFC83D',
  yellowDark: '#B88310',
  blue: '#42B9E8',
  blueDark: '#1F7499',
  orange: '#FF994D',
  orangeDark: '#BF5F1F',
  brown: '#C98A5F',
  danger: '#FF6B5E',
  shadow: '#0A120E',
};

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Cores atuais. O objeto é o mesmo o tempo todo; `applyPalette` troca os valores. Os estilos leem as
 * cores na hora (getters), então ao remontar as telas elas já saem com o tema novo.
 */
export const colors: Palette = { ...LIGHT };
export let isDark = false;

/** Muda a cada troca de tema; as folhas de estilo de `themed()` se refazem quando ele muda. */
export let themeVersion = 0;

export function applyPalette(dark: boolean) {
  Object.assign(colors, dark ? DARK : LIGHT);
  isDark = dark;
  themeVersion += 1;
}

/**
 * Folha de estilos que acompanha o tema: `factory` lê as cores atuais e é refeita (objetos novos, valores
 * fixos) sempre que o tema muda. Assim nada fica preso no tema anterior — nem no Android, nem depois de
 * um recarregamento parcial do Expo Go.
 */
export function themed<T extends object>(factory: () => T): T {
  let version = -1;
  let cache: T;
  const current = () => {
    if (version !== themeVersion) {
      cache = factory();
      version = themeVersion;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (current() as any)[key],
    has: (_t, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

// No web (simulador de testes) dá para abrir já no escuro com ?tema=escuro
if (Platform.OS === 'web' && typeof window !== 'undefined' && /tema=escuro/.test(window.location?.search ?? '')) {
  applyPalette(true);
}

/**
 * Tipografia Noxari: Nunito (arredondada, amigável) — uma família só, hierarquia pelo peso.
 * As fontes são carregadas em App.tsx (useFonts). `condensed`/`condensedHeavy` são os nomes antigos
 * dos títulos; hoje apontam para Nunito ExtraBold/Black.
 */
export const FONT_FILES = {
  regular: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extra: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

/** Família da Nunito para um peso (no Android o peso vem da família, não do fontWeight). */
export function fontFor(weight?: string | number) {
  const w = weight === 'bold' ? 700 : Number(weight) || 600;
  if (w >= 900) return FONT_FILES.black;
  if (w >= 800) return FONT_FILES.extra;
  if (w >= 700) return FONT_FILES.bold;
  return FONT_FILES.regular;
}

export const fonts = {
  condensed: FONT_FILES.extra,
  condensedHeavy: FONT_FILES.black,
  body: FONT_FILES.regular,
  bold: FONT_FILES.bold,
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
    name: 'Noxari',
    light: '#F4EFD9',
    dark: '#9DBF83',
    lastMove: 'rgba(255, 200, 61, 0.55)',
    selected: 'rgba(255, 200, 61, 0.7)',
    hint: 'rgba(37, 66, 53, 0.28)',
    bestArrow: '#58CC65',
    secondArrow: '#42B9E8',
    frame: '#254235',
  },
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
export const DEFAULT_THEME_IDX = 0;
