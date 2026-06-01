import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/layout/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/hooks/theme/use-theme';
import { useApp } from '@/context/AppContext';
import {
  FUEL_TYPE_LABELS,
  FUEL_TYPE_ICONS,
  FuelType,
  Station,
  getPriceCategory,
  getPriceCategoryColor,
  calculateDistance,
  MANAUS_CENTER,
  stationMatchesSearch,
} from '@/data/stations';
import * as Haptics from 'expo-haptics';

const FUEL_TYPES: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];
const DEFAULT_TANK = 50; // litros

export default function CompareScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useApp();
  const [tankSize, setTankSize] = useState(DEFAULT_TANK);
  const [tankInput, setTankInput] = useState(String(DEFAULT_TANK));
  const [showPicker, setShowPicker] = useState<0 | 1 | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('gasolina');

  const comparatorIds = state.comparatorIds;

  const stationsWithDistance = useMemo(() =>
    state.stations.map(s => ({
      ...s,
      distance: calculateDistance(
        state.userLocation?.latitude ?? MANAUS_CENTER.latitude,
        state.userLocation?.longitude ?? MANAUS_CENTER.longitude,
        s.latitude,
        s.longitude
      ),
    })), [state.stations, state.userLocation]);

  const station1 = stationsWithDistance.find(s => s.id === comparatorIds[0]);
  const station2 = stationsWithDistance.find(s => s.id === comparatorIds[1]);

  const filteredStations = useMemo(() => {
    const matched = stationsWithDistance.filter(s => stationMatchesSearch(s, searchQuery));
    // Favoritos sempre primeiro
    return matched.sort((a, b) => {
      const aFav = state.favoriteIds.includes(a.id) ? 0 : 1;
      const bFav = state.favoriteIds.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [stationsWithDistance, searchQuery, state.favoriteIds]);

  const handleSelectStation = (station: Station) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newIds = [...comparatorIds];
    if (showPicker === 0) newIds[0] = station.id;
    else if (showPicker === 1) newIds[1] = station.id;
    dispatch({ type: 'SET_COMPARATOR_IDS', ids: newIds });
    setShowPicker(null);
    setSearchQuery('');
  };

  const handleTankChange = (v: string) => {
    setTankInput(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0 && n <= 200) setTankSize(n);
  };

  const getPrice = (station: Station | undefined, fuel: FuelType) =>
    station?.prices.find(p => p.type === fuel)?.price;

  const getAvgRating = (station: Station | undefined) => {
    if (!station || station.reviews.length === 0) return null;
    return station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length;
  };

  const renderStationSelector = (index: 0 | 1, station: Station | undefined) => (
    <Pressable
      onPress={() => { setShowPicker(index); setSearchQuery(''); }}
      style={({ pressed }) => [
        styles.selectorCard,
        {
          backgroundColor: station ? colors.surface : colors.background,
          borderColor: station ? colors.primary : colors.border,
          borderStyle: station ? 'solid' : 'dashed',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {station ? (
        <View style={styles.selectorContent}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.selectorName, { color: colors.foreground }]} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={[styles.selectorAddr, { color: colors.muted }]} numberOfLines={1}>
              {station.neighborhood} · {station.distance?.toFixed(1)}km
            </Text>
          </View>
          <IconSymbol name="pencil" size={14} color={colors.muted} />
        </View>
      ) : (
        <View style={styles.selectorEmpty}>
          <IconSymbol name="plus.circle.fill" size={28} color={colors.primary} />
          <Text style={[styles.selectorEmptyText, { color: colors.muted }]}>
            Selecionar Posto {index + 1}
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <ScreenContainer containerClassName="bg-background" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Comparar</Text>
        <Text style={[styles.headerSub, { color: colors.muted }]}>Postos lado a lado</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {/* Selectors */}
        <View style={styles.selectorsRow}>
          {renderStationSelector(0, station1)}
          <View style={[styles.vsCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          {renderStationSelector(1, station2)}
        </View>

        {/* Fuel type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fuelRow}>
          {FUEL_TYPES.map(type => {
            const isSelected = type === selectedFuel;
            return (
              <Pressable
                key={type}
                onPress={() => setSelectedFuel(type)}
                style={({ pressed }) => [
                  styles.fuelChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{FUEL_TYPE_ICONS[type]}</Text>
                <Text style={[styles.fuelChipText, { color: isSelected ? '#fff' : colors.foreground }]}>
                  {FUEL_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Comparison table */}
        {station1 && station2 ? (
          <>
            {/* Tank size */}
            <View style={[styles.tankRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.tankLabel, { color: colors.foreground }]}>Capacidade do tanque:</Text>
              <View style={[styles.tankInput, { borderColor: colors.border }]}>
                <TextInput
                  style={[styles.tankInputText, { color: colors.foreground }]}
                  value={tankInput}
                  onChangeText={handleTankChange}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
                <Text style={[styles.tankUnit, { color: colors.muted }]}>L</Text>
              </View>
            </View>

            {/* Price comparison */}
            <View style={[styles.compCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.compCardTitle, { color: colors.foreground }]}>Preços — {FUEL_TYPE_LABELS[selectedFuel]}</Text>

              {(() => {
                const p1 = getPrice(station1, selectedFuel);
                const p2 = getPrice(station2, selectedFuel);

                if (!p1 && !p2) {
                  return (
                    <Text style={[styles.noData, { color: colors.muted }]}>
                      Nenhum dos postos tem preço cadastrado para {FUEL_TYPE_LABELS[selectedFuel]}
                    </Text>
                  );
                }

                const cheaper = p1 && p2 ? (p1 < p2 ? 1 : p1 > p2 ? 2 : 0) : 0;
                const diff = p1 && p2 ? Math.abs(p1 - p2) : 0;
                const savings = diff * tankSize;

                return (
                  <>
                    <View style={styles.priceCompRow}>
                      {/* Station 1 */}
                      <View style={[
                        styles.priceCompBlock,
                        cheaper === 1 && { borderColor: colors.success, borderWidth: 2 },
                        { backgroundColor: colors.background, borderColor: cheaper === 1 ? colors.success : colors.border },
                      ]}>
                        <Text style={[styles.priceCompName, { color: colors.muted }]} numberOfLines={1}>
                          {station1.name.split(' ').slice(0, 2).join(' ')}
                        </Text>
                        {p1 ? (
                          <>
                            <Text style={[styles.priceCompValue, { color: getPriceCategoryColor(getPriceCategory(p1)) }]}>
                              R$ {p1.toFixed(2)}
                            </Text>
                            {cheaper === 1 && (
                              <View style={[styles.cheaperBadge, { backgroundColor: colors.success }]}>
                                <Text style={styles.cheaperText}>Mais barato</Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <Text style={[styles.noDataSmall, { color: colors.muted }]}>Sem preço</Text>
                        )}
                      </View>

                      {/* Station 2 */}
                      <View style={[
                        styles.priceCompBlock,
                        cheaper === 2 && { borderWidth: 2 },
                        { backgroundColor: colors.background, borderColor: cheaper === 2 ? colors.success : colors.border },
                      ]}>
                        <Text style={[styles.priceCompName, { color: colors.muted }]} numberOfLines={1}>
                          {station2.name.split(' ').slice(0, 2).join(' ')}
                        </Text>
                        {p2 ? (
                          <>
                            <Text style={[styles.priceCompValue, { color: getPriceCategoryColor(getPriceCategory(p2)) }]}>
                              R$ {p2.toFixed(2)}
                            </Text>
                            {cheaper === 2 && (
                              <View style={[styles.cheaperBadge, { backgroundColor: colors.success }]}>
                                <Text style={styles.cheaperText}>Mais barato</Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <Text style={[styles.noDataSmall, { color: colors.muted }]}>Sem preço</Text>
                        )}
                      </View>
                    </View>

                    {p1 && p2 && diff > 0 && (
                      <View style={[styles.savingsBox, { backgroundColor: colors.success + '15', borderColor: colors.success + '40' }]}>
                        <Text style={{ fontSize: 20 }}>💰</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.savingsTitle, { color: colors.foreground }]}>
                            Economia de R$ {diff.toFixed(2)}/litro
                          </Text>
                          <Text style={[styles.savingsSub, { color: colors.muted }]}>
                            Para um tanque de {tankSize}L: economize R$ {savings.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>

            {/* Distance comparison */}
            <View style={[styles.compCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.compCardTitle, { color: colors.foreground }]}>Distância</Text>
              <View style={styles.priceCompRow}>
                <View style={[styles.priceCompBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.priceCompName, { color: colors.muted }]} numberOfLines={1}>
                    {station1.name.split(' ').slice(0, 2).join(' ')}
                  </Text>
                  <Text style={[styles.priceCompValue, { color: colors.foreground }]}>
                    {station1.distance! < 1 ? `${Math.round(station1.distance! * 1000)}m` : `${station1.distance!.toFixed(1)}km`}
                  </Text>
                </View>
                <View style={[styles.priceCompBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.priceCompName, { color: colors.muted }]} numberOfLines={1}>
                    {station2.name.split(' ').slice(0, 2).join(' ')}
                  </Text>
                  <Text style={[styles.priceCompValue, { color: colors.foreground }]}>
                    {station2.distance! < 1 ? `${Math.round(station2.distance! * 1000)}m` : `${station2.distance!.toFixed(1)}km`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Rating comparison */}
            <View style={[styles.compCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.compCardTitle, { color: colors.foreground }]}>Avaliação</Text>
              <View style={styles.priceCompRow}>
                {[station1, station2].map((s, i) => {
                  const avg = getAvgRating(s);
                  return (
                    <View key={i} style={[styles.priceCompBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.priceCompName, { color: colors.muted }]} numberOfLines={1}>
                        {s!.name.split(' ').slice(0, 2).join(' ')}
                      </Text>
                      {avg !== null ? (
                        <View style={{ alignItems: 'center', gap: 4 }}>
                          <Text style={[styles.priceCompValue, { color: colors.warning }]}>
                            ⭐ {avg.toFixed(1)}
                          </Text>
                          <Text style={[styles.noDataSmall, { color: colors.muted }]}>
                            {s!.reviews.length} avaliações
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.noDataSmall, { color: colors.muted }]}>Sem avaliações</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 48 }}>⚖️</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Compare dois postos</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              Selecione dois postos acima para ver a comparação de preços, distância e avaliações.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Station picker modal */}
      <Modal
        visible={showPicker !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
                Selecionar Posto {showPicker !== null ? showPicker + 1 : ''}
              </Text>
              <Pressable onPress={() => setShowPicker(null)}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <View style={[styles.pickerSearch, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
              <TextInput
                style={[styles.pickerSearchInput, { color: colors.foreground }]}
                placeholder="Buscar posto..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredStations}
              keyExtractor={s => s.id}
              renderItem={({ item }) => {
                const isFav = state.favoriteIds.includes(item.id);
                const isAlreadySelected =
                  (showPicker === 0 && item.id === comparatorIds[1]) ||
                  (showPicker === 1 && item.id === comparatorIds[0]);
                return (
                  <Pressable
                    onPress={() => !isAlreadySelected && handleSelectStation(item)}
                    style={({ pressed }) => [
                      styles.pickerItem,
                      {
                        borderBottomColor: colors.border,
                        opacity: isAlreadySelected ? 0.4 : pressed ? 0.8 : 1,
                        backgroundColor: isFav ? colors.primary + '08' : 'transparent',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.pickerItemNameRow}>
                        <Text style={[styles.pickerItemName, { color: colors.foreground }]}>{item.name}</Text>
                        {isFav && (
                          <View style={[styles.favBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.favBadgeText, { color: colors.primary }]}>⭐ Favorito</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.pickerItemAddr, { color: colors.muted }]}>
                        {item.neighborhood} · {item.distance?.toFixed(1)}km
                        {isAlreadySelected ? ' · já selecionado' : ''}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  headerSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  selectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    minHeight: 72,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorName: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  selectorAddr: {
    fontSize: 11,
    lineHeight: 15,
  },
  selectorEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
  },
  selectorEmptyText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  vsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  fuelRow: {
    gap: 8,
    paddingVertical: 4,
  },
  fuelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  fuelChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  tankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tankLabel: {
    fontSize: 14,
    lineHeight: 19,
  },
  tankInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  tankInputText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    minWidth: 40,
    textAlign: 'center',
    padding: 0,
  },
  tankUnit: {
    fontSize: 14,
    lineHeight: 19,
  },
  compCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  compCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  priceCompRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priceCompBlock: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  priceCompName: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  priceCompValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  cheaperBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cheaperText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  noData: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  noDataSmall: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  savingsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  savingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  savingsSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
  },
  emptySub: {
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
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '80%',
    paddingTop: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  pickerItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pickerItemName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  favBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  favBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  pickerItemAddr: {
    fontSize: 12,
    lineHeight: 17,
  },
});
