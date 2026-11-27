import { getAiConfig, loadAiConfig } from './config';
import { AiTimeout, deviceAiSupported, deviceChat, findModel, isModelDownloaded } from './device';
import type { AiSource, ChatMsg, GenOptions } from './types';

export * from './types';

/**
 * Ponto único para gerar texto com a IA local (no celular).
 * Devolve `null` quando não há IA: quem chama usa a frase pronta.
 * Os pedidos saem em fila (um de cada vez), porque o modelo no celular só atende um por vez.
 */

let queue: Promise<unknown> = Promise.resolve();
/** Se o modelo falhar ao carregar, espera um pouco antes de tentar de novo (não trava o jogo). */
let backoffUntil = 0;
const BACKOFF_MS = 60000;

export interface GenResult {
  text: string;
  source: AiSource;
}

/** A IA pode ser usada agora? (ligada, app com IA nativa e modelo baixado) */
export async function aiReady() {
  const cfg = await loadAiConfig().then(() => getAiConfig());
  if (!cfg.enabled || !deviceAiSupported()) return false;
  return isModelDownloaded(findModel(cfg.deviceModel));
}

async function tryGenerate(messages: ChatMsg[], opts: GenOptions): Promise<GenResult | null> {
  if (Date.now() < backoffUntil || !(await aiReady())) return null;
  try {
    const text = clean(await deviceChat(getAiConfig().deviceModel, messages, opts));
    return text ? { text, source: 'device' } : null;
  } catch (e) {
    // Demorar não é defeito (celular ocupado); falhar ao carregar é: dá um tempo antes de tentar de novo
    if (!(e instanceof AiTimeout)) backoffUntil = Date.now() + BACKOFF_MS;
    return null;
  }
}

export function generate(messages: ChatMsg[], opts: GenOptions = {}): Promise<GenResult | null> {
  const run = queue.then(() => tryGenerate(messages, opts));
  queue = run.catch(() => null);
  return run.catch(() => null);
}

/** Zera a espera depois de mudar os ajustes (o usuário acabou de configurar). */
export function resetAiBackoff() {
  backoffUntil = 0;
}

/** Limpa o que modelo pequeno costuma deixar: <think> e tokens especiais. */
export function clean(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|[^|]*\|>/g, '')
    .trim();
}
