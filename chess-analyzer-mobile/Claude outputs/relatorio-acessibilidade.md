# Acessibilidade — Chess Analyzer (26/11/2026)

## Resumo

**O que foi auditado:** simulador web (`http://localhost:8766`, viewport 380×800, escala 2×), nos temas claro e escuro (`?tema=escuro`). Telas: Início, Jogar (hub, configuração e partida contra o bot), Analisar (hub, importar PGN, relatório e análise de uma miniatura de 7 lances), Online (saguão, sala aguardando e partida com 2 abas/2 jogadores), Torneios (hub e configuração do torneio local) e Ajustes (Tabuleiro, Animações, Sons e a aba nova **SOBRE**). Foram 64 prints em `evidencias/`. Cada tela passou por um script (`scripts/auditlib.py`) que lê a cor e o tamanho de cada texto visível, o fundo real e a caixa de cada alvo tocável. As cores foram conferidas por amostragem de pixels dos prints (`scripts/amostra.py`), e os valores bateram com o DOM. A paleta foi calculada com `contraste.py` (`scripts/paleta.py` e `scripts/sugere.py`).

**Nota geral:**
- **Claro: 6/10.** A tinta sobre papel é ótima (14,8:1). O que falha é o cinza `textMuted`, o vermelho em texto pequeno e o texto creme sobre o vermelho (4,46:1, falha por pouco).
- **Escuro: 5,5/10.** O `textMuted` melhora (3,6 a 3,9:1), mas ainda falha. O botão vermelho piora (3,84:1 com `onRed` e 4,32:1 com o `#fff` fixo no código). Os campos de texto praticamente somem (1,08:1).

**Os 3 problemas que mais afetam pessoas:**
1. **O tabuleiro é invisível para o leitor de tela (A1).** Nenhuma casa nem peça tem rótulo ou papel, então quem usa TalkBack não consegue jogar nem acompanhar a análise.
2. **Textos de apoio em `textMuted` não passam em nenhum tema (A2).** São 58 usos: rótulos de campo ("Jogar de", "Tempo", "Formato"), dicas, "conectado", "você", placeholders, a lista de lances vazia. A medição deu 2,72:1 sobre cartão no claro e 3,63:1 no escuro.
3. **Seletores não dizem o que está selecionado nem que são botões (A5).** Chips, segmentos, atalhos de rating e as abas de Ajustes e de Importar não têm `accessibilityRole` nem `accessibilityState`. Só a barra inferior tem. Com o leitor de tela não dá para saber se a partida é "10+0" ou "MD3".

**Contagem:** 1 Crítico · 5 Alto · 6 Médio · 3 Baixo.

## Achados

### A1 · Tabuleiro sem nenhuma informação para o leitor de tela — Crítico · 4.1.2 Nome, função, valor / 1.1.1 Conteúdo não textual / 2.1.1 Teclado
- **Onde:** Jogar → partida contra o bot, Online → partida, Analisar → análise · ambos os temas
- **Medição:** nas telas de partida e de análise, o levantamento do DOM encontrou **0 elementos focáveis ou rotulados dentro do tabuleiro** (64 casas e 32 peças). Os únicos alvos rotulados na tela são o cabeçalho, os botões de ação e a lista de lances. Em `BoardView.tsx` não há nenhuma propriedade `accessibility*`, e o tabuleiro é controlado por gesto, sem `Pressable` por casa.
- **Quem é afetado:** quem usa leitor de tela (TalkBack), teclado ou switch. Não dá para saber onde estão as peças nem para fazer um lance. Essa é a função principal do app.
- **Evidência:** evidencias/A1.png (`claro-bot-partida.png`, `escuro-analise.png`) · `src/components/BoardView.tsx:579-640` (casas e coordenadas sem rótulo)
- **Sugestão:** dar a cada casa `accessible`, `accessibilityRole="button"` e um rótulo como `accessibilityLabel="e4, peão branco"` (ou "e4, vazia"), com `accessibilityState={{ selected }}` na casa escolhida. Também ajuda anunciar o último lance numa região viva (`accessibilityLiveRegion="polite"` no Android), por exemplo "Bot jogou d4". Uma alternativa mais barata é um campo "Digite o lance (ex.: e4, Cf3)" para quem usa leitor de tela.

