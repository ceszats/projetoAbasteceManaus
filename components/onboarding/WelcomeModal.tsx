import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/theme/use-theme';

type WelcomeModalProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function WelcomeModal({ visible, onDismiss }: WelcomeModalProps) {
  const { colors, tokens } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: tokens.radius.lg,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.emoji]}>⛽</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Bem-vindo ao Abastece Manaus</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            No mapa, escolha <Text style={{ fontWeight: '700', color: colors.foreground }}>Perto de mim</Text> ou{' '}
            <Text style={{ fontWeight: '700', color: colors.foreground }}>Todos em Manaus</Text>. Pins verdes mostram
            preço SEFAZ; pontos cinza são postos sem preço recente.
          </Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Começar a usar o aplicativo"
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.btnText}>Começar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 24,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
