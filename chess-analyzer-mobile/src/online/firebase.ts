import { Platform } from 'react-native';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Database, getDatabase, onValue, ref } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from '../config/firebase';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
let serverOffset = 0;

function init() {
  if (app) return;
  app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    // No React Native o login precisa ser salvo no AsyncStorage para sobreviver ao fechar o app
    // (getReactNativePersistence só existe no build react-native do firebase/auth).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth');
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      auth = getAuth(app); // já inicializado (recarga rápida)
    }
  }

  db = getDatabase(app);
  // Diferença entre o relógio do aparelho e o do servidor (para os relógios da partida)
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    serverOffset = Number(snap.val() ?? 0);
  });
}

export function database(): Database {
  init();
  return db!;
}

/** Hora estimada do servidor (ms). */
export const serverNow = () => Date.now() + serverOffset;

/** Garante um login anônimo e devolve o id do jogador. */
export async function ensureSignedIn(): Promise<string> {
  init();
  if (auth!.currentUser) return auth!.currentUser.uid;
  // Espera o login salvo carregar antes de criar outro
  const existing = await new Promise<string | null>((resolve) => {
    const unsub = onAuthStateChanged(auth!, (user) => {
      unsub();
      resolve(user?.uid ?? null);
    });
  });
  if (existing) return existing;
  const cred = await signInAnonymously(auth!);
  return cred.user.uid;
}

const NAME_KEY = 'online:name';

export async function loadPlayerName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(NAME_KEY)) || '';
  } catch {
    return '';
  }
}

export async function savePlayerName(name: string) {
  try {
    await AsyncStorage.setItem(NAME_KEY, name);
  } catch {
    // sem problema: o nome só não fica salvo
  }
}
