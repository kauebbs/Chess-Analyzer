# Product

<!-- impeccable:product-schema 1 -->

> Escrito sem entrevista (as perguntas ficaram sem resposta). Itens marcados **(inferido)** vêm do repositório e precisam de confirmação.

## Platform

android

(inferido: há `android.package`/`versionCode`, builds EAS de desenvolvimento para Android e a IA local via `llama.rn` documentada só para Android. iOS e web existem na config, mas parecem secundários.)

## Users

**(inferido)** Jogadores de xadrez que falam português, jogam online (Chess.com/Lichess) e querem entender os próprios erros sem pagar assinatura. Eles abrem o app no celular depois de uma partida para revisar o que aconteceu, ou para jogar contra bots e treinar aberturas.

Ainda não definido: o nível principal (iniciante, intermediário ou de clube).

## Product Purpose

Analisar partidas de xadrez (PGN, importação ou jogadas no app) com o Stockfish. O app classifica cada lance (de brilhante a capivarada), mostra precisão e estimativa de rating, os momentos-chave e o melhor lance, e explica o porquê em linguagem humana. Também dá para jogar: contra bots com personalidade, online com amigos (Firebase) e em torneios, além do treino de aberturas.

Sucesso **(inferido)**: depois de uma revisão, o jogador sabe onde errou e o que devia ter jogado.

## Positioning

**(inferido)**
- Análise no estilo Chess.com, de graça e rodando no aparelho: o Stockfish fica no celular e a IA é local (llama.rn), sem servidor pago.
- A IA é só a voz: quem avalia os lances é sempre o Stockfish. Professores (Profa. Lia, Mestre Otto, Prof. Davi) e bots com personalidade transformam os fatos do engine em explicação.
- Sem o modelo baixado, nada quebra: há frases prontas e uma explicação automática como alternativa.

## Operating Context

- Uso em retrato, no celular, muitas vezes logo depois de uma partida feita em outro app.
- Jogo online por convite (link ou código de sala) com login anônimo, sem cadastro (`ONLINE.md`).
- A IA local precisa de um development build do EAS e não funciona no Expo Go (`IA-LOCAL.md`).

## Capabilities and Constraints

- Expo SDK 58, React Native 0.88. A análise vem de um Stockfish embutido (`src/engine/StockfishBridge.tsx`).
- Termos do app: classificação de lances (melhor, excelente, bom, imprecisão, erro, erro grave, brilhante, capivarada), precisão, abertura com ECO, momentos-chave.
- O tema claro/escuro não troca no meio de uma partida.
- A interface é toda em português.

## Brand Commitments

Comprometido em `BRAND.md` (vinculante):
- Nome: **Chess Analyzer**. Marca: cavalo em silhueta sobre um disco vermelho. Letreiro "CHESS" em vermelho e "ANALYZER" em preto (League Gothic em contornos).
- Identidade de **cartaz editorial**, desenhos originais do app.
- Tom de voz: direto, em português, sem enfeite.
- Arquivos: `assets/brand/*`, `src/brand/brandSvgs.ts`, `src/components/Logo.tsx`.

## Evidence on Hand

- Arquivos da marca em `assets/brand/` (logo, wordmark, hero, prancha `brand-sheet.png`).
- Não há depoimentos, número de usuários, avaliações da loja nem imprensa. Não invente nada disso.

## Product Principles

**(inferido)**
1. **O Stockfish decide, a IA explica.** Nenhuma avaliação vem de outra fonte que não o engine.
2. **Funciona sem nada extra.** Sem modelo, sem rede e sem conta, o essencial continua funcionando.
3. **Explicar, não só pontuar.** Cada classificação precisa de um porquê legível.
4. **Grátis e no aparelho.** Nada de paywall nem de dependência de servidor pago.
