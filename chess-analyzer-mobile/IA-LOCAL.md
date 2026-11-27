# IA local (grátis, dentro do celular)

A IA é só a **voz**: quem joga e quem avalia os lances continua sendo o Stockfish.

- **Bots:** cada bot tem uma personalidade fixa (Provocador, Gentil, Narrador, Nervoso, Sábio ou Competitivo), que aparece embaixo do nome na partida. O bot cumprimenta, responde ao chat, reage quando você erra feio ou acerta um golpe, avisa que achou mate e comenta o fim do jogo.
- **Professores** (Relatório da partida › Professor): Profa. Lia (didática), Mestre Otto (direto) e Prof. Davi (motivador). Eles recebem os fatos do Stockfish (precisão, momentos-chave, melhor lance) e escrevem a explicação.
- **Sem o modelo baixado, nada quebra:** os bots usam frases prontas da personalidade e o professor monta uma explicação automática.

A IA usa o **llama.rn**, que é um módulo nativo. Por isso ela **não funciona no Expo Go**: o app precisa ser instalado por um build do EAS. Uma vez instalado, você continua programando igual, com o `npx expo start`.

---

## Instalação (uma vez só)

Tudo no terminal, dentro da pasta `chess-analyzer-mobile`.

### 1. Instalar as dependências novas

```bash
npm install
```

Os arquivos `package.json` e `package-lock.json` já vêm com o `llama.rn` e o `expo-dev-client`. O `npm install` também baixa as bibliotecas nativas do llama.rn pelo GitHub (pode levar uns minutos).

### 2. Entrar no EAS

```bash
npm install -g eas-cli
eas login
```

Use a mesma conta Expo de sempre (o projeto já está ligado a ela no `app.json`).

### 3. Gerar o app

```bash
eas build --profile development --platform android
```

O build roda nos servidores do Expo, de graça (pode ficar alguns minutos na fila). No fim aparece um **link e um QR code**.

### 4. Instalar no celular

Abra o link (ou leia o QR code) **no celular** e baixe o APK. O Android vai pedir para permitir "instalar apps desta fonte": permita e instale. Vai aparecer o ícone do **Chess Analyzer**.

### 5. Rodar

No PC:

```bash
npx expo start
```

No celular, abra o **app Chess Analyzer** (não o Expo Go). Ele mostra o servidor do PC na lista: toque nele. Se não aparecer, leia o QR code do terminal com a câmera do celular. PC e celular precisam estar no mesmo Wi-Fi.

### 6. Baixar a IA

No app: **Ajustes › IA › Modelo › BAIXAR**. Use Wi-Fi.

| Modelo | Tamanho | Para quem |
|---|---|---|
| Qwen 2.5 1.5B (recomendado) | 1,1 GB | celular com 4 GB de RAM ou mais |
| Qwen 2.5 0.5B | 490 MB | celular simples (escreve pior) |

Quando o status ficar **Pronta**, toque em **OUVIR UM BOT** para testar. A primeira resposta demora mais, porque o modelo carrega na memória.

---

## No dia a dia

- Mudou só código (JS/TS)? Basta `npx expo start` e abrir o app. **Não precisa de build novo.**
- Precisa de **build novo** só quando adicionar ou atualizar uma biblioteca nativa (como o llama.rn) ou mexer em `app.json` (plugins, ícone, nome).
- Quer um APK para mostrar a alguém, que funcione **sem o PC**? `eas build --profile preview --platform android`.

## Se der problema

| Problema | O que fazer |
|---|---|
| `npm install` falha baixando o llama.rn | Confira a internet e rode `npm install` de novo |
| Build falha no EAS | Abra o link do build, copie o erro e me mande |
| A aba IA diz "Indisponível no Expo Go" | Você abriu no Expo Go. Abra o app Chess Analyzer instalado |
| O download do modelo para no meio | Toque em BAIXAR de novo (use Wi-Fi) |
| O app fecha ao usar a IA | Pouca memória: troque para o modelo 0.5B |

---

## Onde está o código

| Arquivo | O que faz |
|---|---|
| `src/ai/index.ts` | `generate()`: gera texto na fila; sem IA, devolve `null` e entra a frase pronta |
| `src/ai/device.ts` | llama.rn: baixar, carregar e rodar o modelo no celular |
| `src/ai/config.ts` | Ajustes da IA (salvos no aparelho) |
| `src/ai/personalities.ts` | As 6 personalidades (prompt + frases prontas) |
| `src/ai/botVoice.ts` | Fala do bot para cada evento da partida |
| `src/ai/coach.ts` | Professores: fatos do motor → explicação |
| `src/components/AiSection.tsx` | Aba "IA" dos Ajustes |
| `src/components/CoachPanel.tsx` | Painel "Professor" no relatório |
