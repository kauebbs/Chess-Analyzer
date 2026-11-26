# Continuidade entre seções — Chess Analyzer (2026-11-26)

## Resumo

Testei no simulador web (`localhost:8766`, banco falso no `localStorage`, 380×800), como quem nunca viu o app.
Scripts em `scripts/` (`m1_navegacao.py`, `m2_bot_amigo.py`, `m4_torneio.py`, `helpers.py`) e prints em `evidencias/`.

| Missão | Resultado |
|---|---|
| 1. Analisar partida importada (Colar PGN → relatório → voltar) | Flui até o relatório. Na volta, "casa" leva ao **Início**, não a Analisar. Se o painel de importação é fechado sem escolher nada, a pessoa cai num tabuleiro vazio, sem a barra inferior. |
| 2. Jogar contra o bot → Analisar → voltar a jogar | O caminho até a análise existe. Mas a seta de voltar **apaga a partida em andamento sem perguntar**, e depois de analisar não há volta à tela de fim (Revanche some). |
| 3. Jogar com amigo (duas abas, link, revanche) | O amigo entra pelo link e a partida começa. Quem entra pelo link vira "Jogador" sem escolher nome. Na revanche, quem pede vai para uma tela de "convite" com código novo. Trocar o tema com a sala aberta **descarta a sala**. |
| 4. Torneio online (3 abas: anfitrião de folga assiste, dois jogam) | Criar, entrar pelo link, começar, abrir a mesa, assistir ao vivo, conversar no chat e voltar ao torneio funcionam. Problemas: nomes repetidos ("Jogador × Jogador", "VITÓRIA DE JOGADOR"), "Nova sala" numa mesa de torneio e nenhum "Continuar" para torneio online. Não cheguei ao campeão: o tempo acabou na rodada 2 de 3. |
| 5. Ajustes e voltar ao que fazia | Abrir e fechar (X ou Escape) mantém a tela de baixo. A aba SOBRE está bem escrita e coerente com o app. Ressalvas: "Ajustes" × "Configurações", abas apertadas e a aba lembrada entre aberturas. |
| 6. Navegação livre | A barra marca a aba certa nas raízes. A seta de "Torneios" leva a **Jogar**. Não existe tratamento do botão voltar do sistema (`history.back()` sai do app; no Android, nenhum `BackHandler`). |

**Os 3 pontos mais importantes**

1. **O botão voltar do sistema não é tratado em lugar nenhum** (C1). No Android, voltar fecha o app de qualquer tela, inclusive no meio de uma partida.
2. **Estado perdido em silêncio** (C2 e C3). A seta "voltar" no jogo contra o bot descarta a partida. Trocar o tema enquanto há uma sala ou partida online aberta (estando em outra aba) descarta a sala.
3. **O torneio online não tem caminho de volta** (C4). Basta a seta ou o toque na aba Torneios para o anfitrião "sair" do torneio. Sem "Continuar", ele precisa redigitar o código. Enquanto isso, as rodadas e a simulação dos bots param.

## Mapa da navegação

