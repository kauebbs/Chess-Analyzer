import * as FileSystem from 'expo-file-system/legacy';
import { TurboModuleRegistry } from 'react-native';
import type { ChatMsg, GenOptions } from './types';

/**
 * IA rodando no próprio celular, com llama.rn (llama.cpp).
 *
 * O llama.rn é um módulo nativo: só existe no app instalado pelo build (EAS), não no Expo Go.
 * Ele é carregado com `require` dentro de try/catch para o app não quebrar onde ele não existe.
 */

export interface DeviceModel {
  id: string;
  label: string;
  sizeLabel: string;
  /** Tamanho real do arquivo (para conferir o download e o espaço livre). */
  bytes: number;
  file: string;
  url: string;
  hint: string;
}

export const DEVICE_MODELS: DeviceModel[] = [
  {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B',
    sizeLabel: '1,1 GB',
    bytes: 1_117_320_736,
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    hint: 'Recomendado. Celular com 4 GB de RAM ou mais.',
  },
  {
    id: 'qwen2.5-0.5b',
    label: 'Qwen 2.5 0.5B',
    sizeLabel: '490 MB',
    bytes: 491_400_032,
    file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    hint: 'Mais leve e rápido, mas escreve pior. Para celular simples.',
  },
];

const STOP = ['<|im_end|>', '<|endoftext|>', '</s>', '<|eot_id|>', '<end_of_turn>'];

let llamaMod: any | null | undefined;
function llama(): any | null {
  if (llamaMod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      llamaMod = require('llama.rn');
    } catch {
      llamaMod = null;
    }
  }
  return llamaMod;
}

/** O app tem a IA nativa? (falso no Expo Go: o JS do llama.rn existe, mas o módulo nativo não) */
export function deviceAiSupported() {
  const m = llama();
  if (!m || typeof m.initLlama !== 'function') return false;
  try {
    return !!TurboModuleRegistry.get('RNLlama');
  } catch {
    return false;
  }
}

const dir = () => `${FileSystem.documentDirectory ?? ''}ia/`;
export const modelPath = (m: DeviceModel) => `${dir()}${m.file}`;
export const findModel = (id: string) => DEVICE_MODELS.find((m) => m.id === id) ?? DEVICE_MODELS[0];

/** API nova do expo-file-system (SDK 54+). Carregada sob demanda para o web/Expo Go não quebrarem. */
function fsNext(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-file-system');
    return m?.File && m?.Directory && m?.Paths ? m : null;
  } catch {
    return null;
  }
}

export async function isModelDownloaded(m: DeviceModel) {
  try {
    const info = await FileSystem.getInfoAsync(modelPath(m));
    return info.exists && ((info as any).size ?? 0) > m.bytes * 0.9;
  } catch {
    return false;
  }
}

let abort: AbortController | null = null;
let legacyTask: FileSystem.DownloadResumable | null = null;
let cancelled = false;
export const DOWNLOAD_CANCELLED = 'cancelado';

const gb = (b: number) => `${(b / 1e9).toFixed(1).replace('.', ',')} GB`;

/** Explica o erro do download em português (com o detalhe técnico no fim, para depuração). */
function downloadError(e: any): Error {
  const raw = String(e?.message ?? e ?? 'erro desconhecido');
  const low = raw.toLowerCase();
  let msg = 'O download falhou.';
  if (/space|espaço|enospc|no space/.test(low)) msg = 'Sem espaço suficiente no celular.';
  else if (/timeout|timed out|unable to resolve|network|failed to connect|unknownhost|ssl|socket/.test(low))
    msg = 'A conexão caiu ou está lenta. Use Wi-Fi e tente de novo.';
  else if (/40[13]|forbidden|unauthorized/.test(low)) msg = 'O servidor do modelo recusou o download.';
  else if (/404|not found/.test(low)) msg = 'O arquivo do modelo não foi encontrado no servidor.';
  return new Error(`${msg} (detalhe: ${raw.slice(0, 160)})`);
}

/**
 * Baixa o modelo (uma vez só). `onProgress` recebe 0..1.
 * Usa a API nova do expo-file-system; se ela falhar, tenta a antiga (legacy). Baixa para um arquivo
 * ".part" e só renomeia no fim, para um download pela metade nunca ser tomado como pronto.
 */
