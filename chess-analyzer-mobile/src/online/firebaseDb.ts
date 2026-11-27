/**
 * Funções do firebase/database carregadas sob demanda. O SDK do Firebase é grande e, importado no topo,
 * era avaliado na abertura do app (o App.tsx importa os serviços online para ler os links de convite).
 * Agora ele só é carregado quando alguém usa o jogo online ou o torneio online.
 */
type Db = typeof import('firebase/database');

let mod: Db | null = null;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = (): Db => (mod ??= require('firebase/database') as Db);

export const getDatabase = ((...a: any[]) => (db().getDatabase as any)(...a)) as Db['getDatabase'];
export const ref = ((...a: any[]) => (db().ref as any)(...a)) as Db['ref'];
export const get = ((...a: any[]) => (db().get as any)(...a)) as Db['get'];
export const set = ((...a: any[]) => (db().set as any)(...a)) as Db['set'];
export const update = ((...a: any[]) => (db().update as any)(...a)) as Db['update'];
export const remove = ((...a: any[]) => (db().remove as any)(...a)) as Db['remove'];
export const onValue = ((...a: any[]) => (db().onValue as any)(...a)) as Db['onValue'];
export const onDisconnect = ((...a: any[]) => (db().onDisconnect as any)(...a)) as Db['onDisconnect'];
export const runTransaction = ((...a: any[]) => (db().runTransaction as any)(...a)) as Db['runTransaction'];
