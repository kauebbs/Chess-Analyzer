import React from 'react';
import { JsxAST, parse, SvgAst } from 'react-native-svg';
import { PIECE_SETS, PieceCode } from '../pieces/pieceSets';

interface PieceProps {
  setId: string;
  color: 'w' | 'b';
  type: string; // 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
  size: number;
}

/**
 * O SVG de cada peça é interpretado uma vez só e reaproveitado. Antes, cada peça que surgia
 * na tela (a cada lance) relia o XML inteiro, o que travava as animações ao navegar rápido.
 */
const AST_CACHE = new Map<string, JsxAST | null>();

function astFor(setId: string, code: PieceCode): JsxAST | null {
  const key = `${setId}:${code}`;
  let ast = AST_CACHE.get(key);
  if (ast === undefined) {
    const set = PIECE_SETS.find((s) => s.id === setId) ?? PIECE_SETS[0];
    try {
      ast = parse(set.pieces[code]);
    } catch {
      ast = null;
    }
    AST_CACHE.set(key, ast);
  }
  return ast;
}

const PieceBase: React.FC<PieceProps> = ({ setId, color, type, size }) => {
  const code = `${color}${type.toUpperCase()}` as PieceCode;
  return <SvgAst ast={astFor(setId, code)} override={{ width: size, height: size }} />;
};

export const Piece = React.memo(PieceBase);
