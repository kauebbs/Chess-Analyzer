# Chess Analyzer

Aplicação web para análise de partidas de xadrez a partir de arquivos ou textos no formato PGN. O projeto utiliza o mecanismo **Stockfish** para avaliar posições e apresenta estatísticas que ajudam a identificar os principais momentos da partida, os acertos e os erros de cada jogador.

## Funcionalidades

- Importação e leitura de partidas no formato PGN.
- Identificação da abertura jogada, com nome e código ECO.
- Avaliação das posições utilizando o Stockfish.
- Classificação dos lances, incluindo melhor lance, excelente, bom, imprecisão, erro e erro grave.
- Cálculo da precisão de cada jogador e estimativa de rating.
- Relatório com estatísticas individuais de brancas e negras.
- Tabuleiro interativo para navegar pelos lances da partida.
- Gráfico de avaliação da partida.
- Indicação do melhor lance sugerido pelo mecanismo.
- Criação e avaliação de variantes diretamente no tabuleiro.

## Tecnologias utilizadas

### Backend
- Node.js
- Express
- chess.js
- Stockfish

### Interface
- HTML, CSS e JavaScript
- Tailwind CSS
- jQuery
- chessboard.js
- Chart.js

Parte das bibliotecas utilizadas pela interface é carregada por CDN.

## Requisitos

Antes de executar o projeto, tenha instalado:

- [Node.js](https://nodejs.org/) (com npm).
- [Stockfish](https://stockfishchess.org/), compatível com seu sistema operacional.

O executável do Stockfish deve estar dentro da pasta `engine`, na raiz do projeto:

- Windows: `engine/stockfish.exe`
- Linux e macOS: `engine/stockfish`

No Linux ou macOS, verifique também se o executável possui permissão de execução.

## Instalação e execução

1. Clone o repositório:

   ```bash
   git clone https://github.com/kauebbs/Chess-Analyzer.git
   ```

2. Entre na pasta do projeto:

   ```bash
   cd Chess-Analyzer
   ```

3. Instale as dependências:

   ```bash
   npm install
   ```

4. Coloque o executável do Stockfish na pasta `engine`.

5. Inicie o servidor:

   ```bash
   npm start
   ```

6. Acesse a aplicação:

   ```text
   http://localhost:3000
   ```

A porta padrão é `3000`. É possível definir outra porta por meio da variável de ambiente `PORT`.

## Como utilizar

1. Abra a aplicação no navegador.
2. Insira uma partida no formato PGN pela opção de análise.
3. Selecione a profundidade de análise disponível na interface.
4. Inicie a análise e aguarde o processamento do Stockfish.
5. Consulte o relatório dos jogadores, a classificação dos lances e o gráfico de avaliação.
6. Navegue pelos lances para acompanhar as posições no tabuleiro.
7. Para explorar alternativas, faça movimentos no tabuleiro e consulte a avaliação da variante.

## API

O servidor disponibiliza duas rotas principais:

### `POST /api/analyze`

Analisa uma partida completa a partir de um PGN.

Exemplo de requisição:

```json
{
  "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
  "depth": 12
}
```

A resposta contém informações sobre os jogadores, precisão, estimativa de rating, abertura identificada, avaliação inicial e classificação de cada lance.

### `POST /api/evaluate`

Avalia uma posição específica do tabuleiro a partir de uma FEN.

Exemplo de requisição:

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "depth": 12
}
```

A resposta inclui a avaliação da posição, possível mate, melhor lance e linha principal encontrada pelo Stockfish.

## Estrutura principal

```text
Chess-Analyzer/
├── engine/
│   └── stockfish(.exe)
├── public/
│   └── index.html
├── server.js
├── package.json
└── package-lock.json
```

O executável do Stockfish deve ser adicionado localmente à pasta `engine`.

## Observações

- A análise depende da disponibilidade e da execução correta do Stockfish.
- A profundidade de análise influencia o tempo de processamento e a qualidade da avaliação.
- A estimativa de rating e os índices de precisão são métricas calculadas pelo projeto; não representam uma classificação oficial de plataformas de xadrez.
- O desempenho pode variar conforme o hardware e a profundidade selecionada.

## Autor

Desenvolvido por [kauebbs](https://github.com/kauebbs).

## Repositório

[[github.com/kauebbs/Chess-Analyzer](https://github.com/kauebbs/Chess-Analyzer)](https://github.com/kauebbs/Noxari-Chess)