### A2 · `textMuted` abaixo de 4,5:1 nos dois temas — Alto · 1.4.3 Contraste (mínimo)
- **Onde:** rótulos de campo ("Jogar de", "Formato", "Tempo", "Bots", "Seu nome", "Código"), dicas de Ajustes ("Mostra o melhor lance…", "Toque para testar as animações"), "Bot · 1200 · Intermediário", "você", "conectado", "(você)", "Nenhum lance ainda", "SALA" no selo da sala, níveis dos bots no torneio, placeholders ("Como o adversário vai te ver", "ABC123", "Cole o PGN aqui"), números da lista de lances, "Toque num número…" do relatório · ambos os temas
- **Medição** (DOM, confirmada por pixel no print):
  - claro: `#8a8378` sobre papel `#ece6da` = **3,02:1**, sobre cartão `#e2dbcc` = **2,72:1** e sobre `surfaceAlt` `#d7cfbe` = **2,42:1**
  - escuro: `#7a7369` sobre `#151413` = **3,93:1**, sobre `#1e1c1a` = **3,63:1** e sobre `#292623` = **3,21:1**
  - os textos têm 11 a 13 px, então precisam de 4,5:1
- **Quem é afetado:** baixa visão, pessoas mais velhas, uso no sol (o caso típico do celular)
- **Evidência:** evidencias/A2.png (claro × escuro, cartão "Partida") · `src/theme.ts:37` e `src/theme.ts:55` · usos em `src/components/play/ui.tsx:426-429` (`fieldLabel`), `src/components/play/ChatSheet.tsx:119`, `src/components/ImportModal.tsx:161`, `src/screens/OnlineScreen.tsx:496` e `:555` (58 ocorrências de `colors.textMuted`)
- **Sugestão:** ajuste mínimo, no mesmo tom quente:
  - claro: `textMuted` → **`#666058`** (5,00:1 sobre papel e 4,51:1 sobre cartão). Se também aparecer sobre `surfaceAlt`, use `#5d5851` (4,55:1).
  - escuro: `textMuted` → **`#938c81`** (5,53:1, 5,10:1 e 4,52:1 sobre `surfaceAlt`)
  - a hierarquia em relação a `textDim` (`#57524a` / `#aba294`) continua visível

### A3 · Vermelho em texto pequeno sobre papel e cartão — Alto · 1.4.3 Contraste (mínimo)
- **Onde:**
  - rótulos de cartão ("NÍVEL DO BOT", "PARTIDA", "NOME DO TORNEIO", "PARTICIPANTES", "ENTRAR EM UM TORNEIO ONLINE"), com 12 px em negrito
  - "INTERMEDIÁRIO" abaixo do rating (11 px)
  - aba ativa da barra inferior (10,5 px)
  - números "01–04" da aba **SOBRE** (13 px)
  - "ANALYZER" no rodapé do relatório (11 px)
  - valores da ficha técnica `MetaRow` (10,5 px, itálico)
  - ambos os temas
- **Medição:**
  - claro: `#d7261e` sobre `#e2dbcc` = **3,64:1** e sobre `#ece6da` = **4,04:1** (aba "INÍCIO" da barra)
  - escuro: `#e2392e` sobre `#1e1c1a` = **3,93:1** e sobre `#151413` = **4,26:1**
  - nada disso é "texto grande" (precisaria de ≥ 18,66 px em negrito)
- **Quem é afetado:** baixa visão e daltonismo para vermelho (protanopia). Esses rótulos são os títulos das seções.
- **Evidência:** evidencias/A3.png · `src/components/play/ui.tsx:419-425` (`cardLabel`), `src/components/play/ui.tsx:549-552` (`ratingLabel`), `src/components/NavBar.tsx:30` e `:74-78` (cor da aba ativa e 10,5 px), `src/components/poster.tsx:149-152` (`MetaRow.value`), `src/components/AboutSection.tsx` (números das seções)
- **Sugestão:** criar um token **`redText`** só para texto pequeno e manter `red` nos preenchimentos e títulos grandes. Assim o "vermelho de impressão" do cartaz continua igual:
  - claro: `redText` = **`#bc211a`** (5,01:1 sobre papel e 4,52:1 sobre cartão)
  - escuro: `redText` = **`#e86158`** (5,50:1, 5,08:1 e 4,50:1 sobre `surfaceAlt`)

