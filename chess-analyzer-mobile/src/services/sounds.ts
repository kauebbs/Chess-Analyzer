import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Chess } from 'chess.js';

/**
 * Sons do tabuleiro e da partida. Os arquivos em assets/sounds foram sintetizados para este app
 * (sem direitos de terceiros). Cada som tem 2 "vozes" para poder tocar por cima de si mesmo
 * quando você navega rápido pelos lances.
 */

export type SoundName = 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'start' | 'end' | 'chat' | 'lowtime';
export type SoundVolume = 'low' | 'mid' | 'high';

export interface SoundPrefs {
  enabled: boolean;
  volume: SoundVolume;
}

export const DEFAULT_SOUND: SoundPrefs = { enabled: true, volume: 'mid' };

const SOURCES: Record<SoundName, number> = {
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  castle: require('../../assets/sounds/castle.wav'),
  check: require('../../assets/sounds/check.wav'),
  promote: require('../../assets/sounds/promote.wav'),
  start: require('../../assets/sounds/start.wav'),
  end: require('../../assets/sounds/end.wav'),
  chat: require('../../assets/sounds/chat.wav'),
  lowtime: require('../../assets/sounds/lowtime.wav'),
};

const VOLUME: Record<SoundVolume, number> = { low: 0.35, mid: 0.7, high: 1 };

let prefs: SoundPrefs = DEFAULT_SOUND;
let modeSet = false;
const voices: Partial<Record<SoundName, { players: AudioPlayer[]; next: number }>> = {};

export function configureSounds(next: SoundPrefs) {
  prefs = next;
}

function voice(name: SoundName): AudioPlayer | null {
  try {
    let v = voices[name];
    if (!v) {
      v = { players: [createAudioPlayer(SOURCES[name]), createAudioPlayer(SOURCES[name])], next: 0 };
      voices[name] = v;
    }
    const p = v.players[v.next];
    v.next = (v.next + 1) % v.players.length;
    return p;
  } catch {
    return null;
  }
}

/** Deixa os sons prontos (evita atraso no primeiro lance). */
export function preloadSounds() {
  if (!modeSet) {
    modeSet = true;
    // Toca mesmo com o celular no vibrar/silencioso (no Android, com false o expo-audio não toca nada
    // nesses modos) e mistura com a música de outros apps em vez de pausá-la
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }
  (['move', 'capture', 'check', 'castle'] as SoundName[]).forEach((n) => voice(n));
}

export function playSound(name: SoundName) {
  if (!prefs.enabled) return;
  const p = voice(name);
  if (!p) return;
  try {
    p.volume = VOLUME[prefs.volume];
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // sem áudio disponível: segue em silêncio
  }
}

/** Escolhe o som de um lance pela posição antes/depois (serve também para navegar na partida). */
export function soundForPosition(fen: string, moved: { captured: boolean; castled: boolean; promoted: boolean }): SoundName {
  let inCheck = false;
  try {
    inCheck = new Chess(fen).inCheck();
  } catch {
    // FEN estranho: ignora o xeque
  }
  if (inCheck) return 'check';
  if (moved.promoted) return 'promote';
  if (moved.castled) return 'castle';
  if (moved.captured) return 'capture';
  return 'move';
}
