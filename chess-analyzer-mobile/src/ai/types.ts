export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/** De onde veio o texto: IA do celular ou frase pronta. */
export type AiSource = 'device' | 'fallback';

export const SOURCE_LABEL: Record<AiSource, string> = {
  device: 'IA local',
  fallback: 'Automático',
};
