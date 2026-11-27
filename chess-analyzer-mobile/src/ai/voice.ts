import { getAiConfig } from './config';

/**
 * Voz dos bots e do professor (texto → fala do próprio Android, sem internet).
 * Usa o expo-speech; se ele não existir (app antigo), simplesmente não fala.
 */

let speech: any | null | undefined;
function mod() {
  if (speech === undefined) {
    speech = null;
    try {
      // Só carrega o expo-speech se o módulo nativo existir no app instalado. Importar sem ele faz o
      // expo-speech estourar um erro fatal ("Cannot find native module 'ExpoSpeech'") — o caso de um
      // build feito antes da voz entrar. Sem o módulo, o app segue sem som.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const core = require('expo-modules-core');
      if (core?.requireOptionalNativeModule?.('ExpoSpeech')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        speech = require('expo-speech');
      }
    } catch {
      speech = null;
    }
  }
  return speech;
}

/** Tom de voz por personalidade/professor: pitch e velocidade. */
const TONES: Record<string, { pitch: number; rate: number }> = {
  provocador: { pitch: 1.05, rate: 1.08 },
  gentil: { pitch: 1.15, rate: 0.95 },
  narrador: { pitch: 1.0, rate: 1.2 },
  nervoso: { pitch: 1.3, rate: 1.15 },
  sabio: { pitch: 0.75, rate: 0.85 },
  competitivo: { pitch: 0.9, rate: 1.0 },
  didatico: { pitch: 1.1, rate: 0.95 },
  direto: { pitch: 0.85, rate: 1.0 },
  motivador: { pitch: 1.0, rate: 1.05 },
};

/** Tira emojis e notação que soa estranha falada ("+1,4" vira "mais 1,4"). */
function forSpeech(text: string) {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\+(\d)/g, 'mais $1')
    .replace(/(^|\s)-(\d)/g, '$1menos $2')
    .replace(/[*_#`]/g, '')
    .trim();
}

export function voiceEnabled() {
  const c = getAiConfig();
  return c.voice && !!mod();
}

/** Fala o texto (interrompe a fala anterior). `tone` = id da personalidade ou do professor. */
export function speak(text: string, tone?: string) {
  const s = mod();
  if (!s || !getAiConfig().voice) return;
  const clean = forSpeech(text);
  if (!clean) return;
  const t = (tone && TONES[tone]) || { pitch: 1, rate: 1 };
  try {
    s.stop();
    s.speak(clean, { language: 'pt-BR', pitch: t.pitch, rate: t.rate });
  } catch {
    // sem voz no aparelho: segue sem som
  }
}

export function stopSpeaking() {
  try {
    mod()?.stop();
  } catch {
    // ignora
  }
}
