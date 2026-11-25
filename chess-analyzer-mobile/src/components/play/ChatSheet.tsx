import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Sheet } from '../Sheet';
import { Icon } from '../Icon';
import { colors } from '../../theme';

export interface ChatLine {
  id: string;
  mine: boolean;
  name: string;
  text: string;
  /** Mensagem do sistema (ex.: "Partida começou") */
  system?: boolean;
}

export const QUICK_PHRASES = ['Boa sorte!', 'Bom jogo!', 'Boa jogada!', 'Ops 😅', 'Obrigado!', 'Revanche?'];

export function ChatSheet({
  visible,
  onClose,
  lines,
  onSend,
  readOnlyHint,
}: {
  visible: boolean;
  onClose: () => void;
  lines: ChatLine[];
  onSend: (text: string) => void;
  /** Quando preenchido, não dá para escrever (ex.: espectador). */
  readOnlyHint?: string | null;
}) {
  const [text, setText] = useState('');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (visible) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
  }, [visible, lines.length]);

  const send = (t: string) => {
    const clean = t.trim();
    if (!clean) return;
    onSend(clean);
    setText('');
  };

  return (
    <Sheet visible={visible} title="Bate-papo" onClose={onClose}>
      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={{ gap: 6, paddingBottom: 6 }}>
        {lines.length === 0 && <Text style={styles.empty}>Nenhuma mensagem ainda. Diga oi! 👋</Text>}
        {lines.map((l) =>
          l.system ? (
            <Text key={l.id} style={styles.system}>
              {l.text}
            </Text>
          ) : (
            <View key={l.id} style={[styles.bubble, l.mine ? styles.mine : styles.theirs]}>
              {!l.mine && <Text style={styles.name}>{l.name}</Text>}
              <Text style={[styles.text, l.mine && { color: colors.bg }]}>{l.text}</Text>
            </View>
          )
        )}
      </ScrollView>

      {readOnlyHint ? (
        <Text style={styles.empty}>{readOnlyHint}</Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }}>
            {QUICK_PHRASES.map((q) => (
              <Pressable key={q} onPress={() => send(q)} style={({ pressed }) => [styles.quick, pressed && { backgroundColor: colors.border }]}>
                <Text style={styles.quickText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Escreva uma mensagem"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
              style={styles.input}
              onSubmitEditing={() => send(text)}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <Pressable
              onPress={() => send(text)}
              disabled={!text.trim()}
              accessibilityLabel="Enviar mensagem"
              style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}
            >
              <Icon name="next" size={20} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </Sheet>
  );
}

/** Bolinha com o número de mensagens não lidas (fica sobre o ícone). */
export function UnreadDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.dot} pointerEvents="none">
      <Text style={styles.dotText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const styles = {
  list: {
    height: 260,
    flexGrow: 0,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center' as const,
    marginVertical: 20,
  },
  system: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center' as const,
    marginVertical: 4,
  },
  bubble: {
    maxWidth: '82%' as const,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mine: {
    alignSelf: 'flex-end' as const,
    backgroundColor: colors.mint,
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: 'flex-start' as const,
    backgroundColor: colors.surfaceAlt,
    borderBottomLeftRadius: 4,
  },
  name: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: '800' as const,
    marginBottom: 2,
  },
  text: {
    color: colors.text,
    fontSize: 14,
  },
  quick: {
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  inputRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  sendBtn: {
    width: 48,
    borderRadius: 12,
    backgroundColor: colors.red,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dot: {
    position: 'absolute' as const,
    top: 2,
    right: '28%' as const,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.red,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dotText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900' as const,
  },
};