```
Barra inferior (visível em: Início, hub Analisar, hubs/configs de Jogar e Torneios, saguão online)
 INÍCIO ── JOGAR ── ANALISAR ── TORNEIOS ── AJUSTES(folha)
 deslize: Início ⇄ Jogar ⇄ Analisar ⇄ Torneios (Ajustes fora do deslize)

Início ─ JOGAR → Jogar(hub) ─ ANALISAR → Analisar(hub)

Jogar(hub)  [⌂ → Início]
 ├ Contra o bot → setup [‹ → hub] → JOGAR → partida [‹ → setup, sem aviso ✗C2]
 │     fim: Analisar → Análise [⌂ → Início ✗C5] · Revanche · Sair(ícone ⌂, vai ao setup ✗C9)
 ├ Contra um amigo → "JOGAR ONLINE" [⌂ → Início; não há ‹ para Jogar ✗C8]
 │     sala/partida [⌂ "Menu principal" → Início; voltar à sala: Jogar → Contra um amigo]
 ├ Bot x Bot → setup [‹ → hub]
 └ Torneio → (troca a aba marcada para TORNEIOS) ✗C6

Torneios(hub "TORNEIO") [‹ → Jogar(hub) ✗C6]
 ├ Continuar: <torneio local> (só local)
 ├ Torneio local → setup → torneio [‹ → hub Torneios]
 ├ Criar torneio online → setup → saguão → rodadas [‹ → hub Torneios: perde o torneio ✗C4]
 │     mesa → OnlineScreen (TORNEIO) → "Voltar ao torneio" ✓ / "Nova sala" ✗C7
 └ Entrar com código (nome opcional → "Jogador") ✗C10

Analisar(hub) [⌂ → Início]
 ├ Continuar análise (se houver) ✓
 └ Chess.com / Lichess / Colar PGN / Tabuleiro livre → Análise (sem barra) [⌂ → Início ✗C5]
      fechar o painel de importação sem escolher → tabuleiro vazio ✗C5

Ajustes (folha "Configurações"): TABULEIRO · ANIMAÇÕES · SONS · SOBRE  [X / Escape / toque fora → tela anterior ✓]
Botão voltar do sistema: sem tratamento em nenhuma tela ✗C1
```

## Achados

### C1 · Botão voltar do sistema fecha o app de qualquer tela — Alto
- **Missão / onde:** 6. Navegação livre (todas as telas).
- **O que a pessoa tenta × o que acontece:** No web, `history.back()` sai da página do app (script `m1`: "Execution context was destroyed… navigation"). No código não há `BackHandler`, `popstate` nem histórico próprio. A busca por `BackHandler|popstate` em `App.tsx` e `src/` só encontra o `replaceState` (`App.tsx:145`). Só as folhas (`Sheet`) respondem ao voltar, via `onRequestClose` (`src/components/Sheet.tsx:19`). No Android, o voltar físico ou o gesto fecha o app a partir de Analisar, de uma configuração de bot ou **no meio de uma partida**.
- **Por que confunde:** é o gesto de navegação mais usado no Android. Quem espera voltar para o hub perde a partida, a análise ou o formulário.
- **Evidência:** `App.tsx:145` (único uso de history) · `src/components/Sheet.tsx:19`
- **Sugestão:** um `BackHandler` em `App.tsx` que siga a mesma hierarquia das setas ‹. Folha aberta: fecha. Sub-rota de Jogar ou Torneios: volta à rota pai. Análise e saguão online: voltam à aba de origem. Partida: pede confirmação. Raiz das abas: vai ao Início. No Início: sai. No web, o mesmo mapa pode ir para `popstate`.

### C2 · Seta "voltar" no jogo contra o bot apaga a partida sem aviso — Alto
- **Missão / onde:** 2. Jogar → Contra o bot → JOGAR → seta ‹ no cabeçalho.
- **O que a pessoa tenta × o que acontece:** quem toca ‹ espera sair por um instante ou receber uma pergunta. Na prática volta direto à configuração do bot, e a partida some (ao tocar JOGAR começa outra). Abandonar pede dois toques, mas a seta não pede nenhum.
- **Por que confunde:** é a mesma seta que nas outras telas só "sobe um nível". Aqui ela destrói o estado. A partida online, por outro lado, continua quando se sai, o que deixa o comportamento incoerente entre os dois modos.
- **Evidência:** evidencias/21_bot_partida.png → evidencias/22_bot_voltar_no_meio_sem_aviso.png · `src/components/play/BotGame.tsx:466` (`onBack={onExit}`) · `src/screens/PlayScreen.tsx:570` (`onExit={() => setRoute(l.back)}`)
- **Sugestão:** com a partida em andamento, a seta pede confirmação ("Sair e abandonar?"), como já acontece no botão Abandonar. Outra saída é manter a partida montada e oferecer "Continuar partida" no hub Jogar.