### A4 · Texto sobre o vermelho dos botões principais — Alto · 1.4.3 Contraste (mínimo)
- **Onde:**
  - botões JOGAR (Início e configuração do bot), COMEÇAR TORNEIO, CRIAR E CONVIDAR, COMPARTILHAR CONVITE, ANALISAR PARTIDA e VER LANCES
  - segmento ativo dos Ajustes (Claro/Escuro, Normal, Suave, Médio)
  - atalho de rating ativo ("1200")
  - relógio com pouco tempo
  - claro: falha por pouco; escuro: falha
- **Medição:**
  - claro: `onRed #f6f1e7` sobre `#d7261e` = **4,46:1** (pixel do print igual)
  - escuro: `#f6f1e7` sobre `#e2392e` = **3,84:1** e `#ffffff` (fixo no código) sobre `#e2392e` = **4,32:1**
  - os rótulos têm 13 a 18 px em peso 800/900, então não contam como texto grande
  - o relógio com pouco tempo (`#fff` sobre vermelho) dá 5,02:1 no claro e **4,32:1** no escuro. Ele passa como texto grande (22 px), mas fica no limite.
- **Quem é afetado:** baixa visão. Esses são justamente os botões de ação principal.
- **Evidência:** evidencias/A4.png (claro × escuro) · `src/theme.ts:31`, `:40`, `:49`, `:58` · `#fff` fixo em vez de `colors.onRed`: `src/components/play/ui.tsx:579` (`presetTextActive`), `src/components/SettingsModal.tsx:503`, `src/components/ImportModal.tsx:275`, `src/components/ReportSheet.tsx:359`, `src/screens/OnlineScreen.tsx:1299`, `src/components/AnalysisModeSheet.tsx:170`, `src/components/play/TournamentView.tsx:351`
- **Sugestão:**
  - escurecer só o preenchimento: claro `red` → **`#d5261e`** (4,52:1, diferença imperceptível) e escuro `red` → **`#d4291d`** (4,51:1). Isso fica próximo do vermelho do claro e mantém a marca.
  - o "mais claro para manter o contraste" do escuro (comentário em `theme.ts:49`) vai para o `redText` do achado A3
  - trocar os `#fff` fixos por `colors.onRed`, para que o par seja sempre o mesmo

### A5 · Seleção e papel dos controles não são anunciados — Alto · 4.1.2 Nome, função, valor
- **Onde:**
  - chips "Jogar de", "Formato" e "Tempo" (bot, online e torneio)
  - atalhos de rating (400…2800)
  - segmentos de Ajustes (tema do app, velocidade, estilo, intensidade, volume)
  - abas TABULEIRO/ANIMAÇÕES/SONS/SOBRE
  - abas PGN/Chess.com/Lichess do Importar
  - mata-mata/pontos corridos do torneio
  - ambos os temas
- **Medição:**
  - em todas essas telas, `aria-selected` e `role` vieram vazios (`null`) em 100% dos chips e abas medidos. A exceção é a barra inferior, que usa `role="tab"` e `aria-selected`.
  - no código há 66 `<Pressable` e só 3 `accessibilityRole` (`NavBar.tsx:32`, `AnalysisScreen.tsx:835`, `AboutSection.tsx:102`)
  - `accessibilityState` só aparece em `NavBar.tsx:33`
  - os atalhos de rating não têm nem rótulo (`ui.tsx:193`)
- **Quem é afetado:** leitor de tela. O TalkBack lê "MD3" sem dizer "botão" nem "selecionado", e não dá para saber qual tempo ou formato está ativo.
- **Evidência:** evidencias/A5.png (abas e segmento de Ajustes) · `src/components/play/ui.tsx:150-162` (`Chips`), `:186-196` (atalhos de rating), `src/components/SettingsModal.tsx:84-90` (abas), `src/components/ImportModal.tsx:141-151` (abas do Importar), `src/components/play/BotSetup.tsx:69`
- **Sugestão:** usar `accessibilityRole="radio"` (ou `"button"`) com `accessibilityState={{ selected: value === o.id }}` nos chips, segmentos e atalhos. Nas abas, usar `accessibilityRole="tab"` com `selected` e `accessibilityRole="tablist"` no contêiner. Os `Pressable` genéricos ganham `accessibilityRole="button"` (dá para resolver de uma vez em `PrimaryButton`, `ActionBtn`, `IconBtn` e `PosterRow`).