export async function downloadModel(m: DeviceModel, onProgress: (p: number) => void) {
  cancelled = false;
  const next = fsNext();

  // Espaço livre: o modelo + uma folga de 200 MB
  try {
    const free = next?.Paths?.availableDiskSpace ?? (await FileSystem.getFreeDiskStorageAsync());
    if (typeof free === 'number' && free > 0 && free < m.bytes + 200e6) {
      throw new Error(`Sem espaço suficiente: precisa de ${gb(m.bytes + 200e6)} livres e há ${gb(free)}. Apague algo ou escolha o modelo menor.`);
    }
  } catch (e: any) {
    if (String(e?.message).startsWith('Sem espaço')) throw e;
  }

  await FileSystem.makeDirectoryAsync(dir(), { intermediates: true }).catch(() => {});
  const tmp = `${modelPath(m)}.part`;
  await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});

  let firstError: any = null;
  if (next) {
    try {
      abort = new AbortController();
      const part = new next.File(tmp);
      await next.File.downloadFileAsync(m.url, part, {
        idempotent: true,
        signal: abort.signal,
        onProgress: (p: { bytesWritten: number; totalBytes: number }) => {
          const total = p.totalBytes > 0 ? p.totalBytes : m.bytes;
          onProgress(Math.min(1, p.bytesWritten / total));
        },
      });
    } catch (e: any) {
      if (cancelled || e?.name === 'AbortError') throw new Error(DOWNLOAD_CANCELLED);
      firstError = e;
    } finally {
      abort = null;
    }
  }

  if (!next || firstError) {
    // Reserva: API antiga
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    legacyTask = FileSystem.createDownloadResumable(m.url, tmp, {}, (p) => {
      const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : m.bytes;
      onProgress(Math.min(1, p.totalBytesWritten / total));
    });
    try {
      const res = await legacyTask.downloadAsync();
      if (cancelled) throw new Error(DOWNLOAD_CANCELLED);
      if (!res || res.status >= 400) throw new Error(`HTTP ${res?.status ?? '?'}`);
    } catch (e: any) {
      if (cancelled || e?.message === DOWNLOAD_CANCELLED) throw new Error(DOWNLOAD_CANCELLED);
      throw downloadError(firstError ? `${firstError?.message ?? firstError} | reserva: ${e?.message ?? e}` : e);
    } finally {
      legacyTask = null;
    }
  }

  // Confere o tamanho antes de dar como pronto
  const info: any = await FileSystem.getInfoAsync(tmp);
  if (!info.exists || (info.size ?? 0) < m.bytes * 0.9) {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    throw downloadError(`arquivo incompleto (${info.size ?? 0} bytes)`);
  }
  await FileSystem.deleteAsync(modelPath(m), { idempotent: true }).catch(() => {});
  await FileSystem.moveAsync({ from: tmp, to: modelPath(m) });
}

export async function cancelDownload() {
  cancelled = true;
  abort?.abort();
  await legacyTask?.pauseAsync().catch(() => {});
  legacyTask = null;
}

export async function deleteModel(m: DeviceModel) {
  await releaseDevice();
  await FileSystem.deleteAsync(modelPath(m), { idempotent: true });
}

// ---------- Contexto do modelo (carregado sob demanda, um por vez) ----------
let ctx: any = null;
let ctxModel: string | null = null;
let loading: Promise<any> | null = null;

/** Carrega o modelo na memória (alguns segundos na 1ª vez). Chamado também para "esquentar" antes de usar. */
export async function loadDeviceModel(modelId: string) {
  return context(findModel(modelId));
}

export const isDeviceModelLoaded = (modelId: string) => !!ctx && ctxModel === modelId;

async function context(m: DeviceModel) {
  if (ctx && ctxModel === m.id) return ctx;
  if (loading) return loading;
  const mod = llama();
  if (!mod) throw new Error('IA nativa indisponível');
  loading = (async () => {
    await releaseDevice();
    const c = await mod.initLlama({ model: modelPath(m), n_ctx: 2048, n_gpu_layers: 0, use_mlock: false });
    ctx = c;
    ctxModel = m.id;
    return c;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export async function releaseDevice() {
  const c = ctx;
  ctx = null;
  ctxModel = null;
  await c?.release?.().catch?.(() => {});
}

export class AiTimeout extends Error {}

export async function deviceChat(modelId: string, messages: ChatMsg[], opts: GenOptions): Promise<string> {
  const m = findModel(modelId);
  // Carregar o modelo não conta no tempo limite: só a resposta
  const c = await context(m);
  const run = c.completion({
    messages,
    n_predict: opts.maxTokens ?? 120,
    temperature: opts.temperature ?? 0.8,
    stop: STOP,
  });
  // Passou do tempo: para a geração e aproveita o que já saiu, cortado na última frase completa
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    c.stopCompletion?.()?.catch?.(() => {});
  }, opts.timeoutMs ?? 25000);
  try {
    const res: any = await run;
    let text = String(res?.text ?? res?.content ?? '');
    if (timedOut) {
      const end = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
      if (end < 20) throw new AiTimeout('A IA demorou demais');
      text = text.slice(0, end + 1);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}
