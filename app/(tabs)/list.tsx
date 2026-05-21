import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/layout/screen-container';
import { StationCard } from '@/components/fuel/StationCard';
import { FuelTypeFilter } from '@/components/fuel/FuelTypeFilter';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/hooks/theme/use-theme';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import {
  MANAUS_CENTER,
  calculateDistance,
  getPriceCategory,
  getPriceCategoryColor,
  getPriceConfidence,
  FuelType,
  Station,
  stationMatchesSearch,
} from '@/data/stations';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type SortOption = 'price' | 'distance' | 'rating';

const SORT_LABELS: Record<SortOption, string> = {
  price: 'Mais barato',
  distance: 'Mais próximo',
  rating: 'Melhor avaliado',
};

const DISTANCE_OPTIONS = [2, 5, 10, 20, 50];
const NEIGHBORHOOD_CHIP_LIMIT = 12;
const BRAND_CHIP_LIMIT = 8;

export default function ListScreen() {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAllStations, setShowAllStations] = useState(true);
  const [showConfirmedOnly, setShowConfirmedOnly] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const fuelType = state.selectedFuelType;
  const sortBy = state.sortBy;
  const maxDistance = state.maxDistance;

  // Referência de localização (centro de Manaus como padrão)
  const userLat = state.userLocation?.latitude ?? MANAUS_CENTER.latitude;
  const userLon = state.userLocation?.longitude ?? MANAUS_CENTER.longitude;

  const stationsWithDistance = useMemo(() => {
    return state.stations.map(s => ({
      ...s,
      distance: calculateDistance(userLat, userLon, s.latitude, s.longitude),
      isFavorite: state.favoriteIds.includes(s.id),
    }));
  }, [state.stations, userLat, userLon, state.favoriteIds]);

  const neighborhoodChips = useMemo(() => {
    const counts = stationsWithDistance.reduce<Record<string, number>>((acc, station) => {
      acc[station.neighborhood] = (acc[station.neighborhood] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB))
      .slice(0, NEIGHBORHOOD_CHIP_LIMIT)
      .map(([name]) => name);
  }, [stationsWithDistance]);

  const brandChips = useMemo(() => {
    const counts = stationsWithDistance.reduce<Record<string, number>>((acc, station) => {
      acc[station.brand] = (acc[station.brand] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB))
      .slice(0, BRAND_CHIP_LIMIT)
      .map(([name]) => name);
  }, [stationsWithDistance]);

  const selectedNeighborhood = useMemo(() => {
    const query = searchQuery.trim();
    return neighborhoodChips.find((neighborhood) => neighborhood === query) ?? null;
  }, [neighborhoodChips, searchQuery]);

  const neighborhoodSummary = useMemo(() => {
    if (!selectedNeighborhood) return null;

    const neighborhoodStations = stationsWithDistance.filter((station) => {
      const matchesNeighborhood = station.neighborhood === selectedNeighborhood;
      const matchesBrand = !selectedBrand || station.brand === selectedBrand;
      return matchesNeighborhood && matchesBrand && station.prices.some((p) => p.type === fuelType);
    });
    const prices = neighborhoodStations
      .map((station) => station.prices.find((p) => p.type === fuelType)?.price)
      .filter((price): price is number => typeof price === 'number');

    if (prices.length === 0) {
      return { stationCount: neighborhoodStations.length, minPrice: null, averagePrice: null };
    }

    return {
      stationCount: neighborhoodStations.length,
      minPrice: Math.min(...prices),
      averagePrice: prices.reduce((total, price) => total + price, 0) / prices.length,
    };
  }, [fuelType, selectedBrand, selectedNeighborhood, stationsWithDistance]);

  const filtered = useMemo(() => {
    let list = stationsWithDistance;
    const hasSearch = searchQuery.trim().length > 0;

    // Filtro de busca
    if (hasSearch) {
      list = list.filter(s => stationMatchesSearch(s, searchQuery));
    }

    if (selectedBrand) {
      list = list.filter(s => s.brand === selectedBrand);
    }

    if (!showAllStations && !hasSearch) {
      // Filtro de distância
      list = list.filter(s => (s.distance ?? 999) <= maxDistance);

      // Filtro: apenas postos que têm o combustível selecionado
      list = list.filter(s => s.prices.some(p => p.type === fuelType));

      if (showConfirmedOnly) {
        list = list.filter((s) => {
          const selectedPrice = s.prices.find((p) => p.type === fuelType);
          return !!selectedPrice && getPriceConfidence(selectedPrice) === 'confirmed';
        });
      }
    }

    // Ordenação
    list = [...list].sort((a, b) => {
      if (sortBy === 'price') {
        const pa = a.prices.find(p => p.type === fuelType)?.price ?? 999;
        const pb = b.prices.find(p => p.type === fuelType)?.price ?? 999;
        return pa - pb;
      }
      if (sortBy === 'distance') {
        return (a.distance ?? 999) - (b.distance ?? 999);
      }
      if (sortBy === 'rating') {
        const ra = a.reviews.length > 0 ? a.reviews.reduce((s, r) => s + r.rating, 0) / a.reviews.length : 0;
        const rb = b.reviews.length > 0 ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length : 0;
        return rb - ra;
      }
      return 0;
    });

    return list;
  }, [stationsWithDistance, searchQuery, selectedBrand, maxDistance, fuelType, sortBy, showAllStations, showConfirmedOnly]);

  const cheapestStations = useMemo(() => {
    return filtered
      .filter((station) => station.prices.some((price) => price.type === fuelType))
      .sort((a, b) => {
        const priceA = a.prices.find((price) => price.type === fuelType)?.price ?? 999;
        const priceB = b.prices.find((price) => price.type === fuelType)?.price ?? 999;
        return priceA - priceB;
      })
      .slice(0, 5);
  }, [filtered, fuelType]);

  const handleSortChange = useCallback((sort: SortOption) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_SORT', sortBy: sort });
  }, [dispatch]);

  const handleDistanceChange = useCallback((dist: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_MAX_DISTANCE', distance: dist });
  }, [dispatch]);

  const handleNeighborhoodPress = useCallback((neighborhood: string | null) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSearchQuery((current) => current === neighborhood || neighborhood === null ? '' : neighborhood);
  }, []);

  const handleBrandPress = useCallback((brand: string | null) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSelectedBrand((current) => current === brand || brand === null ? null : brand);
  }, []);

  const renderItem = useCallback(({ item }: { item: Station & { distance?: number } }) => (
    <StationCard station={item} fuelType={fuelType} showDistance />
  ), [fuelType]);

  const keyExtractor = useCallback((item: Station) => item.id, []);

  const ListHeader = (
    <View>
      {/* Filtro de combustível */}
      <FuelTypeFilter selected={fuelType} onSelect={(t) => dispatch({ type: 'SET_FUEL_TYPE', fuelType: t })} />

      {/* Barra de busca + filtros */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { 
          backgroundColor: colors.surface, 
          borderRadius: tokens.radius.sm,
          ...tokens.shadows.soft 
        }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar posto, bairro..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setShowFilters(true)}
          style={({ pressed }) => [
            styles.filterBtn,
            { 
              backgroundColor: colors.surface, 
              opacity: pressed ? 0.8 : 1,
              borderRadius: tokens.radius.sm,
              ...tokens.shadows.soft 
            },
          ]}
        >
          <IconSymbol name="slider.horizontal.3" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* Bairro chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.neighborhoodRow}
      >
        <Pressable
          onPress={() => handleNeighborhoodPress(null)}
          style={({ pressed }) => [
            styles.neighborhoodChip,
            {
              backgroundColor: searchQuery.trim() ? colors.surface : colors.primary,
              borderColor: searchQuery.trim() ? colors.border : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[
            styles.neighborhoodChipText,
            { color: searchQuery.trim() ? colors.foreground : '#fff' },
          ]}>
            Todos
          </Text>
        </Pressable>
        {neighborhoodChips.map((neighborhood) => {
          const selected = searchQuery === neighborhood;
          return (
            <Pressable
              key={neighborhood}
              onPress={() => handleNeighborhoodPress(neighborhood)}
              style={({ pressed }) => [
                styles.neighborhoodChip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[
                styles.neighborhoodChipText,
                { color: selected ? '#fff' : colors.foreground },
              ]}>
                {neighborhood}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Marca chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.brandRow}
      >
        <Pressable
          onPress={() => handleBrandPress(null)}
          style={({ pressed }) => [
            styles.brandChip,
            {
              backgroundColor: selectedBrand ? colors.surface : colors.primary,
              borderColor: selectedBrand ? colors.border : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[
            styles.brandChipText,
            { color: selectedBrand ? colors.foreground : '#fff' },
          ]}>
            Todas as marcas
          </Text>
        </Pressable>
        {brandChips.map((brand) => {
          const selected = selectedBrand === brand;
          return (
            <Pressable
              key={brand}
              onPress={() => handleBrandPress(brand)}
              style={({ pressed }) => [
                styles.brandChip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[
                styles.brandChipText,
                { color: selected ? '#fff' : colors.foreground },
              ]}>
                {brand}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedNeighborhood && neighborhoodSummary ? (
        <View style={[styles.neighborhoodSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryMain}>
            <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{selectedNeighborhood}</Text>
            <Text style={[styles.summaryMeta, { color: colors.muted }]}>
              {neighborhoodSummary.stationCount} posto{neighborhoodSummary.stationCount !== 1 ? 's' : ''}
              {selectedBrand ? ` · ${selectedBrand}` : ''}
            </Text>
          </View>
          <View style={styles.summaryPrices}>
            <Text style={[styles.summaryPriceLabel, { color: colors.muted }]}>Menor</Text>
            <Text style={[styles.summaryPriceValue, { color: colors.success }]}>
              {neighborhoodSummary.minPrice ? `R$ ${neighborhoodSummary.minPrice.toFixed(2)}` : '-'}
            </Text>
          </View>
          <View style={styles.summaryPrices}>
            <Text style={[styles.summaryPriceLabel, { color: colors.muted }]}>Média</Text>
            <Text style={[styles.summaryPriceValue, { color: colors.primary }]}>
              {neighborhoodSummary.averagePrice ? `R$ ${neighborhoodSummary.averagePrice.toFixed(2)}` : '-'}
            </Text>
          </View>
        </View>
      ) : null}

      {cheapestStations.length > 0 ? (
        <View style={styles.topDealsSection}>
          <View style={styles.topDealsHeader}>
            <Text style={[styles.topDealsTitle, { color: colors.foreground }]}>Top 5 mais baratos agora</Text>
            <Text style={[styles.topDealsSubtitle, { color: colors.muted }]}>
              {fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topDealsRow}
          >
            {cheapestStations.map((station, index) => {
              const price = station.prices.find((p) => p.type === fuelType);
              if (!price) return null;
              const priceColor = getPriceCategoryColor(getPriceCategory(price.price));

              return (
                <Pressable
                  key={station.id}
                  onPress={() => router.push(`/station/${station.id}` as any)}
                  style={({ pressed }) => [
                    styles.topDealCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <View style={[styles.topDealRank, { backgroundColor: colors.primary + '16' }]}>
                    <Text style={[styles.topDealRankText, { color: colors.primary }]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.topDealName, { color: colors.foreground }]} numberOfLines={1}>
                    {station.name}
                  </Text>
                  <Text style={[styles.topDealMeta, { color: colors.muted }]} numberOfLines={1}>
                    {station.neighborhood}
                  </Text>
                  <Text style={[styles.topDealPrice, { color: priceColor }]}>R$ {price.price.toFixed(2)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Sort chips */}
      <View style={styles.sortRow}>
        {(Object.keys(SORT_LABELS) as SortOption[]).map(sort => (
          <Pressable
            key={sort}
            onPress={() => handleSortChange(sort)}
            style={({ pressed }) => [
              styles.sortChip,
              {
                backgroundColor: sortBy === sort ? colors.primary : colors.surface,
                opacity: pressed ? 0.8 : 1,
                ...(sortBy === sort ? tokens.shadows.premium : tokens.shadows.soft),
              },
            ]}
          >
            <Text style={[styles.sortChipText, { color: sortBy === sort ? '#fff' : colors.muted }]}>
              {SORT_LABELS[sort]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Resultado count */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: colors.muted }]}>
          {filtered.length} posto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </Text>
        <Text style={[styles.countText, { color: colors.muted }]}>
          {showAllStations ? 'Raio: todos os postos' : `Raio: ${maxDistance}km`}
        </Text>
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <Text style={{ fontSize: 48 }}>🔍</Text>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum posto encontrado</Text>
      <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
        Tente aumentar o raio de busca ou alterar os filtros
      </Text>
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-background" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[
        styles.header,
        {
          backgroundColor: colors.background,
          ...tokens.shadows.soft,
        }
      ]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Postos</Text>
        <Text style={[styles.headerSub, { color: colors.muted }]}>Manaus, AM</Text>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        initialNumToRender={8}
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <Pressable style={[styles.filterSheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Filtros</Text>

            <Text style={[styles.sheetSectionTitle, { color: colors.muted }]}>RAIO DE BUSCA</Text>
            <Pressable
              onPress={() => setShowAllStations((prev) => !prev)}
              style={({ pressed }) => [
                styles.sortOption,
                {
                  backgroundColor: showAllStations ? colors.primary + '15' : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.sortOptionText, { color: showAllStations ? colors.primary : colors.foreground }]}>
                Mostrar todos os postos (ignorar preço e distância)
              </Text>
              {showAllStations && (
                <IconSymbol name="checkmark" size={16} color={colors.primary} />
              )}
            </Pressable>
            <View style={styles.distanceRow}>
              {DISTANCE_OPTIONS.map(dist => (
                <Pressable
                  key={dist}
                  onPress={() => handleDistanceChange(dist)}
                  style={({ pressed }) => [
                    styles.distanceChip,
                    {
                      backgroundColor: !showAllStations && maxDistance === dist ? colors.primary : colors.surface,
                      borderColor: !showAllStations && maxDistance === dist ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.distanceText, { color: !showAllStations && maxDistance === dist ? '#fff' : colors.foreground }]}>
                    {dist}km
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sheetSectionTitle, { color: colors.muted }]}>QUALIDADE DO PRECO</Text>
            <Pressable
              onPress={() => setShowConfirmedOnly((prev) => !prev)}
              style={({ pressed }) => [
                styles.sortOption,
                {
                  backgroundColor: showConfirmedOnly ? colors.primary + '15' : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.sortOptionText, { color: showConfirmedOnly ? colors.primary : colors.foreground }]}>
                Mostrar somente preços confirmados
              </Text>
              {showConfirmedOnly && (
                <IconSymbol name="checkmark" size={16} color={colors.primary} />
              )}
            </Pressable>

            <Text style={[styles.sheetSectionTitle, { color: colors.muted }]}>ORDENAR POR</Text>
            {(Object.keys(SORT_LABELS) as SortOption[]).map(sort => (
              <Pressable
                key={sort}
                onPress={() => { handleSortChange(sort); setShowFilters(false); }}
                style={({ pressed }) => [
                  styles.sortOption,
                  {
                    backgroundColor: sortBy === sort ? colors.primary + '15' : 'transparent',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.sortOptionText, { color: sortBy === sort ? colors.primary : colors.foreground }]}>
                  {SORT_LABELS[sort]}
                </Text>
                {sortBy === sort && (
                  <IconSymbol name="checkmark" size={16} color={colors.primary} />
                )}
              </Pressable>
            ))}

            <Pressable
              onPress={() => setShowFilters(false)}
              style={({ pressed }) => [
                styles.applyBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.applyBtnText}>Aplicar Filtros</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
  },
  filterBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  neighborhoodChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  neighborhoodChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  brandRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  brandChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  brandChipText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  neighborhoodSummary: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryMain: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  summaryMeta: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  summaryPrices: {
    alignItems: 'flex-end',
  },
  summaryPriceLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  summaryPriceValue: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  topDealsSection: {
    paddingBottom: 10,
  },
  topDealsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  topDealsTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  topDealsSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  topDealsRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  topDealCard: {
    width: 142,
    minHeight: 118,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 5,
  },
  topDealRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topDealRankText: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  topDealName: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  topDealMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  topDealPrice: {
    marginTop: 'auto',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  sortChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 8,
  },
  countText: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#1F30A0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 4,
  },
  sheetSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    lineHeight: 16,
    marginTop: 4,
  },
  distanceRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  distanceChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  sortOptionText: {
    fontSize: 15,
    lineHeight: 20,
  },
  applyBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
});