### C3 · Trocar o tema com uma sala ou partida online aberta em outra aba descarta a sala — Alto
- **Missão / onde:** 3 + 5. Sala de revanche aguardando → ⌂ Menu principal → Ajustes → Escuro → Jogar → Contra um amigo.
- **O que a pessoa tenta × o que acontece:** ela volta para a sala e encontra o saguão vazio ("DESAFIE UM AMIGO"). A sala 6NLW7J sumiu da tela, mas continua no banco, e o amigo fica esperando a revanche.
- **Por que confunde:** o `BRAND.md` e o comentário do código prometem "nunca no meio de uma partida". Só que `inGame` olha apenas a tela **visível**. Se a pessoa está no Início, a troca acontece, a árvore é remontada (`key={themeKey}`) e o `joinRequest`/`playRequest` é zerado. O mesmo vale para uma partida online em andamento (o ⌂ leva ao Início sem encerrá-la) e para a rota de torneio online.
- **Evidência:** evidencias/31b_amigo_A_apos_pedir_revanche.png → evidencias/32_tema_escuro_com_sala_aberta.png → evidencias/33_volta_a_sala_apos_tema.png · `App.tsx:313` (`inGame` só para a tela atual) · `App.tsx:322-323` · `App.tsx:331`
- **Sugestão:** considerar "em jogo" qualquer sala online com `code`, qualquer rota `game`/`tonline` montada e qualquer `BotGame` ativo, mesmo escondidos, e manter a troca pendente (já existe a mensagem "O tema muda assim que a partida em andamento acabar"). Outra opção é guardar o código da sala ativa e reabri-la depois da remontagem, como já se faz com a análise (`App.tsx:324`).

### C4 · Torneio online não tem "Continuar": a seta ‹ ou a aba Torneios tiram o anfitrião do torneio — Alto
- **Missão / onde:** 4. Torneio online em andamento → ‹ (ou Início → aba TORNEIOS).
- **O que a pessoa tenta × o que acontece:** a pessoa quer sair um instante e voltar. O hub de Torneios só oferece "Continuar" para o torneio **local**, então o online só volta redigitando o código. A aba TORNEIOS sempre reinicia na raiz (`openPlay('tournament')` → `setRoute({ name: 'thub' })`), mesmo com um torneio aberto. Ao sair de `tonline`, a assinatura termina, e o anfitrião, que é quem aplica os resultados e simula os bots, para o torneio de todos. O próprio app avisa: "mantenha o torneio aberto".
- **Por que confunde:** o pedido "mantenha aberto" entra em choque com uma navegação que fecha o torneio com um toque, sem aviso.
- **Evidência:** evidencias/44_torneio_A_rodada.png (aviso ao anfitrião) · evidencias/10_deslize_torneios.png/12 (hub sem item online) · `src/screens/PlayScreen.tsx:796` (só `localT`) · `src/screens/PlayScreen.tsx:526-531` · `App.tsx:217` · `src/screens/PlayScreen.tsx:757` (‹ → thub)
- **Sugestão:** guardar o último código de torneio online (como o `LOCAL_KEY`) e mostrar "Continuar: <nome> (online)" no hub. A aba TORNEIOS deveria preservar a rota quando já há um torneio aberto, como uma aba que lembra onde estava. Se a pessoa for anfitriã, a seta ‹ deveria confirmar a saída.

