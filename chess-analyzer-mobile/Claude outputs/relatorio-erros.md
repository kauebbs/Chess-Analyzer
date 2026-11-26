# Erros encontrados — Chess Analyzer (26/11/2026)

## Resumo
Testei no simulador web (http://localhost:8766, banco falso no localStorage), com Playwright, Chromium 380×800. Cobri Início, Jogar contra o bot, Online com três abas (sala MD3, xeque-mate, abandono, próxima partida, chat, espectador entrando numa partida já começada), Analisar → Colar PGN (lixo, só cabeçalho, lance ilegal, PGN com FEN + comentário + variante → relatório) e Ajustes (as quatro abas, incluindo SOBRE, e o link "Reportar problema").
**Achados: 0 Crítico · 1 Alto · 0 Médio · 1 Baixo.** O mais grave é o **E1**: na partida contra o bot o relógio não desconta o tempo gasto. A cada lance o tempo volta ao valor anterior, então ninguém perde por tempo e o relógio "volta" para 5:00 quando a partida acaba. Nenhum erro ou aviso de console/página apareceu em nenhum fluxo.
**Não testei, por falta de tempo** (orçamento de ~25 min, 2 núcleos divididos com outros agentes): bot x bot, torneio local, torneio online com abas, tabuleiro livre, modo variante e navegação rápida no relatório, tema escuro, promoção e afogamento. Também não testei Android real, sons, vibração nem compartilhar.

## Achados

### E1 · Relógio contra o bot não desconta o tempo gasto — Alto
- **Onde:** Jogar → Contra o bot (com tempo). Pelo código, vale também para torneio local com pessoa, porque usa o mesmo `BotGame`.
- **Como reproduzir:** 1. Jogar → Contra o bot → 400, Brancas, 5+0 → JOGAR. 2. Espere ~11 s sem jogar: o seu relógio mostra 4:48. 3. Jogue e4. 4. Abandone a partida.
- **Esperado × obtido:** depois do e4 o seu relógio devia ficar parado em ~4:48. Ele mostra **4:59**: os 12 s gastos foram devolvidos. Na sua vez seguinte ele volta a correr a partir de 5:00 (4:56 depois de ~3 s). No fim da partida os dois relógios mostram **5:00**. Na prática não dá para perder por tempo, a não ser gastando 5 min num único lance, e o "5+0" não vale nada.
- **Evidência:** `evidencias/E1_relogio_apos_lance.png` (4:56 depois de 12 s + 3 s de jogo) · `evidencias/E1_relogio_fim.png` (5:00 × 5:00 no fim) · console sem erros. Saída do script `scripts/s7_bot.py`: `antes do 1o lance: 4:48 → logo apos e4: 4:59 → apos resposta do bot: 4:56`.
- **Causa provável:** `src/components/play/BotGame.tsx:249-258`. O tempo gasto é calculado **dentro** da função passada ao `setTimes` (`next[mover] -= nowTs - turnStart.current`, linha 253). O React só roda essa função mais tarde, na próxima renderização. Antes disso, a linha 258 já fez `turnStart.current = nowTs`. Resultado: a conta dá ~0 e nada é descontado. A exibição (`shownTimes`, linhas 171-175) só subtrai o tempo do turno atual, e por isso parece funcionar durante a jogada.
- **Sugestão:** calcular `const spent = nowTs - turnStart.current` **antes** do `setTimes` e usar `next[mover] -= spent` dentro dele. Vale também, em `finish` (l.180), gravar o tempo do turno em andamento antes de `setStatus('over')`, para o relógio final ficar congelado no valor certo.

### E2 · Código da sala colado com espaço antes perde o último caractere — Baixo
- **Onde:** Jogar → Contra um amigo → "Entrar com código".
- **Como reproduzir:** 1. Crie uma sala na aba A (ex.: `SJL25C`). 2. Na aba B, cole ` sjl25c ` (com espaço antes, como acontece ao copiar o código de uma mensagem do WhatsApp). 3. Toque em entrar.
- **Esperado × obtido:** era para entrar na sala SJL25C, já que `normalizeCode` existe justamente para tirar espaços e minúsculas. O campo fica com **SJL25** (5 caracteres) e não entra na sala.
- **Evidência:** `evidencias/E2_codigo_truncado.png`
- **Causa provável:** `src/screens/OnlineScreen.tsx:558` (`maxLength={6}`). O campo nativo corta o texto bruto em 6 caracteres **antes** de o `onChangeText` (l.552) normalizar, e o espaço conta como um deles.
- **Sugestão:** tirar o `maxLength` (o `normalizeCode(v).slice(0, 6)` já limita) ou subir o limite para algo como 12.

### Suspeita não reproduzida (não contada)
- **Revanche/próxima partida simultânea:** `src/online/gameService.ts:386-405`, função `requestRematch`. A função olha `game.rematch` na cópia local e, se estiver vazio, cria outra sala e grava `rematch` com `update`, sem transação. Se os dois jogadores tocarem em "Próxima partida" quase juntos no Firebase real, podem ser criadas duas salas, cada jogador esperando na sua. No simulador, com os dois cliques simultâneos, os dois caíram na mesma sala (o banco local não tem latência), então não consegui confirmar. Vale trocar por `runTransaction` no campo `rematch`.
- **Comentário desatualizado:** `src/online/gameService.ts:188` diz que o relógio "só corre depois do 1º lance de cada um". A linha 192 e o comportamento observado mostram que o relógio das brancas começa assim que o 2º jogador entra. Não é bug, mas a documentação engana.

## Testado sem problemas
- Barra inferior (5 abas) e Ajustes: abas TABULEIRO / ANIMAÇÕES / SONS / SOBRE abrem sem erro.
- SOBRE: a versão (1.0.0, igual ao `app.json`) e "Stockfish 19" (pacote `stockfish@19.0.1`) batem com o projeto. A faixa de bots "400 a 3000" bate com `MAX_RATING` (os atalhos vão até 2800 e o "+" chega a 3000). MD3/MD5 existem nas salas online. Os créditos das peças vêm de `PIECE_SETS`. "Reportar problema" abre `github.com/kauebbs/Chess-Analyzer/issues` numa aba nova.
- Online com duas abas: criar sala (Brancas, 3+2, MD3), entrar com o código (minúsculas sem espaço funcionam), jogar até o xeque-mate (Qxf7#: "VOCÊ VENCEU" × "VITÓRIA DE ANA", placar 1–0, vantagem +1 certa), abandono com confirmação em dois toques, "Próxima partida" → jogo 2 com as cores trocadas e o placar 0–1 certo nos dois lados.
- Espectador (3ª aba) entrando com o código de uma partida já começada (jogo 2, depois de 1.d4 d5 2.c4): abre assistindo, com "Chat | Sair" e sem botões de jogo. Também funciona com a partida já terminada.
- Chat: a mensagem do espectador (com emoji) aparece para o jogador com a marca "· ASSISTINDO".
- Colar PGN: texto qualquer, PGN só com cabeçalho e lance ilegal mostram "PGN inválido…" ou "Esse PGN não tem lances" sem travar.
- PGN com `[FEN]`, pretas começando no lance 40, comentário e variante: carrega, a numeração `40... Kd7 41. e4 Kc6 42. e5` está certa, o relatório sai e a contagem bate com os lances (brancas 2 = 1 Melhor + 1 Bom; pretas 2 Melhor).
- Contra o bot: a tela de configuração (rating/rótulo "1200 · Intermediário" coerente com `ratingLabel`), o bot responde, o abandono com confirmação, a mensagem final do bot e os botões Analisar/Revanche/Sair.
- Nenhum `pageerror` nem `console.error`/`warning` em todos os fluxos acima.

## Fora do escopo (para os outros agentes)
- Na sala de espera do online ("Aguardando adversário") não aparece o formato MD3. Ele só aparece depois que o adversário entra.
- Scripts usados: `/home/claude/qa/qa-erros-chess-analyzer/scripts/` (s3_sala, s4_revanche, s5_analise, s6_bot_ajustes, s7_bot).
