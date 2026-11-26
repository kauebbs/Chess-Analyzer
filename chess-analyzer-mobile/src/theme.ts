import { Platform } from 'react-native';

/**
 * Identidade visual "cartaz": papel creme, tinta preta e vermelho de impressão, tipografia condensada
 * alta (veja BRAND.md). `mint` é a cor de destaque (a tinta); o nome ficou para não mexer no app todo:
 * onde há fundo `mint` o texto usa `bg`, e vice-versa. `ink`/`paper` são o par "traço forte"/"contraste
 * do traço" e se invertem no tema escuro; `onRed` é o texto sobre o vermelho nos dois temas.
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
};

export const LIGHT: Palette = {
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
  textMuted: '#666058', // ≥ 4,5:1 sobre o papel
  paper: '#ece6da',
  ink: '#141414',
  onRed: '#f6f1e7',
};

/** Tema escuro: o "negativo" do cartaz — fundo quase preto puxado para o marrom, tinta creme. */
export const DARK: Palette = {
  bg: '#151413',
  surface: '#1e1c1a',
  surfaceAlt: '#292623',
  border: '#3b3732',
  red: '#e2392e', // um pouco mais claro para manter o contraste no escuro
  redDark: '#a3221a',
  mint: '#ece6da',
  mintDark: '#e2392e',
  text: '#ece6da',
  textDim: '#aba294',
  textMuted: '#938c81', // ≥ 4,5:1 sobre o fundo escuro
  paper: '#151413',
  ink: '#ece6da',
  onRed: '#f6f1e7',
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