### C5 · A análise só volta para o Início; fechar a importação deixa um tabuleiro vazio sem barra — Médio
- **Missão / onde:** 1 e 2. Analisar → Chess.com → fechar o painel. Partida contra o bot → Analisar → ⌂.
- **O que a pessoa tenta × o que acontece:** quem veio de Analisar e desistiu de importar fica num tabuleiro vazio ("Arraste uma peça ou importe uma partida"), sem a barra inferior. A única saída é ⌂, que leva ao **Início**, e não de volta à lista de Analisar. Quem veio do fim de uma partida (bot ou online) também volta ao Início, e ao tocar em Jogar a tela de fim já foi substituída pelo hub (sem Revanche).
- **Por que confunde:** a origem se perde. A missão "ver onde errei e voltar a jogar" exige reabrir Contra o bot e configurar de novo. Ao menos a configuração é lembrada.
- **Evidência:** evidencias/04_import_fechado_tabuleiro_vazio.png · evidencias/07_volta_da_analise_cai_no_inicio.png · evidencias/24_bot_analisar.png → evidencias/26_jogar_perdeu_fim_de_partida.png · `src/screens/AnalysisScreen.tsx:608` · `App.tsx:154`, `App.tsx:216` (`openPlay('hub')` reinicia a rota)
- **Sugestão:** a análise deveria ter um ‹ para a origem: hub Analisar, partida contra o bot ou sala online. Também caberia mostrar a barra inferior quando não há partida carregada. Se a importação for fechada sem escolha, o certo é voltar ao hub Analisar. E a aba Jogar não deveria reiniciar a rota quando há uma partida terminada esperando Revanche.

### C6 · "Torneio" × "Torneios": dois caminhos, a aba marcada pula e a seta leva a Jogar — Médio
- **Missão / onde:** 4 e 6. Jogar → item "Torneio". Barra → TORNEIOS → ‹.
- **O que a pessoa tenta × o que acontece:** pelo item "Torneio" dentro de Jogar, a marca vermelha da barra muda de JOGAR para TORNEIOS. Na aba Torneios, que é uma raiz da barra, o cabeçalho mostra a seta ‹ (e não ⌂, como em Jogar e Analisar), e ela leva para **Jogar**. Os nomes também variam: aba "TORNEIOS", cabeçalho "TORNEIO", título "Torneios", item "Torneio". O convite diz "Jogar → Torneio → código".
- **Por que confunde:** a mesma tela tem dois pais. A seta de uma aba raiz manda para outra aba.
- **Evidência:** evidencias/12_jogar_item_torneio_troca_aba.png · `src/screens/PlayScreen.tsx:786` (‹ → `hub`) · `src/screens/PlayScreen.tsx:871` · `src/screens/PlayScreen.tsx:677` · `src/components/NavBar.tsx:13`
- **Sugestão:** escolher um único caminho. Uma opção é tirar o item "Torneio" do hub Jogar, já que existe a aba. A outra é tratá-lo como atalho que troca de aba sem seta. Cabeçalho "TORNEIOS" com ⌂ → Início, igual a Jogar e Analisar. Convite: "Torneios → Entrar com código".

### C7 · "Nova sala" aparece no fim de uma mesa de torneio — Médio
- **Missão / onde:** 4. Mesa online do torneio → Abandonar → tela de fim.
- **O que a pessoa tenta × o que acontece:** os botões são "Analisar · Voltar ao torneio · Chat · **Nova sala**". "Nova sala" leva ao saguão de partida entre amigos, fora do torneio.
- **Por que confunde:** a revanche é escondida corretamente em torneio, mas "Nova sala" ficou. É um caminho que tira a pessoa do contexto do torneio.
- **Evidência:** evidencias/50_torneio_perdeu_mesa.png · `src/screens/OnlineScreen.tsx:918` (fora do `game.tournament ? … : …` de `:880-917`)
- **Sugestão:** em `game.tournament`, mostrar só Analisar, Voltar ao torneio e Chat.

