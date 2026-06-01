/**
 * RouteModal (Web) — sem react-native-maps; abre rota no Google Maps.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/theme/use-theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RoutePoint } from '@/hooks/navigation/use-route';

interface RouteModalProps {
  visible: boolean;
  onClose: () => void;
  stationName: string;
  stationBrand?: string;
  destination: RoutePoint;
  userLocation: RoutePoint | null;
}

export function RouteModal({
  visible,
  onClose,
  stationName,
  destination,
}: RouteModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
    Linking.openURL(url);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <IconSymbol name="xmark" size={18} color={colors.muted} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>{stationName}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Navegação in-app está disponível no Android e iOS. Na web, abra a rota no Google Maps.
        </Text>
        <Pressable
          onPress={openMaps}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <IconSymbol name="map.fill" size={18} color="#fff" />
          <Text style={styles.btnText}>Abrir no Google Maps</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
