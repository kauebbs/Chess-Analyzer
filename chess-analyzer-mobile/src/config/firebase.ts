/**
 * Configuração do Firebase para o jogo online.
 *
 * Como preencher (veja ONLINE.md):
 *  1. console.firebase.google.com → criar projeto → adicionar app "Web" (</>).
 *  2. Copie os valores de `firebaseConfig` que o console mostra para cá.
 *  3. Em Build → Authentication → Sign-in method, ative "Anônimo".
 *  4. Em Build → Realtime Database, crie o banco e cole as regras de firebase/database.rules.json.
 *
 * Esses valores não são secretos (vão em qualquer app web com Firebase); quem protege os
 * dados são as regras do banco.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAPpYkJs2yw_RN1vtoIcxe-xAMdJPmsrFQ',
  authDomain: 'chess-analyzer-571ad.firebaseapp.com',
  databaseURL: 'https://chess-analyzer-571ad-default-rtdb.firebaseio.com', // ex.: https://seu-projeto-default-rtdb.firebaseio.com
  projectId: 'chess-analyzer-571ad',
  storageBucket: 'chess-analyzer-571ad.firebasestorage.app',
  messagingSenderId: '511913674590',
  appId: '1:511913674590:web:dd37863903d7542128b1cf',
};

/**
 * Endereço da versão web do app (Firebase Hosting), ex.: https://seu-projeto.web.app
 * Se preenchido, o convite manda um link que abre o jogo no navegador de qualquer pessoa.
 * Se ficar vazio, o convite manda o código da sala e o link chessanalyzer:// (só abre com o app).
 */
export const WEB_URL: string = '';

export const isFirebaseConfigured = () =>
  !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.databaseURL && !!FIREBASE_CONFIG.appId;
