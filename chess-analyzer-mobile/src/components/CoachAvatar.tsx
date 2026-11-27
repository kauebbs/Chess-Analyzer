import React from 'react';
import { View } from 'react-native';
import { Mascot, MascotPose } from './Mascot';
import { colors } from '../theme';

/**
 * Avatar do professor: a Nox numa pose que combina com cada um (Lia lendo, Otto de óculos escuros,
 * Davi comemorando), num círculo com aro da cor dele.
 */
const STYLE: Record<string, { pose: MascotPose; ring: () => string }> = {
  didatico: { pose: 'av_livro', ring: () => colors.yellow },
  direto: { pose: 'av_oculos', ring: () => colors.blue },
  motivador: { pose: 'av_festa', ring: () => colors.red },
};

export function CoachAvatar({ coachId, size = 44 }: { coachId: string; size?: number }) {
  const s = STYLE[coachId] ?? STYLE.didatico;
  const inner = size - 6;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: s.ring(),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Mascot pose={s.pose} height={inner} radius={inner / 2} />
    </View>
  );
}