### C8 · "Contra um amigo" vira "JOGAR ONLINE", com ⌂ em vez de ‹ — Médio
- **Missão / onde:** 3. Jogar → Contra um amigo.
- **O que a pessoa tenta × o que acontece:** o item se chama "Contra um amigo", a tela se chama "JOGAR ONLINE" e o convite enviado diz "Chess Analyzer → **Jogar online** → Entrar com o código", mas esse caminho não existe na interface. O cabeçalho tem ⌂ (vai ao Início), enquanto as outras subtelas de Jogar (Contra o bot, Bot x Bot) têm ‹ de volta para Jogar.
- **Por que confunde:** o amigo que segue o texto do convite não encontra "Jogar online". E a saída do saguão é diferente da saída das telas vizinhas.
- **Evidência:** evidencias/33_volta_a_sala_apos_tema.png · `src/screens/OnlineScreen.tsx:259` · `src/screens/OnlineScreen.tsx:483` · `src/screens/OnlineScreen.tsx:941-948`
- **Sugestão:** usar o título "CONTRA UM AMIGO" e o convite "Jogar → Contra um amigo → Entrar com código". No saguão, ‹ volta para Jogar, e o ⌂ fica só na partida.

### C9 · "Sair" com ícone de casa leva à configuração do bot — Baixo
- **Missão / onde:** 2. Fim da partida contra o bot.
- **O que a pessoa tenta × o que acontece:** o botão "Sair" tem o ícone ⌂, mas volta para a tela "CONTRA O BOT", e não para o Início.
- **Evidência:** evidencias/23_bot_fim.png · `src/components/play/BotGame.tsx:596`
- **Sugestão:** usar o ícone ‹/exit (como o "Sair" do online usa `exit`), ou levar de fato ao hub Jogar.

### C10 · Quem entra por link vira "Jogador": nomes repetidos no torneio e na sala — Médio
- **Missão / onde:** 3 e 4. Amigo abre `?jogo=` ou `?torneio=`.
- **O que a pessoa tenta × o que acontece:** quem entra pelo link é colocado direto na sala ou no torneio com o nome padrão "Jogador", sem ser perguntado. No torneio com dois convidados aparecem "Jogador × Jogador" e "VITÓRIA DE JOGADOR · ABANDONO".
- **Por que confunde:** ninguém sabe quem é quem na tabela, na mesa ou no chat.
- **Evidência:** evidencias/42_torneio_B_entrou_pelo_link.png · evidencias/52_torneio_espectador_fim_mesa.png · evidencias/28_amigo_B_entrou_pelo_link.png · `src/screens/PlayScreen.tsx:144` · `src/screens/PlayScreen.tsx:359` · `src/screens/PlayScreen.tsx:527-529`
- **Sugestão:** quando não há nome salvo, abrir uma pergunta curta "Como os outros vão te ver?" antes de entrar pelo link. Na falta de nome, gerar "Jogador 2", "Jogador 3" e assim por diante.

### C11 · Revanche: quem pede vai para uma tela de "convidar" com código novo — Baixo
- **Missão / onde:** 3. Fim da partida → Revanche.
- **O que a pessoa tenta × o que acontece:** a tela vira "AGUARDANDO ADVERSÁRIO", com código novo, "COMPARTILHAR CONVITE" e "Cancelar sala", como se fosse preciso convidar de novo. Para o amigo, aparece "Aceitar revanche" (o rótulo fica cortado: "Aceitar reva...").
- **Evidência:** evidencias/31b_amigo_A_apos_pedir_revanche.png · evidencias/31_amigo_B_revanche.png · `src/screens/OnlineScreen.tsx:895-915`
- **Sugestão:** em revanche, mostrar "Esperando <nome> aceitar a revanche" sem bloco de convite, e encurtar o rótulo para "Aceitar".

### C12 · Ajustes × Configurações, e aba SOBRE lembrada — Baixo
- **Missão / onde:** 5. Barra → AJUSTES.
- **O que a pessoa tenta × o que acontece:** a aba se chama "AJUSTES", mas a folha se chama "CONFIGURAÇÕES", e a análise também usa o rótulo "Configurações". Quem fecha a folha na aba SOBRE reabre nela, mesmo vindo de outra tela, e precisa achar TABULEIRO de novo. A aba AJUSTES nunca fica marcada, o que é aceitável para uma folha.
- **Evidência:** evidencias/19_ajustes_reaberto.png · `src/components/NavBar.tsx:14` · `src/components/SettingsModal.tsx:68` · `src/components/SettingsModal.tsx:75` · `src/screens/AnalysisScreen.tsx:647`
- **Sugestão:** usar o mesmo nome nos três lugares ("Ajustes") e voltar para TABULEIRO a cada abertura (zerar `tab` quando `visible` muda para `true`).