### A6 · Botões só com ícone sem rótulo — Alto · 4.1.2 Nome, função, valor / 1.1.1
- **Onde:** botão "→" de **entrar com código** no saguão online (claro e escuro) e botão **compartilhar** do torneio online
- **Medição:** o botão de entrar tem 54×48 px, `aria-label=null`, nenhum texto e nenhum papel. O TalkBack lê só "botão" (ou nada), e esse é o único jeito de entrar numa sala sem o teclado.
- **Quem é afetado:** leitor de tela
- **Evidência:** evidencias/A6.png · `src/screens/OnlineScreen.tsx:562-575` · `src/screens/PlayScreen.tsx:758`
- **Sugestão:** usar `accessibilityLabel="Entrar na sala"` com `accessibilityRole="button"` e `accessibilityState={{ disabled }}` no primeiro, e `accessibilityLabel="Compartilhar convite do torneio"` no segundo.

### A7 · Alvos de toque menores que 48 dp — Médio · 2.5.8 Tamanho do alvo (mínimo) / diretriz Android 48 dp
- **Onde e medição** (caixa medida com `getBoundingClientRect`; o `hitSlop` foi somado quando existe):

| Elemento | Medido | Com hitSlop | Código |
|---|---|---|---|
| Atalhos de rating 400…2800 | 46–54 × **29** | 29 | `ui.tsx:562-566` |
| Chips Única/MD3/Tempo | 58–101 × **37–38** | 38 | `ui.tsx:478-487` |
| −/+/remover bot no torneio | **30 × 30** | 30 (sem hitSlop) | `TournamentSetup.tsx:134-149`, `:226-227` |
| Segmentos e abas de Ajustes / Importar | 85–113 × **30–32** | 32 | `SettingsModal.tsx:426-431` |
| "Testar" (Jogar lance, Brilhante…) | 63–97 × **29** | 29 | `SettingsModal.tsx` (`AnimationPreview`) |
| Fechar (X) das folhas | **22 × 22** | 46 | `Sheet.tsx:29` |
| "Cancelar sala" | 83 × **16** | 32 | `OnlineScreen.tsx:670` |
| Lances da lista | 30–59 × **25** | 33 | `MoveList.tsx:82`, `:112-116` |
| Interruptor (torneio online) | **40 × 20** | — | `TournamentSetup.tsx` |
| Botões de ícone da análise | 40 × 40 | 48 ✔ | `AnalysisScreen.tsx:1051` |

- Todos passam no mínimo do WCAG AA (24 px), mas ficam abaixo do padrão Android e da AAA (44 px).
- **Quem é afetado:** dedos grandes, tremor e uso com uma mão
- **Evidência:** evidencias/A7.png (atalhos de rating e botões de 30 px do torneio)
- **Sugestão:** usar `minHeight: 44` com `hitSlop` até 48 nos chips, segmentos e atalhos (`paddingVertical: 6 → 12`). Nos 30×30 do torneio, `hitSlop={9}`. No X das folhas, `hitSlop={13}`. Em "Cancelar sala", `paddingVertical: 12`.

