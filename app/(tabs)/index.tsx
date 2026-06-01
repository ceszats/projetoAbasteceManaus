import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RouteModal } from '@/components/navigation/RouteModal';
import { useTheme } from '@/hooks/theme/use-theme';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import {
  MANAUS_CENTER,
  type MapRadiusKm,
  FuelType,
  Station,
  filterStationsForMap,
  FUEL_TYPE_LABELS,
  getPriceSource,
  getPriceSourceLabel,
  type PriceSource,
} from '@/data/stations';
import * as Haptics from 'expo-haptics';
import Map from '@/components/map';
import { MapScreenHeader } from '@/components/map/MapScreenHeader';
import { StationPreviewSheet } from '@/components/map/StationPreviewSheet';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildFuelRecommendations,
  estimateEconomyAgainstNearest,
  formatCurrency,
  getFuelPrice,
} from '@/lib/fuel-recommendations';
import type { MapRegion } from '@/lib/map-cluster';

const ONBOARDING_KEY = '@fuelmap_onboarding_seen';
type MapSourceFilter = 'all' | 'sefaz' | 'user' | 'reference';

const SOURCE_FILTERS: { key: MapSourceFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'sefaz', label: 'SEFAZ' },
  { key: 'user', label: 'Usuarios' },
  { key: 'reference', label: 'Referencia' },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { colors, tokens } = useTheme();
  const router = useRouter();
  const { state, dispatch, stationsSource, apiBaseUrl, reloadStations } = useApp();
  const mapRef = useRef<any>(null);
  const hasCenteredOnUser = useRef(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [routeStation, setRouteStation] = useState<Station | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sourceFilter, setSourceFilter] = useState<MapSourceFilter>('all');

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      if (!value) setShowWelcome(true);
    });
  }, []);

  const dismissWelcome = useCallback(() => {
    AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setShowWelcome(false);
  }, []);

  const fuelType = state.selectedFuelType;
  const mapRadiusKm = state.mapRadiusKm;
  const anchorLat = mapFocus?.latitude ?? state.userLocation?.latitude ?? MANAUS_CENTER.latitude;
  const anchorLng = mapFocus?.longitude ?? state.userLocation?.longitude ?? MANAUS_CENTER.longitude;
  const hasGps = !!state.userLocation;
  const usingMapFocus = !!mapFocus;

  const allMapStations = React.useMemo(
    () =>
      filterStationsForMap(
        state.stations,
        fuelType,
        { latitude: anchorLat, longitude: anchorLng },
        {
          viewMode: 'distance',
          searchQuery,
          radiusKm: mapRadiusKm,
          liveOnly: false,
        },
      ),
    [
      state.stations,
      fuelType,
      anchorLat,
      anchorLng,
      searchQuery,
      mapRadiusKm,
    ],
  );

  const mapStations = React.useMemo(() => {
    if (sourceFilter === 'all') return allMapStations;
    return allMapStations.filter((station) => {
      const source = getPriceSource(station.prices.find((price) => price.type === fuelType));
      return source === sourceFilter;
    });
  }, [allMapStations, fuelType, sourceFilter]);

  const visibleAreaStations = React.useMemo(() => {
    return [...mapStations]
      .sort((a, b) => {
        const priceA = a.prices.find((price) => price.type === fuelType);
        const priceB = b.prices.find((price) => price.type === fuelType);
        const sourceWeight = (source: PriceSource) => (
          source === 'sefaz' ? 0 : source === 'user' ? 1 : source === 'reference' ? 2 : 3
        );
        const sourceDiff = sourceWeight(getPriceSource(priceA)) - sourceWeight(getPriceSource(priceB));
        if (sourceDiff !== 0) return sourceDiff;
        return (a.distance ?? 999) - (b.distance ?? 999);
      })
      .slice(0, 5);
  }, [fuelType, mapStations]);

  const recommendations = React.useMemo(
    () => buildFuelRecommendations(mapStations, fuelType),
    [mapStations, fuelType],
  );

  const cheapestPrice = React.useMemo(() => {
    return recommendations.cheapest?.prices.find((price) => price.type === fuelType) ?? null;
  }, [recommendations.cheapest, fuelType]);

  const bestValuePrice = React.useMemo(
    () => recommendations.bestValue ? getFuelPrice(recommendations.bestValue, fuelType) : null,
    [recommendations.bestValue, fuelType],
  );

  const bestValueEconomy = React.useMemo(
    () => estimateEconomyAgainstNearest(recommendations.bestValue, recommendations.nearest, fuelType),
    [recommendations.bestValue, recommendations.nearest, fuelType],
  );

  const handleFuelSelect = useCallback((type: FuelType) => {
    dispatch({ type: 'SET_FUEL_TYPE', fuelType: type });
  }, [dispatch]);

  const handleRadiusKm = useCallback((km: MapRadiusKm) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_MAP_RADIUS_KM', radiusKm: km });
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadStations();
    } finally {
      setRefreshing(false);
    }
  }, [reloadStations]);

  const handleOpenList = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/list' as any);
  }, [router]);

  const handleMarkerPress = useCallback((station: Station) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStation(station);
  }, []);

  const handleCenterMap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMapFocus(null);
    const target = state.userLocation
      ? {
          latitude: state.userLocation.latitude,
          longitude: state.userLocation.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }
      : MANAUS_CENTER;
    mapRef.current?.animateToRegion(target, 800);
  }, [state.userLocation]);

  const handleMapRegionChange = useCallback((next: MapRegion) => {
    setMapFocus({
      latitude: next.latitude,
      longitude: next.longitude,
    });
  }, []);

  const handleMapAreaPress = useCallback((coordinate: { latitude: number; longitude: number }) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSelectedStation(null);
    setMapFocus(coordinate);
    mapRef.current?.animateToRegion({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    }, 450);
  }, []);

  const handleCheapestStation = useCallback(() => {
    if (!recommendations.cheapest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedStation(recommendations.cheapest);
    mapRef.current?.animateToRegion({
      latitude: recommendations.cheapest.latitude,
      longitude: recommendations.cheapest.longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    }, 700);
  }, [recommendations.cheapest]);

  const focusRecommendation = useCallback((station: Station | null) => {
    if (!station) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStation(station);
    mapRef.current?.animateToRegion({
      latitude: station.latitude,
      longitude: station.longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    }, 700);
  }, []);

  useEffect(() => {
    if (!state.userLocation || hasCenteredOnUser.current) return;
    const target = {
      latitude: state.userLocation.latitude,
      longitude: state.userLocation.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
    mapRef.current?.animateToRegion(target, 900);
    hasCenteredOnUser.current = true;
  }, [state.userLocation]);

  useEffect(() => {
    if (selectedStation && !mapStations.some((station) => station.id === selectedStation.id)) {
      setSelectedStation(null);
    }
  }, [mapStations, selectedStation]);

  useEffect(() => {
    if (!searchQuery.trim()) return;

    const firstStation = mapStations[0];
    if (!firstStation) return;

    mapRef.current?.animateToRegion({
      latitude: firstStation.latitude,
      longitude: firstStation.longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    }, 650);
  }, [mapStations, searchQuery]);

  const handleViewDetail = useCallback((station: Station) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRouteStation(null);
    router.push(`/station/${station.id}` as any);
  }, [router]);

  const handleReportPrice = useCallback((station: Station) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/report/${station.id}?fuelType=${fuelType}` as any);
  }, [fuelType, router]);

  return (
    <View style={styles.container}>
      <Map
        mapRef={mapRef}
        initialRegion={MANAUS_CENTER}
        stations={mapStations}
        fuelType={fuelType}
        onMarkerPress={handleMarkerPress}
        onMapPress={handleMapAreaPress}
        onRegionChangeComplete={handleMapRegionChange}
        userLocation={state.userLocation}
        enableClustering={mapStations.length >= 60}
      />

      <MapScreenHeader
        paddingTop={insets.top}
        colors={colors}
        fuelType={fuelType}
        onFuelSelect={handleFuelSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stationsSource={stationsSource}
        mapStationsCount={mapStations.length}
        mapRadiusKm={mapRadiusKm}
        hasGps={hasGps && !usingMapFocus}
        focusLabel={usingMapFocus ? 'nesta area do mapa' : undefined}
        apiBaseUrl={apiBaseUrl}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onRadiusKm={handleRadiusKm}
        onOpenList={handleOpenList}
        onReloadOffline={reloadStations}
      />

      {/* Center button */}
      <Pressable
        onPress={handleCenterMap}
        accessibilityRole="button"
        accessibilityLabel="Centralizar mapa na minha localização"
        style={({ pressed }) => [
          styles.centerBtn,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
            bottom: insets.bottom + (selectedStation ? 20 : 330),
          },
        ]}
      >
        <IconSymbol name="location.fill" size={22} color={colors.primary} />
      </Pressable>

      {/* Bottom sheet de prévia do posto */}
      {recommendations.cheapest ? (
        <Pressable
          onPress={handleCheapestStation}
          accessibilityRole="button"
          accessibilityLabel="Ir para o posto mais barato no mapa"
          style={({ pressed }) => [
            styles.cheapestBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
              bottom: insets.bottom + 276,
            },
          ]}
        >
          <IconSymbol name="fuelpump.fill" size={16} color="#fff" />
          <View>
            <Text style={styles.cheapestBtnText}>Melhor preco</Text>
            <Text style={styles.cheapestBtnSubText}>
              {cheapestPrice ? `R$ ${cheapestPrice.price.toFixed(2)} ${FUEL_TYPE_LABELS[fuelType]}` : 'sem preco'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {!selectedStation && recommendations.bestValue ? (
        <View
          style={[
            styles.mapSummary,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={styles.mapSummaryTop}>
            <View style={styles.mapSummaryTextBlock}>
              <Text style={[styles.mapSummaryEyebrow, { color: colors.secondary }]}>Melhor agora</Text>
              <Text style={[styles.mapSummaryTitle, { color: colors.foreground }]} numberOfLines={1}>
                {recommendations.bestValue.name}
              </Text>
              <Text style={[styles.mapSummaryMeta, { color: colors.muted }]} numberOfLines={1}>
                {bestValuePrice ? `${formatCurrency(bestValuePrice)} - ${recommendations.bestValue.distance?.toFixed(1) ?? '?'} km` : 'Sem preco'}
              </Text>
            </View>
            <Pressable
              onPress={() => setRouteStation(recommendations.bestValue)}
              accessibilityRole="button"
              accessibilityLabel="Tracar rota para melhor posto"
              style={({ pressed }) => [
                styles.mapSummaryRoute,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <IconSymbol name="car.fill" size={15} color="#fff" />
              <Text style={styles.mapSummaryRouteText}>Rota</Text>
            </Pressable>
          </View>

          {bestValueEconomy && bestValueEconomy.netSavings > 0 ? (
            <Text style={[styles.mapSummarySavings, { color: colors.success }]} numberOfLines={1}>
              Economiza aprox. {formatCurrency(bestValueEconomy.netSavings)} mesmo andando {bestValueEconomy.extraDistanceKm.toFixed(1)} km a mais.
            </Text>
          ) : null}

          <View style={styles.recommendationRow}>
            <Pressable
              onPress={() => focusRecommendation(recommendations.cheapest)}
              style={[styles.recommendationChip, { backgroundColor: colors.primary + '12' }]}
            >
              <Text style={[styles.recommendationText, { color: colors.primary }]}>Mais barato</Text>
            </Pressable>
            <Pressable
              onPress={() => focusRecommendation(recommendations.nearest)}
              style={[styles.recommendationChip, { backgroundColor: colors.secondary + '12' }]}
            >
              <Text style={[styles.recommendationText, { color: colors.secondary }]}>Mais perto</Text>
            </Pressable>
            <Pressable
              onPress={handleOpenList}
              style={[styles.recommendationChip, { backgroundColor: colors.muted + '12' }]}
            >
              <Text style={[styles.recommendationText, { color: colors.foreground }]}>Alternativas</Text>
            </Pressable>
          </View>

          <View style={styles.sourceFilterRow}>
            {SOURCE_FILTERS.map((item) => {
              const selected = sourceFilter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setSourceFilter(item.key)}
                  style={[
                    styles.sourceChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.sourceChipText, { color: selected ? '#fff' : colors.foreground }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {visibleAreaStations.length > 0 ? (
            <View style={styles.visibleList}>
              <Text style={[styles.visibleListTitle, { color: colors.muted }]}>Postos nesta area</Text>
              {visibleAreaStations.slice(0, 3).map((station) => {
                const price = station.prices.find((item) => item.type === fuelType);
                return (
                  <Pressable
                    key={station.id}
                    onPress={() => focusRecommendation(station)}
                    style={styles.visibleListRow}
                  >
                    <Text style={[styles.visibleListName, { color: colors.foreground }]} numberOfLines={1}>
                      {station.name}
                    </Text>
                    <Text style={[styles.visibleListMeta, { color: colors.muted }]} numberOfLines={1}>
                      {price ? `R$ ${price.price.toFixed(2)} - ${getPriceSourceLabel(price)}` : 'sem preco'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {selectedStation ? (
        <StationPreviewSheet
          station={selectedStation}
          fuelType={fuelType}
          isFavorite={state.favoriteIds.includes(selectedStation.id)}
          paddingBottom={insets.bottom}
          borderRadius={tokens.radius.lg}
          colors={colors}
          tokens={tokens}
          onClose={() => setSelectedStation(null)}
          onToggleFavorite={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            dispatch({ type: 'TOGGLE_FAVORITE', stationId: selectedStation.id });
          }}
          onDirections={() => setRouteStation(selectedStation)}
          onReportPrice={() => handleReportPrice(selectedStation)}
          onViewDetail={() => handleViewDetail(selectedStation)}
        />
      ) : null}

      <WelcomeModal visible={showWelcome} onDismiss={dismissWelcome} />

      {routeStation && (
        <RouteModal
          visible={!!routeStation}
          onClose={() => setRouteStation(null)}
          stationName={routeStation.name}
          stationBrand={routeStation.brand}
          destination={{ latitude: routeStation.latitude, longitude: routeStation.longitude }}
          userLocation={state.userLocation}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  cheapestBtn: {
    position: 'absolute',
    right: 16,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 5,
  },
  cheapestBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  cheapestBtnSubText: {
    color: '#FFFFFFD9',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  mapSummary: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  mapSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapSummaryTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  mapSummaryEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  mapSummaryTitle: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  mapSummaryMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  mapSummaryRoute: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mapSummaryRouteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  mapSummarySavings: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  recommendationRow: {
    flexDirection: 'row',
    gap: 7,
  },
  recommendationChip: {
    flex: 1,
    minHeight: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  recommendationText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  sourceFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sourceChip: {
    flex: 1,
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sourceChipText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
  visibleList: {
    gap: 4,
  },
  visibleListTitle: {
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  visibleListRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visibleListName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  visibleListMeta: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
});
