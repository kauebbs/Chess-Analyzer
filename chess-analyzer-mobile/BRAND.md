# NOXARI CHESS — identidade visual

**Conceito:** Playful Chess Identity. Divertida, amigável e inteligente; o xadrez continua confortável e sério.

## Mascote
- **Nox**, a capivara com capa verde-floresta, coroa e medalha de peão.
- As poses ficam em `assets/mascote/` (hero, festa, pensa, rei, tonta, oculos, livro, icone) e são usadas só pelo
  componente `Mascot` (`src/components/Mascot.tsx`). Não redesenhe a mascote em SVG/emoji: use as poses.
- Professores: Lia = Nox lendo (amarelo), Otto = Nox de óculos (azul), Davi = Nox comemorando (verde).

## Cores (`src/theme.ts`)
| Papel | Claro | Escuro |
|---|---|---|
| Fundo | Creme #FFF5DF | Floresta #16211B |
| Ação (token `red`) | Verde #58CC65, borda 3D #3E9E4C | Verde #58CC65, borda #2F7F3C |
| Verde como texto (`brandText`) | #287D42 | #7FDC8A |
| Texto | Grafite #303A35 | Creme #FFF5DF |
| Apoio | Amarelo #FFC83D, Azul #42B9E8, Laranja #FF994D, Marrom #A96943 | iguais |
| Erro (`danger`) | #E0453A | #FF6B5E |

Verde é a cor de reconhecimento. Amarelo/azul/laranja só para diferenciar itens (selos dos menus), nunca para
decorar. Nada de gradientes.

## Tipografia
Nunito (Google Fonts, OFL), uma família só: 900 títulos, 800 rótulos, 700 destaques, 600 texto.
Títulos de tela em frase ("Bora jogar?"), rótulos pequenos em caixa alta espaçada.

## Forma
- Cantos: botões 16, cards 18–20, chips 14.
- **Volume com intenção:** botões e itens tocáveis têm borda inferior mais grossa (4–5 px) da cor mais escura;
  ao tocar, afundam. Cards estáticos têm borda fina.
- Telas-menu abrem com `MascotHero` (título + Nox sobre um "morro" de cor). Cada tela usa uma pose, um lado e
  uma cor diferentes.

## Tabuleiro
Tema "Noxari": casas creme #F4EFD9 e verde-sálvia #9DBF83, último lance em amarelo, melhor lance em verde.
