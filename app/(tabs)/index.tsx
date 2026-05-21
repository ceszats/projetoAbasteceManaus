import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/layout/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FuelTypeFilter } from '@/components/fuel/FuelTypeFilter';
import { useTheme } from '@/hooks/theme/use-theme';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import {
  MANAUS_CENTER,
  getPriceCategory,
  getPriceCategoryColor,
  formatTimeAgo,
  isOutdated,
  FuelType,
  Station,
  calculateDistance,
  stationMatchesSearch,
} from '@/data/stations';
import * as Haptics from 'expo-haptics';
import Map from '@/components/map';
import { Linking, Platform } from 'react-native';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { colors, tokens } = useTheme();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const mapRef = useRef<any>(null);
  const hasCenteredOnUser = useRef(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fuelType = state.selectedFuelType;
  const filteredStations = React.useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return state.stations;
    return state.stations.filter((station) => stationMatchesSearch(station, query));
  }, [searchQuery, state.stations]);
  const cheapestStation = React.useMemo(() => {
    return filteredStations
      .filter((station) => station.prices.some((price) => price.type === fuelType))
      .sort((a, b) => {
        const priceA = a.prices.find((price) => price.type === fuelType)?.price ?? 999;
        const priceB = b.prices.find((price) => price.type === fuelType)?.price ?? 999;
        return priceA - priceB;
      })[0] ?? null;
  }, [filteredStations, fuelType]);

  const handleFuelSelect = useCallback((type: FuelType) => {
    dispatch({ type: 'SET_FUEL_TYPE', fuelType: type });
  }, [dispatch]);

  const handleMarkerPress = useCallback((station: Station) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStation(station);
  }, []);

  const handleCenterMap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleCheapestStation = useCallback(() => {
    if (!cheapestStation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedStation(cheapestStation);
    mapRef.current?.animateToRegion({
      latitude: cheapestStation.latitude,
      longitude: cheapestStation.longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    }, 700);
  }, [cheapestStation]);

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
    if (!searchQuery.trim()) return;

    if (selectedStation && !filteredStations.some((station) => station.id === selectedStation.id)) {
      setSelectedStation(null);
    }

    const firstStation = filteredStations[0];
    if (!firstStation) return;

    mapRef.current?.animateToRegion({
      latitude: firstStation.latitude,
      longitude: firstStation.longitude,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    }, 650);
  }, [filteredStations, searchQuery, selectedStation]);

  const handleViewDetail = useCallback((station: Station) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/station/${station.id}` as any);
  }, [router]);

  // Native: mapa real
  return (
    <View style={styles.container}>
      <Map
        mapRef={mapRef}
        initialRegion={MANAUS_CENTER}
        stations={filteredStations}
        fuelType={fuelType}
        onMarkerPress={handleMarkerPress}
        userLocation={state.userLocation}
      />

      {/* Header overlay */}
      <View style={[styles.headerOverlay, { backgroundColor: colors.background + 'F8', paddingTop: insets.top + 4, borderBottomColor: colors.border, borderBottomWidth: 0.5 }]}>
        <View style={styles.headerTitle}>
          <Text style={[styles.appName, { color: colors.primary }]}>⛽ Abastece</Text>
          <View style={[styles.cityBadge, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.appCity, { color: colors.primary }]}>Manaus</Text>
          </View>
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={15} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar posto ou bairro no mapa"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        {searchQuery.trim() ? (
          <Text style={[styles.searchCount, { color: colors.muted }]}>
            {filteredStations.length} posto{filteredStations.length !== 1 ? 's' : ''} no mapa
          </Text>
        ) : null}
        <FuelTypeFilter selected={fuelType} onSelect={handleFuelSelect} />
      </View>

      {/* Legend */}
      <View style={[styles.legendOverlay, { backgroundColor: colors.background + 'EE', bottom: insets.bottom + 20 }]}>
        {(['cheap', 'medium', 'expensive'] as const).map(cat => (
          <View key={cat} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: getPriceCategoryColor(cat) }]} />
            <Text style={[styles.legendLabel, { color: colors.foreground }]}>
              {cat === 'cheap' ? 'Barato' : cat === 'medium' ? 'Médio' : 'Caro'}
            </Text>
          </View>
        ))}
      </View>

      {/* Center button */}
      <Pressable
        onPress={handleCenterMap}
        style={({ pressed }) => [
          styles.centerBtn,
          { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.8 : 1, bottom: insets.bottom + 20 },
        ]}
      >
        <IconSymbol name="location.fill" size={22} color={colors.primary} />
      </Pressable>

      {/* Bottom sheet de prévia do posto */}
      {cheapestStation ? (
        <Pressable
          onPress={handleCheapestStation}
          style={({ pressed }) => [
            styles.cheapestBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
              bottom: insets.bottom + 76,
            },
          ]}
        >
          <IconSymbol name="fuelpump.fill" size={16} color="#fff" />
          <Text style={styles.cheapestBtnText}>Mais barato</Text>
        </Pressable>
      ) : null}

      {selectedStation && (() => {
        const price = selectedStation.prices.find(p => p.type === fuelType);
        const cat = price ? getPriceCategory(price.price) : 'medium';
        const priceColor = getPriceCategoryColor(cat);
        const outdated = price ? isOutdated(price.updatedAt) : false;
        const isFav = state.favoriteIds.includes(selectedStation.id);

        const brandColors: Record<string, string> = {
          'Ipiranga': '#FF6B00', 'Shell': '#DD1D21', 'BR': '#009B3A',
          'Ale': '#0066CC', 'Bandeirante': '#6B21A8', 'Raízen': '#DD1D21',
        };
        const brandColor = brandColors[selectedStation.brand] ?? colors.primary;

        const handleDirections = () => {
          const url = Platform.OS === 'ios'
            ? `maps://app?daddr=${selectedStation.latitude},${selectedStation.longitude}`
            : `geo:${selectedStation.latitude},${selectedStation.longitude}?q=${encodeURIComponent(selectedStation.name)}`;
          Linking.openURL(url).catch(() =>
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selectedStation.latitude},${selectedStation.longitude}`)
          );
        };

        const handleToggleFav = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          dispatch({ type: 'TOGGLE_FAVORITE', stationId: selectedStation.id });
        };

        return (
          <TouchableWithoutFeedback>
            <View style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: insets.bottom + 10,
                borderRadius: tokens.radius.lg,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
                elevation: 12,
              },
            ]}>

              {/* Faixa da marca */}
              <View style={[styles.bsBrandStrip, { backgroundColor: brandColor }]} />

              {/* Handle row: [handle] [fav] [fechar] */}
              <View style={styles.bsTopRow}>
                <View style={[styles.bottomSheetHandle, { backgroundColor: colors.border }]} />

                {/* Botão favoritar */}
                <Pressable
                  onPress={handleToggleFav}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.bsIconBtn,
                    {
                      backgroundColor: isFav ? '#EF444415' : colors.background,
                      borderColor: isFav ? '#EF4444' : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <IconSymbol name="heart.fill" size={14} color={isFav ? '#EF4444' : colors.muted} />
                </Pressable>

                {/* Botão fechar */}
                <Pressable
                  hitSlop={12}
                  onPress={() => setSelectedStation(null)}
                  style={({ pressed }) => [
                    styles.bsIconBtn,
                    { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <IconSymbol name="xmark" size={12} color={colors.muted} />
                </Pressable>
              </View>

              {/* Corpo principal */}
              <View style={styles.bsBody}>
                {/* Linha de nome + favorito */}
                {/* Nome e endereço */}
                <View>
                  <Text style={[styles.bsName, { color: colors.foreground }]} numberOfLines={1}>
                    {selectedStation.name}
                  </Text>
                  <Text style={[styles.bsAddr, { color: colors.muted }]} numberOfLines={1}>
                    {selectedStation.brand} · {selectedStation.neighborhood}
                  </Text>
                </View>

                {/* Preço + chips em linha */}
                {price ? (
                  <View style={styles.bsPriceRow}>
                    <View style={[styles.bsPricePill, { backgroundColor: priceColor + '18' }]}>
                      <Text style={[styles.bsPriceMain, { color: priceColor }]}>
                        R$ {price.price.toFixed(2)}
                      </Text>
                      <Text style={[styles.bsPriceLabel, { color: priceColor + 'BB' }]}>/ L</Text>
                    </View>

                    <View style={styles.bsChips}>
                      {outdated ? (
                        <View style={[styles.bsMetaChip, { backgroundColor: colors.warning + '18' }]}>
                          <IconSymbol name="exclamationmark.triangle.fill" size={9} color={colors.warning} />
                          <Text style={[styles.bsMetaText, { color: colors.warning }]}>Desatualizado</Text>
                        </View>
                      ) : (
                        <View style={[styles.bsMetaChip, { backgroundColor: colors.success + '18' }]}>
                          <IconSymbol name="clock.fill" size={9} color={colors.success} />
                          <Text style={[styles.bsMetaText, { color: colors.success }]}>{formatTimeAgo(price.updatedAt)}</Text>
                        </View>
                      )}
                      <View style={[styles.bsMetaChip, { backgroundColor: colors.muted + '18' }]}>
                        <IconSymbol name="person.2.fill" size={9} color={colors.muted} />
                        <Text style={[styles.bsMetaText, { color: colors.muted }]}>{price.confirmations} confirm.</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.bsNoPriceChip, { backgroundColor: colors.muted + '15' }]}>
                    <Text style={[styles.bsMetaText, { color: colors.muted }]}>Sem preço cadastrado</Text>
                  </View>
                )}

                {/* Botões de ação */}
                <View style={styles.bsActions}>
                  <Pressable
                    onPress={handleDirections}
                    style={({ pressed }) => [
                      styles.bsBtnSecondary,
                      { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <IconSymbol name="car.fill" size={14} color={colors.primary} />
                    <Text style={[styles.bsBtnSecondaryText, { color: colors.primary }]}>Rotas</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleViewDetail(selectedStation)}
                    style={({ pressed }) => [
                      styles.bsBtnPrimary,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                        ...tokens.shadows.premium,
                      },
                    ]}
                  >
                    <Text style={styles.bsBtnText}>Ver detalhes</Text>
                    <IconSymbol name="chevron.right" size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  cityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  appName: {
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  appCity: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  searchBox: {
    minHeight: 40,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    padding: 0,
  },
  searchCount: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  // Map pins
  pin: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  pinText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  pinTextSmall: {
    fontSize: 14,
    lineHeight: 18,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },
  pinWarning: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Legend
  legendOverlay: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  // Center button
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
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 21,
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
    lineHeight: 18,
  },
  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  bsBrandStrip: {
    height: 5,
    width: '100%',
  },
  bsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
  },
  bottomSheetHandle: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  bsIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bsBody: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 10,
  },
  bsName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  bsAddr: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  bsPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bsChips: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  bsPricePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  bsPriceMain: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  bsPriceLabel: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },

  bsMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bsMetaText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  bsNoPriceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  bsActions: {
    flexDirection: 'row',
    gap: 10,
  },
  bsBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  bsBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  bsBtnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: 12,
  },
  bsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  // Web fallback
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    lineHeight: 24,
  },
});