### A8 · Texto muito pequeno e coordenadas do tabuleiro ilegíveis — Médio · 1.4.3 / 1.4.4 Redimensionar texto
- **Onde:** coordenadas do tabuleiro (todas as telas de partida e análise), barra inferior, chat e selo de espectador · ambos os temas
- **Medição:**
  - coordenadas a–h/1–8: **8 px** em `#a39b8a` sobre `#f2ede2` = **2,36:1** (tabuleiro Pôster, que é o padrão de quem instala agora). O tamanho é `Math.max(8, sq*0.17)`, e num celular de 360 dp a casa tem ~45 dp, então a fonte fica em 8 px.
  - barra inferior: 10,5 px (`NavBar.tsx:77`)
  - `MetaRow`: 10,5 px (`poster.tsx:151`)
  - etiqueta de espectador no chat: **9 px** em `textMuted` (3,02:1 no claro) (`ChatSheet.tsx:119-121`)
  - selo "assistindo": 9 px (`OnlineScreen.tsx:1385`)
  - bolinha de não lidas: 10 px (`ChatSheet.tsx:213`)
  - ponto positivo: `allowFontScaling={false}` só aparece nos selos e nas comemorações (`MoveBadge.tsx:46`, `Celebration.tsx`), o que é aceitável
- **Quem é afetado:** baixa visão e quem aprende xadrez pelas coordenadas
- **Evidência:** evidencias/A8.png (ampliação das coordenadas) · `src/components/BoardView.tsx:579`, `:626-639`
- **Sugestão:**
  - fonte mínima de 11 px no app (12 px na barra)
  - coordenadas com `Math.max(10, sq*0.2)` e cor de contraste maior, sem mexer nas casas: no Pôster, `#6f685b` sobre a casa clara (4,72:1) e tinta `#141414` sobre a casa escura `#a39b8a` (6,68:1)
  - outra opção é uma opção "Coordenadas grandes" em Ajustes → Tabuleiro

### A9 · Pouco tempo e vez de jogar indicados só por cor — Médio · 1.4.1 Uso de cor
- **Onde:** relógio da partida contra o bot e online; partida sem relógio ("Livre") · ambos os temas
- **Medição:**
  - com menos de 20 s, o relógio só troca o fundo de tinta para vermelho. O ícone de relógio e o texto continuam iguais (`low && ui.clockLow`).
  - sem relógio, a vez de jogar é um **ponto de 10 px** (`turnDot`), sem texto e sem rótulo
  - na simulação de deuteranopia, o vermelho vira oliva escuro e se confunde com o tinta/creme
- **Quem é afetado:** daltônicos (cerca de 8% dos homens) e leitor de tela, que não recebe aviso de pouco tempo nem de vez de jogar
- **Evidência:** evidencias/claro-bot-partida.png (ponto ao lado de "Você") · evidencias/claro-online-partida-deuteranopia.png · `src/components/play/ui.tsx:247`, `:268-273`, `:650-655` · `src/screens/OnlineScreen.tsx:970`, `:995-1000`
- **Sugestão:**
  - no pouco tempo, trocar o ícone (por exemplo "alarme") ou piscar o relógio uma vez (respeitando Animações) e anunciar "20 segundos" com `AccessibilityInfo.announceForAccessibility`
  - na vez de jogar, mostrar o texto "sua vez" / "pensando…" (já existe para o bot) e dar `accessibilityLabel` ao ponto

### A10 · Selos e contagens da classificação com pouco contraste — Médio · 1.4.11 Contraste não textual / 1.4.3
- **Onde:** Analisar → relatório e lista de lances · ambos os temas (os selos têm a mesma cor nos dois)
- **Medição:**
  - glifo branco sobre o selo: Brilhante "!!" **2,25:1**, Melhor ★ 2,24:1, Excelente 2,06:1, Livro 2,58:1, Imprecisão "?!" **1,68:1** e Erro "?" 2,40:1. Só Capivarada passa (4,55:1).
  - contagens coloridas no relatório claro: Ótimo `#5b8bd6` sobre `#e2dbcc` = 2,49:1 e Livro `#c39a6b` = **1,87:1** (pixel confirmado)
  - o "livro" ao lado do lance na análise: 2,07:1
  - os zeros a 35% de opacidade ficam com 1,1–1,6:1. São decorativos, aceitável.
  - na deuteranopia, Melhor, Excelente, Imprecisão e Erro viram todos mostarda. O glifo é o que diferencia, mas ele é o elemento com menos contraste.
