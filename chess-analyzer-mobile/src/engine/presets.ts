import { Platform } from 'react-native';
import type { IconName } from '../components/Icon';

export type ReviewMode = 'quick' | 'medium' | 'deep';

export interface ReviewPreset {
  label: string;
  description: string;
  icon: IconName;
  depth: number;
  movetimeMs: number;
}

// No celular o Stockfish (WASM, 1 thread) é bem mais lento, então as profundidades são menores.
const IS_WEB = Platform.OS === 'web';

export const REVIEW_PRESETS: Record<ReviewMode, ReviewPreset> = {
  quick: {
    label: 'Rápida',
    description: 'Uma passada rápida para ver os erros grosseiros.',
    icon: 'zap',
    depth: IS_WEB ? 10 : 9,
    movetimeMs: IS_WEB ? 250 : 300,
  },
  medium: {
    label: 'Média',
    description: 'Equilíbrio entre tempo e precisão. Boa para o dia a dia.',
    icon: 'gauge',
    depth: IS_WEB ? 14 : 12,
    movetimeMs: IS_WEB ? 900 : 800,
  },
  deep: {
    label: 'Profunda',
    description: 'Mais tempo por lance: brilhantes e lances únicos mais confiáveis.',
    icon: 'layers',
    depth: IS_WEB ? 18 : 16,
    movetimeMs: IS_WEB ? 2500 : 2500,
  },
};

/** Profundidade da análise ao vivo (lupa). */
export const LIVE_DEPTH = IS_WEB ? 16 : 13;
