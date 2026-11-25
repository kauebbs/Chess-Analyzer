# Jogo online (Firebase)

O "Jogar online" usa um projeto **gratuito** do Firebase como servidor: o Realtime Database guarda as
partidas e o login anônimo identifica cada jogador (sem cadastro). Configuração única, ~10 minutos.

## 1. Criar o projeto

1. Acesse <https://console.firebase.google.com> e clique em **Criar projeto** (pode desativar o Google Analytics).
2. Na página do projeto, clique no ícone **Web `</>`** para adicionar um app. Dê um nome (ex.: `chess-analyzer`)
   e marque **"Também configurar o Firebase Hosting"** se quiser o link que abre no navegador (passo 5).
3. O console mostra um bloco `const firebaseConfig = { ... }`. Copie os valores para
   `src/config/firebase.ts`, no objeto `FIREBASE_CONFIG`.

## 2. Ativar o login anônimo

**Build → Authentication → Começar → Sign-in method → Anônimo → Ativar → Salvar.**

## 3. Criar o banco de dados

1. **Build → Realtime Database → Criar banco de dados** (escolha a região `us-central1`, a gratuita).
2. Comece em **modo bloqueado**.
3. Abra a aba **Regras**, apague o conteúdo e cole o arquivo `firebase/database.rules.json` deste projeto. **Publicar**.
4. Copie o endereço do banco (algo como `https://seu-projeto-default-rtdb.firebaseio.com`) para `databaseURL`
   em `src/config/firebase.ts` (se ainda não estiver lá).

Pronto: recarregue o app e o **Jogar online** já funciona.

## 4. Como convidar alguém

- **Jogar online → Criar e convidar → Compartilhar convite** manda o link e o código da sala.
- Quem tem o app instalado (APK) toca no link `chessanalyzer://jogo/CÓDIGO` ou digita o código em
  **Jogar online → Entrar com código**.
- O WhatsApp não deixa clicar em links `chessanalyzer://`. Para um link clicável que funciona em
  qualquer celular, faça o passo 5.

## 5. (Opcional) Link que abre no navegador — Firebase Hosting

Com isso o amigo joga direto no navegador, mesmo sem o app instalado.

```bash
npm install -g firebase-tools
firebase login
firebase use --add                     # escolha o seu projeto
npx expo export --platform web         # gera a pasta dist/
cp -r public/engine dist/              # Windows (PowerShell): Copy-Item -Recurse public/engine dist/
firebase deploy --only hosting,database
```

Depois coloque o endereço do site (ex.: `https://seu-projeto.web.app`) em `WEB_URL`, em
`src/config/firebase.ts`. A partir daí os convites saem como `https://seu-projeto.web.app/?jogo=CÓDIGO`.

> Sempre que mudar o app, rode de novo `npx expo export --platform web`, copie `public/engine` e faça
> `firebase deploy --only hosting`.

## Limites do plano gratuito (Spark)

O Realtime Database gratuito aguenta 100 conexões simultâneas e 1 GB de dados — sobra para jogar com amigos.
Cada partida ocupa poucos KB.

## Segurança

Os valores de `FIREBASE_CONFIG` não são secretos (todo app web com Firebase os expõe). Quem protege os dados
são as regras em `firebase/database.rules.json`: só usuários logados leem as salas, e só os dois jogadores de
uma sala conseguem alterá-la.

## Atualizar as regras pelo terminal (alternativa ao console)

Sempre que o arquivo `firebase/database.rules.json` mudar (por exemplo, quando entraram os torneios),
as regras precisam ser publicadas de novo. Pelo terminal, na pasta do projeto:

```
npx firebase-tools login
npx firebase-tools deploy --only database --project chess-analyzer-571ad
```

O primeiro comando abre o navegador para você entrar com a conta Google do Firebase (só na primeira vez).
O segundo envia as regras. Se o app mostrar "O Firebase bloqueou o torneio: as regras do banco estão
desatualizadas", é isso que falta.