- **Quem é afetado:** daltônicos e baixa visão
- **Evidência:** evidencias/A10.png (relatório normal × deuteranopia) · `src/components/MoveBadge.tsx:13-19`, `:40-48` · `src/utils/moveClassifier.ts:41-50` · `src/components/ReportSheet.tsx`
- **Sugestão:**
  - nos selos claros (Brilhante, Melhor, Excelente, Bom, Livro, Imprecisão e Erro), desenhar o glifo em tinta `#141414`. O contraste fica entre 7,2 e 11:1 e a cor do selo continua igual.
  - no relatório, escrever as contagens em `colors.text`; o selo colorido ao lado já dá a cor
  - em "livro", usar `textDim` com o ícone do livro

### A11 · Campos de texto e chips sem contorno, e campos sem rótulo associado — Médio · 1.4.11 Contraste não textual / 1.3.1 / 3.3.2
- **Onde:** saguão online (Seu nome, código), torneios (Seu nome, Código, Nome do torneio), Importar (PGN, nick), chips não selecionados · ambos os temas (pior no escuro)
- **Medição:**
  - o campo só se destaca do cartão pelo preenchimento: claro `#ece6da` sobre `#e2dbcc` = **1,11:1** e escuro `#151413` sobre `#1e1c1a` = **1,08:1** (pixels do print)
  - a borda `border` do chip fica entre 1,39 e 1,56:1
  - os `TextInput` não têm `accessibilityLabel`: o leitor lê o placeholder ("ABC123", "Como o adversário vai te ver"), e o placeholder some quando a pessoa digita
- **Quem é afetado:** baixa visão (não acha o campo) e leitor de tela (perde o nome do campo)
- **Evidência:** evidencias/A11.png (claro × escuro) · `src/screens/OnlineScreen.tsx:491-499`, `:553-562` · `src/components/play/ui.tsx:432-437` · `src/theme.ts:30`, `:48`
- **Sugestão:**
  - borda de 1 px num token novo `borderStrong`: claro **`#938263`** (3,0:1 sobre o papel) e, no escuro, uma borda clara equivalente. O `border` atual continua nas linhas decorativas, como pede o BRAND.
  - `accessibilityLabel="Seu nome"` / `"Código da sala"` em cada `TextInput`

### A12 · Avisos (toasts) curtos e não anunciados — Médio · 4.1.3 Mensagens de status / 2.2.1
- **Onde:** partida contra o bot (falas do bot) e online (avisos)
- **Medição:** os toasts somem em **2,4–2,6 s**. "Roque Rita: Que vença o melhor 🤝" tem 33 caracteres, e quem lê devagar ou com lupa perde. Nenhum `accessibilityLiveRegion` ou `announceForAccessibility` existe no projeto (0 ocorrências).
- **Quem é afetado:** leitor de tela, baixa visão (zoom) e dislexia
- **Evidência:** evidencias/claro-bot-partida.png, evidencias/escuro-bot-partida.png · `src/components/play/BotGame.tsx:104`, `:120` · `src/screens/OnlineScreen.tsx:137`
- **Sugestão:** usar uma duração mínima de 4 s mais 60 ms por caractere e colocar `accessibilityLiveRegion="polite"` na `View` do toast (Android).

### A13 · Animações não seguem o "remover animações" do sistema — Baixo · 2.3.3 Animação por interação (AAA)
- **Onde:** comemorações (confete, brilhante, xeque-mate), deslize de peças e deslize entre abas
- **Medição:**
  - `AccessibilityInfo.isReduceMotionEnabled` não é usado em nenhum lugar (0 ocorrências). Quem já ligou "Remover animações" no Android recebe confete por padrão (`DEFAULT_ANIMATION`, tudo ligado).
  - o deslize entre abas (`App.tsx:233-285`, 110–200 ms com mola) não lê as preferências
  - ponto positivo: Ajustes → Animações deixa desligar tudo (velocidade "Sem", cada comemoração, intensidade), e `celebrationAllowed` é respeitado em `AnalysisScreen.tsx:148`
- **Quem é afetado:** distúrbios vestibulares, enxaqueca, TDAH
- **Evidência:** evidencias/claro-ajustes-animacoes.png · `src/settings/animation.ts:25-36` · `App.tsx:233-249`
- **Sugestão:** na primeira abertura, se `isReduceMotionEnabled()` for verdadeiro, partir de `pieceSpeed: 'off'` e das comemorações desligadas. No deslize entre abas, pular a animação quando `pieceSpeed === 'off'`.

