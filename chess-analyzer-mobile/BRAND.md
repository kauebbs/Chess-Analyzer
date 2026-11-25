# Identidade visual — Chess Analyzer

![Prancha da marca](assets/brand/brand-sheet.png)

Estilo **cartaz editorial**: papel creme, tinta preta e vermelho de impressão; letreiro gigante,
condensado e alto; detalhes pequenos de gráfica (marcas de registro "+", ficha técnica em vermelho,
código de barras, letras das colunas do tabuleiro). Tudo é minimalista: linhas finas, nada de
sombras ou bordas grossas. Os desenhos são originais do app.

## Marca
- **Símbolo:** cavalo em silhueta preta sobre um círculo vermelho, no papel creme (com "+" de
  registro nos cantos quando há espaço).
- **Letreiro:** "CHESS" em vermelho e "ANALYZER" em preto, fonte League Gothic (SIL OFL) convertida
  em contornos — o app não precisa carregar a fonte.
- **Cartaz do início:** "CHESS" gigante sangrando na borda e o cavalo na frente.

Arquivos: `assets/brand/logo.svg`, `logo-mono.svg`, `wordmark.svg`, `hero.svg`, `brand-sheet.*`;
no app, `src/brand/brandSvgs.ts` e `src/components/Logo.tsx` (`LogoMark`, `Wordmark`, `Lockup`, `Barcode`).
Ícones: `assets/icon.png`, `assets/android-icon-*.png`, `assets/splash-icon.png`, `assets/favicon.png`.

## Cores (`src/theme.ts`)
| Nome | Hex | Uso |
|---|---|---|
| Papel | `#ECE6DA` | Fundo de todas as telas |
| Tinta | `#141414` | Texto, ícones, botões secundários, destaque (no código: `colors.mint`) |
| Vermelho | `#D7261E` | Ação principal, títulos grandes, aba ativa, números |
| Papel escuro | `#E2DBCC` / `#D7CFBE` | Cartões e áreas de apoio |

Tabuleiro padrão de quem instala agora: tema **Pôster** (papel e cinza quente).

## Componentes (`src/components/poster.tsx`)
- `PosterRow` — item de menu: número vermelho, título condensado, seta, linha fina embaixo.
- `SectionLabel` — "01 JOGAR" com linha preta.
- `PosterHeading` — título grande vermelho, condensado, em caixa alta.
- `PosterButton` — retângulo chapado (tinta ou vermelho) ou só com contorno fino; cantos quase retos.
- `MetaRow` — ficha técnica "TÍTULO — valor" em vermelho com itálico.
- `Cross` — marca de registro "+".

## Tipografia
- Letreiro e cartazes: League Gothic (em contornos SVG).
- Títulos no app: condensada pesada do sistema, CAIXA ALTA.
- Valores da ficha técnica e textos de apoio: itálico.

## Tom de voz
Direto, em português, sem enfeite.
