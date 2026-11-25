import { Easing, EasingFunction } from 'react-native';

export type PieceSpeed = 'off' | 'fast' | 'normal' | 'slow';
export type MotionStyle = 'smooth' | 'natural' | 'bouncy';
export type EffectIntensity = 'light' | 'normal' | 'strong';

/** Preferências de animação (salvas no aparelho). */
export interface AnimationPrefs {
  pieceSpeed: PieceSpeed;
  motionStyle: MotionStyle;
  /** Peça capturada some encolhendo; ao voltar o lance ela reaparece. */
  captureEffect: boolean;
  /** Selo do lance "pula" ao aparecer na peça. */
  badgePop: boolean;
  /** Setas do motor aparecem com um fade. */
  arrowFade: boolean;
  /** Barra de avaliação desliza até o novo valor. */
  evalBarSmooth: boolean;
  celebrateBrilliant: boolean;
  celebrateCheckmate: boolean;
  celebrateVictory: boolean;
  intensity: EffectIntensity;
}

export const DEFAULT_ANIMATION: AnimationPrefs = {
  pieceSpeed: 'normal',
  motionStyle: 'smooth',
  captureEffect: true,
  badgePop: true,
  arrowFade: true,
  evalBarSmooth: true,
  celebrateBrilliant: true,
  celebrateCheckmate: true,
  celebrateVictory: true,
  intensity: 'normal',
};

export const PIECE_SPEED_OPTIONS: { id: PieceSpeed; label: string }[] = [
  { id: 'off', label: 'Sem' },
  { id: 'fast', label: 'Rápida' },
  { id: 'normal', label: 'Normal' },
  { id: 'slow', label: 'Lenta' },
];

export const MOTION_STYLE_OPTIONS: { id: MotionStyle; label: string }[] = [
  { id: 'smooth', label: 'Suave' },
  { id: 'natural', label: 'Natural' },
  { id: 'bouncy', label: 'Elástico' },
];

export const INTENSITY_OPTIONS: { id: EffectIntensity; label: string }[] = [
  { id: 'light', label: 'Leve' },
  { id: 'normal', label: 'Normal' },
  { id: 'strong', label: 'Intensa' },
];

const SPEED_MS: Record<PieceSpeed, number> = { off: 0, fast: 110, normal: 190, slow: 300 };

export const pieceDuration = (speed: PieceSpeed) => SPEED_MS[speed] ?? SPEED_MS.normal;

export function motionEasing(style: MotionStyle): EasingFunction {
  switch (style) {
    case 'natural':
      return Easing.inOut(Easing.cubic);
    case 'bouncy':
      return Easing.out(Easing.back(1.7));
    default:
      return Easing.out(Easing.cubic);
  }
}

/** Multiplicador de partículas (faíscas, confete) e de duração das comemorações. */
export const intensityScale = (i: EffectIntensity) => (i === 'light' ? 0.5 : i === 'strong' ? 1.7 : 1);

export type CelebrationType = 'brilliant' | 'checkmate' | 'victory' | 'draw';

export function celebrationAllowed(prefs: AnimationPrefs, type: CelebrationType) {
  if (type === 'brilliant') return prefs.celebrateBrilliant;
  if (type === 'checkmate') return prefs.celebrateCheckmate;
  return prefs.celebrateVictory;
}

/** Aceita preferências antigas/incompletas salvas no aparelho. */
export function normalizeAnimation(raw: unknown): AnimationPrefs {
  const out: AnimationPrefs = { ...DEFAULT_ANIMATION };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  (Object.keys(DEFAULT_ANIMATION) as (keyof AnimationPrefs)[]).forEach((k) => {
    if (typeof r[k] === typeof DEFAULT_ANIMATION[k]) (out as any)[k] = r[k];
  });
  if (!PIECE_SPEED_OPTIONS.some((o) => o.id === out.pieceSpeed)) out.pieceSpeed = DEFAULT_ANIMATION.pieceSpeed;
  if (!MOTION_STYLE_OPTIONS.some((o) => o.id === out.motionStyle)) out.motionStyle = DEFAULT_ANIMATION.motionStyle;
  if (!INTENSITY_OPTIONS.some((o) => o.id === out.intensity)) out.intensity = DEFAULT_ANIMATION.intensity;
  return out;
}