### A14 · Abas de Ajustes encostadas e com `adjustsFontSizeToFit` — Baixo · 1.4.4 / 1.4.11
- **Onde:** Ajustes → abas TABULEIRO / ANIMAÇÕES / SONS / SOBRE · ambos os temas
- **Medição:**
  - 4 abas de 85 px. "TABULEIRO" e "ANIMAÇÕES" se tocam ("TABULEIROANIMAÇÕES" no print).
  - `adjustsFontSizeToFit` encolhe o texto quando a pessoa aumenta a fonte do sistema, o que anula o aumento
  - a aba ativa só muda o fundo (`surfaceAlt` sobre `bg` = 1,25:1 no claro e 1,22:1 no escuro) e a cor do texto (textDim → text)
  - no web o encolhimento não acontece. A sobreposição vem da fonte de fallback, mas o encolhimento no Android vem do código.
- **Evidência:** evidencias/A5.png · `src/components/SettingsModal.tsx:86`, `:426-441`
- **Sugestão:** tirar o `adjustsFontSizeToFit` e deixar a fileira rolar na horizontal (ou usar 2×2). Marcar a aba ativa com um traço vermelho de 2 px embaixo, como já é na barra inferior (`NavBar` `marker`).

### A15 · Rótulos que escondem ou contradizem o que se vê — Baixo · 2.4.6 / 2.5.3 Rótulo no nome
- **Onde:** linhas de menu (`PosterRow`) e cabeçalhos de Jogar e Analisar
- **Medição:**
  - `PosterRow` usa `accessibilityLabel={title}`, então o subtítulo é descartado. "Continuar análise" não diz qual partida, e "Contra o bot" perde "Rating de 400 a 3000".
  - o ícone de **casa** no cabeçalho de Jogar e Analisar é anunciado como "Voltar" (`Header` usa o rótulo fixo "Voltar" para qualquer ícone)
- **Evidência:** evidencias/claro-jogar.png · `src/components/poster.tsx:68` · `src/components/play/ui.tsx:31` · `src/screens/AnalyzeHub.tsx:19`
- **Sugestão:** usar ``accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}`` e, no `Header`, rótulo "Início" quando `icon === 'home'`.

## Tabela de contraste da paleta

Calculada com `scripts/contraste.py` (luminância relativa WCAG). Na coluna "Passa?", "grande" significa que só vale para texto ≥ 18,66 px em negrito ou ≥ 24 px, ou para ícones (3:1).

| Par | Claro | Escuro | Passa? |
|---|---|---|---|
| `text` / `bg` | 14,82 | 14,80 | ✔ AAA |
| `text` / `surface` | 13,37 | 13,67 | ✔ AAA |
| `text` / `surfaceAlt` | 11,89 | 12,11 | ✔ AAA |
| `textDim` / `bg` | 6,23 | 7,30 | ✔ AA |
| `textDim` / `surface` | 5,62 | 6,74 | ✔ AA |
| `textDim` / `surfaceAlt` | 5,00 | 5,97 | ✔ AA |
| `textMuted` / `bg` | **3,02** | **3,93** | ✘ normal · ✔ grande |
| `textMuted` / `surface` | **2,72** | **3,63** | ✘ claro em tudo · escuro só grande |
| `textMuted` / `surfaceAlt` | **2,42** | **3,21** | ✘ claro em tudo · escuro só grande |
| `red` / `bg` (texto vermelho) | **4,04** | **4,26** | ✘ normal · ✔ grande |
| `red` / `surface` | **3,64** | **3,93** | ✘ normal · ✔ grande |
| `red` / `surfaceAlt` | **3,24** | **3,48** | ✘ normal · ✔ grande |
| `onRed` / `red` (botão) | **4,46** | **3,84** | ✘ normal · ✔ grande |
| `#fff` / `red` (fixo no código) | 5,02 | **4,32** | claro ✔ · escuro ✘ normal |
| `onRed` / `redDark` | 8,11 | 6,66 | ✔ |
| `redDark` / `bg` | 7,35 | **2,45** | claro ✔ · escuro ✘ |
| `border` / `bg` (contorno) | **1,55** | **1,56** | ✘ 3:1 se carregar informação |
| `border` / `surface` | **1,39** | **1,44** | ✘ |
| `surfaceAlt` / `bg` (aba ativa) | 1,25 | 1,22 | ✘ como único indicador |
| Coordenada Pôster `#a39b8a` / `#f2ede2` | **2,36** | 2,36 | ✘ |
| Glifo branco / selo Imprecisão `#f2c230` | **1,68** | 1,68 | ✘ |

