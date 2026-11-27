import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ajustes da IA local (personalidade dos bots e professores da análise).
 *
 * A IA é só a "voz": quem joga e quem avalia os lances continua sendo o Stockfish.
 * Ela roda no próprio celular (llama.rn). Sem o modelo baixado, o app usa frases prontas.
 */
export interface AiConfig {
  /** Liga/desliga a IA. Desligada, os bots usam frases prontas. */
  enabled: boolean;
  /** Qual modelo usar no celular (ver DEVICE_MODELS). */
  deviceModel: string;
  /** Professor escolhido para a revisão lance a lance (ver COACHES em coach.ts). */
  coachId: string;
  /** Bots e professor falam em voz alta (voz do próprio celular). */
  voice: boolean;
}

export const DEFAULT_AI: AiConfig = {
  enabled: true,
  deviceModel: 'qwen2.5-1.5b',
  coachId: 'didatico',
  voice: true,
};

const KEY = 'ai-config-v1';
let current: AiConfig = DEFAULT_AI;
let loaded = false;
const listeners = new Set<(c: AiConfig) => void>();

export function getAiConfig() {
  return current;
}

export async function loadAiConfig() {
  if (loaded) return current;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_AI, ...JSON.parse(raw) };
  } catch {
    // sem armazenamento: fica no padrão
  }
  listeners.forEach((l) => l(current));
  return current;
}

export function setAiConfig(patch: Partial<AiConfig>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l(current));
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

export function useAiConfig(): [AiConfig, (patch: Partial<AiConfig>) => void] {
  const [cfg, setCfg] = useState(current);
  useEffect(() => {
    listeners.add(setCfg);
    loadAiConfig();
    return () => {
      listeners.delete(setCfg);
    };
  }, []);
  return [cfg, setAiConfig];
}
