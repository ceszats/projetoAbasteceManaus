/**
 * RouteModal.tsx
 *
 * Modal de navegação in-app — exibe a rota do usuário até o posto
 * usando react-native-maps (já instalado) + OSRM (API pública gratuita).
 *
 * Funciona em conjunto com o hook useRoute.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/theme/use-theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRoute, RoutePoint } from '@/hooks/navigation/use-route';

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
  userLocation,
}: RouteModalProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const { route, loading, error, refresh } = useRoute(userLocation, destination);

  // Ajusta o mapa para mostrar toda a rota quando ela carregar
  useEffect(() => {
    if (!route || !mapRef.current) return;
    const coords = route.polyline.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 32, bottom: 220, left: 32 },
      animated: true,
    });
  }, [route]);

  const handleOpenMaps = () => {
    const originParam = userLocation
      ? `&origin=${userLocation.latitude},${userLocation.longitude}`
      : '';
    const webUrl = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${destination.latitude},${destination.longitude}&dirflg=d`
      : webUrl;

    Linking.openURL(url).catch(() => {
      Linking.openURL(webUrl);
    });
  };

  // Região inicial centralizada entre usuário e destino
  const initialRegion = {
    latitude: userLocation
      ? (userLocation.latitude + destination.latitude) / 2
      : destination.latitude,
    longitude: userLocation
      ? (userLocation.longitude + destination.longitude) / 2
      : destination.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        {/* ── Cabeçalho ── */}
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconSymbol name="xmark" size={18} color={colors.muted} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {stationName}
            </Text>
            {route && (
              <Text style={[styles.headerSub, { color: colors.muted }]}>
                {route.distanceLabel} · {route.durationLabel}
              </Text>
            )}
          </View>

          <Pressable
            onPress={refresh}
            style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconSymbol name="arrow.clockwise" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {/* ── Mapa ── */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
          >
            {/* Marcador do posto */}
            <Marker
              coordinate={destination}
              title={stationName}
              pinColor={colors.primary}
            />

            {/* Polyline da rota */}
            {route && (
              <Polyline
                coordinates={route.polyline}
                strokeColor={colors.primary}
                strokeWidth={4}
                lineDashPattern={undefined}
              />
            )}
          </MapView>

          {/* Loading overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <View style={[styles.loadingCard, { backgroundColor: colors.surface, ...tokens.shadows.soft }]}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.loadingText, { color: colors.muted }]}>
                  Calculando rota...
                </Text>
              </View>
            </View>
          )}

          {/* Erro overlay */}
          {error && !loading && (
            <View style={styles.loadingOverlay}>
              <View style={[styles.loadingCard, { backgroundColor: colors.surface, ...tokens.shadows.soft }]}>
                <Text style={{ fontSize: 24 }}>⚠️</Text>
                <Text style={[styles.loadingText, { color: colors.muted }]}>
                  {userLocation ? error : 'Localização não disponível'}
                </Text>
                <Pressable onPress={refresh} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.retryBtnText}>Tentar novamente</Text>
                </Pressable>
                <Pressable onPress={handleOpenMaps} style={[styles.retryBtn, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.retryBtnText}>Abrir no Google Maps</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── Painel inferior ── */}
        <View style={[
          styles.bottomPanel,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + 16,
            ...tokens.shadows.soft,
          }
        ]}>
          {/* Informações de rota */}
          {route && (
            <View style={styles.routeInfo}>
              <View style={[styles.routeInfoItem, { borderRightColor: colors.border }]}>
                <Text style={[styles.routeInfoValue, { color: colors.foreground }]}>
                  {route.distanceLabel}
                </Text>
                <Text style={[styles.routeInfoLabel, { color: colors.muted }]}>Distância</Text>
              </View>
              <View style={styles.routeInfoItem}>
                <Text style={[styles.routeInfoValue, { color: colors.foreground }]}>
                  {route.durationLabel}
                </Text>
                <Text style={[styles.routeInfoLabel, { color: colors.muted }]}>Tempo estimado</Text>
              </View>
            </View>
          )}

          {/* Nota sobre serviço de mapas */}
          <Text style={[styles.osrmNote, { color: colors.muted }]}>
            {route ? 'Rota calculada via OpenStreetMap' : 'Use Google Maps quando a rota interna nao estiver disponivel.'}
          </Text>

          {/* Botão Abrir no Google Maps */}
          <Pressable
            onPress={handleOpenMaps}
            style={({ pressed }) => [
              styles.gmapsBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
                ...tokens.shadows.premium,
              }
            ]}
          >
            <IconSymbol name="map.fill" size={18} color="#fff" />
            <Text style={styles.gmapsBtnText}>Abrir no Google Maps</Text>
          </Pressable>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  headerSub: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  loadingCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    minWidth: 180,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPanel: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
  },
  routeInfo: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  routeInfoItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRightWidth: 0.5,
  },
  routeInfoValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  routeInfoLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  osrmNote: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  gmapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  gmapsBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
});