**Ajuste mínimo proposto** (mesmo tom, dentro do BRAND):

| Token | Atual claro → novo | Resultado | Atual escuro → novo | Resultado |
|---|---|---|---|---|
| `textMuted` | `#8a8378` → `#666058` | 5,00 bg · 4,51 surface | `#7a7369` → `#938c81` | 5,53 / 5,10 / 4,52 |
| `red` (preenchimento) | `#d7261e` → `#d5261e` | `onRed` 4,52 | `#e2392e` → `#d4291d` | `onRed` 4,51 |
| `redText` (novo, texto pequeno) | `#bc211a` | 5,01 bg · 4,52 surface | `#e86158` | 5,50 / 5,08 / 4,50 |
| `borderStrong` (novo, campos e chips) | `#938263` | 3,01 bg | equivalente claro no escuro | ≥ 3,0 |
| Glifo dos selos claros | `#fff` → `#141414` | 7,2–11,0 | igual | igual |

## Já está bom

- **Tinta sobre papel** e o inverso no escuro: 14,8:1. `textDim` passa em todas as superfícies, com no mínimo 5,0:1.
- **Barra inferior** com `accessibilityRole="tab"`, `accessibilityState={{ selected }}` e rótulo (`NavBar.tsx:32-34`). A aba ativa tem cor, traço superior e ícone mais grosso, então não depende só de cor. As abas medem 76×~60 px.
- **Botões de ícone** do cabeçalho e da análise têm rótulo ("Girar tabuleiro", "Configurações", "Copiar PGN", "Ligar análise ao vivo"…) e área efetiva ≥ 48 px com `hitSlop` (`ui.tsx:40-60`, `AnalysisScreen.tsx:830-837`). O ponto do motor tem `accessibilityLabel` com o estado (`AnalysisScreen.tsx:888`).
- **A classificação dos lances não depende só de cor:** cada selo tem um glifo próprio (!!, !, ★, 👍, ✓, 📖, ?!, ?, ✕, ??), o relatório escreve o nome ("Brilhante", "Capivarada"…) e a lista de lances repete "??"/"!". Falta só contraste no glifo (A10).
- **Presença online** usa cor e texto ("conectado" / "desconectado" / "jogando…") (`OnlineScreen.tsx:977-990`).
- **Animações:** Ajustes → Animações deixa desligar o deslize de peças, cada comemoração e o efeito de captura, e reduzir a intensidade, com um mini tabuleiro para testar. As comemorações respeitam isso (`celebrationAllowed`).
- **`allowFontScaling={false}`** só é usado em selos e comemorações, como manda a regra. Os textos de leitura acompanham a fonte do sistema.
- **Aba SOBRE (nova):** texto corrido em `textDim` sobre `surface` (5,6:1 no claro e 6,7:1 no escuro), títulos em tinta e links com `accessibilityRole="link"` (`AboutSection.tsx:102-103`). O único problema são os números "01–04" em vermelho (A3).
- **Estados desativados** (Empate antes do 2º lance, ANALISAR PARTIDA sem PGN) ficam com 1,9–2,4:1. O WCAG isenta componentes inativos, e o estado está claro.
- **Carregamentos:** os botões principais trocam o ícone por `ActivityIndicator` (`ui.tsx:108`), e o relatório mostra o progresso até "VER LANCES".
- Nenhum erro de JavaScript (`pageerror`/console) durante a auditoria, nos dois temas.

---
*Scripts usados (só leitura do projeto):* `scripts/auditlib.py`, `scripts/fluxo.py`, `scripts/explora.py`, `scripts/extra.py`, `scripts/resumo.py`, `scripts/amostra.py`, `scripts/paleta.py`, `scripts/sugere.py`. *Medidas brutas:* `scripts/out-*.json`.