### C13 · As 4 abas da folha de Ajustes ficaram apertadas depois de SOBRE — Baixo
- **Missão / onde:** 5. Ajustes.
- **O que a pessoa tenta × o que acontece:** com 4 abas de `flex: 1`, "TABULEIRO" e "ANIMAÇÕES" se encostam ("TABULEIROANIMAÇÕES"). Ressalva: no web a fonte condensada cai para outra, então no Android pode caber. Vale conferir.
- **Evidência:** evidencias/14_ajustes_tabuleiro.png · evidencias/15_ajustes_sobre_topo.png · `src/components/SettingsModal.tsx:426-441`
- **Sugestão:** usar `letterSpacing` menor ou abas roláveis, ou encurtar para "PEÇAS/TABULEIRO → TABULEIRO", "ANIMAÇÃO", "SONS", "SOBRE".

### C14 · Termos pequenos — Baixo
- Abertura em inglês no relatório ("C23 Bishop's Opening") num app "tudo em português" (evidencias/06_relatorio.png).
- O hub diz "Colar PGN", e a aba do painel diz só "PGN" (`src/screens/AnalyzeHub.tsx:30` × `src/components/ImportModal.tsx:28`).
- A aba SOBRE fala em "Sobre nós" e "No que acreditamos", mas logo depois diz "feito por Kauê" (projeto de uma pessoa) (`src/components/AboutSection.tsx:24-34`). Fica melhor "Sobre o app".

### Aba SOBRE: integração
Ela está bem integrada. Segue a identidade (Kicker com número vermelho, linhas finas, cantos de 4, tinta e papel), e as afirmações batem com o código:
- bots de 400 a 3000: `src/bots/botPlayer.ts:10-11`;
- MD3/MD5: `src/screens/OnlineScreen.tsx:540`;
- Stockfish 19: o mesmo texto aparece no hub Analisar;
- preferências só no aparelho: `App.tsx:83-111`;
- créditos das peças tirados de `PIECE_SETS`, sem duplicar a lista.

Ela também abre e fecha sem mexer na tela de baixo (evidencias/15–18). Os pontos fracos são os de C12, C13 e C14. Uma oportunidade: "REPORTAR PROBLEMA" poderia preencher a versão do app no link da issue.

## O que já flui bem
- **Início → Analisar → Colar PGN → relatório.** O relatório sai rápido e completo. "Continuar análise · Ana x Beto" aparece no hub Analisar depois de sair (evidencias/08_analisar_hub_continuar.png).
- **Ajustes como folha.** Fecha com X, com Escape ou com toque fora, e devolve a pessoa exatamente onde estava, por exemplo na configuração do bot preenchida (evidencias/18_apos_fechar_ajustes.png).
- **Barra inferior.** Some durante as partidas e na análise, aparece nos hubs e no saguão, e a aba marcada corresponde à tela nas raízes. O deslize Início → Jogar funcionou. Com mouse no web, os deslizes seguintes selecionaram texto, então o resto do ciclo não foi validado.
- **Link de convite.** `?jogo=` e `?torneio=` levam o amigo direto à partida ou ao saguão do torneio, e a barra de endereço é limpa.
- **Torneio online.** "ASSISTIR AO VIVO" para quem está de folga, a faixa "ASSISTINDO", o chat do espectador e "Voltar ao torneio" na mesa (esperando, jogando e terminada) formam um ciclo completo. A rodada seguinte já aparece ao voltar (evidencias/47–52).
- **A configuração do bot é lembrada** entre partidas (nível, cor, formato).
- **Fim da partida contra o bot e online:** "Analisar" sempre presente, e Revanche, Nova série e Próxima partida com destaque.
