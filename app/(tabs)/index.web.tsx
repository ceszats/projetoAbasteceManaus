import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { ScreenContainer } from '@/components/layout/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FuelTypeFilter } from '@/components/fuel/FuelTypeFilter';
import { useColors } from '@/hooks/theme/use-colors';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import {
  MANAUS_CENTER,
  type MapRadiusKm,
  getPriceCategory,
  getPriceCategoryColor,
  formatTimeAgo,
  isOutdated,
  FuelType,
  Station,
  filterStationsForMap,
} from '@/data/stations';

export default function MapScreenWeb() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [mapRadiusKm] = useState<MapRadiusKm>(10);

  const fuelType = state.selectedFuelType;
  const anchorLat = state.userLocation?.latitude ?? MANAUS_CENTER.latitude;
  const anchorLng = state.userLocation?.longitude ?? MANAUS_CENTER.longitude;
  const filteredStations = useMemo(
    () =>
      filterStationsForMap(
        state.stations,
        fuelType,
        { latitude: anchorLat, longitude: anchorLng },
        { searchQuery, radiusKm: mapRadiusKm },
      ),
    [state.stations, fuelType, anchorLat, anchorLng, searchQuery, mapRadiusKm],
  );

  const handleFuelSelect = useCallback((type: FuelType) => {
    dispatch({ type: 'SET_FUEL_TYPE', fuelType: type });
  }, [dispatch]);

  const handleViewDetail = useCallback((station: Station) => {
    router.push(`/station/${station.id}` as any);
  }, [router]);

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitle}>
          <Text style={[styles.appName, { color: colors.primary }]}>⛽ Abastece</Text>
          <Text style={[styles.appCity, { color: colors.foreground }]}>Manaus</Text>
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
        <FuelTypeFilter selected={fuelType} onSelect={handleFuelSelect} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.webMapPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 48 }}>🗺️</Text>
          <Text style={[styles.webMapText, { color: colors.foreground }]}>Mapa Interativo</Text>
          <Text style={[styles.webMapSub, { color: colors.muted }]}>
            Disponível no app mobile (iOS/Android)
          </Text>
        </View>

        <View style={[styles.legend, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.legendTitle, { color: colors.foreground }]}>Legenda de Preços</Text>
          <View style={styles.legendRow}>
            {(['cheap', 'medium', 'expensive'] as const).map((cat) => (
              <View key={cat} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: getPriceCategoryColor(cat) }]} />
                <Text style={[styles.legendLabel, { color: colors.muted }]}>
                  {cat === 'cheap' ? 'Barato' : cat === 'medium' ? 'Médio' : 'Caro'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {searchQuery.trim()
            ? `${filteredStations.length} posto${filteredStations.length !== 1 ? 's' : ''} encontrado${filteredStations.length !== 1 ? 's' : ''}`
            : 'Postos em Manaus'}
        </Text>

        {filteredStations.map((station) => {
          const price = station.prices?.find(p => p.type === fuelType);
          const cat = price ? getPriceCategory(price.price) : 'medium';
          const priceColor = getPriceCategoryColor(cat);
          const outdated = price ? isOutdated(price.updatedAt) : false;

          return (
            <Pressable
              key={station.id}
              onPress={() => handleViewDetail(station)}
              style={({ pressed }) => [
                styles.webCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.webCardDot, { backgroundColor: priceColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.webCardName, { color: colors.foreground }]}>{station.name}</Text>
                <Text style={[styles.webCardAddr, { color: colors.muted }]}>{station.neighborhood}</Text>
              </View>
              {price && (
                <View style={[styles.webCardPrice, { backgroundColor: priceColor + '20' }]}>
                  <Text style={[styles.webCardPriceText, { color: priceColor }]}>
                    R$ {price.price.toFixed(2)}
                  </Text>
                  <Text style={[styles.webCardTime, { color: colors.muted }]}>
                    {formatTimeAgo(price.updatedAt)}
                  </Text>
                  {outdated && (
                    <Text style={[styles.webCardOutdated, { color: colors.warning }]}>⚠️</Text>
                  )}
                </View>
              )}
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 0.5,
    paddingTop: 8,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  appCity: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
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
  webMapPlaceholder: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  webMapSub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  legend: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 18,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    lineHeight: 24,
  },
  webCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  webCardDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  webCardName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  webCardAddr: {
    fontSize: 12,
    lineHeight: 16,
  },
  webCardPrice: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 2,
    alignItems: 'flex-end',
  },
  webCardPriceText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  webCardTime: {
    fontSize: 10,
    lineHeight: 14,
  },
  webCardOutdated: {
    fontSize: 12,
    lineHeight: 16,
  },
});
