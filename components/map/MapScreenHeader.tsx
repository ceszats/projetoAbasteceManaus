import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FuelTypeFilter } from '@/components/fuel/FuelTypeFilter';
import {
  FuelType,
  MAP_RADIUS_OPTIONS_KM,
  type MapRadiusKm,
} from '@/data/stations';
import type { StationsSource } from '@/context/AppContext';

export type MapScreenHeaderProps = {
  paddingTop: number;
  colors: ReturnType<typeof import('@/hooks/theme/use-theme').useTheme>['colors'];
  fuelType: FuelType;
  onFuelSelect: (type: FuelType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  stationsSource: StationsSource;
  mapStationsCount: number;
  mapRadiusKm: MapRadiusKm;
  hasGps: boolean;
  focusLabel?: string;
  apiBaseUrl: string;
  refreshing: boolean;
  onRefresh: () => void;
  onRadiusKm: (km: MapRadiusKm) => void;
  onOpenList: () => void;
  onReloadOffline: () => void;
};

export function MapScreenHeader({
  paddingTop,
  colors,
  fuelType,
  onFuelSelect,
  searchQuery,
  onSearchChange,
  stationsSource,
  mapStationsCount,
  mapRadiusKm,
  hasGps,
  focusLabel,
  apiBaseUrl,
  refreshing,
  onRefresh,
  onRadiusKm,
  onOpenList,
  onReloadOffline,
}: MapScreenHeaderProps) {
  const locationLabel = focusLabel ?? (hasGps ? 'perto de voce' : 'a partir do Centro');
  const sourceLabel = stationsSource === 'api'
    ? 'SEFAZ online'
    : stationsSource === 'cache'
      ? 'cache local'
      : stationsSource === 'offline'
        ? 'modo offline'
        : 'sincronizando';
  const countLabel = stationsSource === 'loading'
    ? 'Carregando postos...'
    : `${mapStationsCount} postos proximos (${locationLabel})`;

  return (
    <View
      style={[
        styles.headerOverlay,
        {
          backgroundColor: colors.background + 'F8',
          paddingTop: paddingTop + 4,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerTitle}>
        <View style={styles.titleBlock}>
          <Text style={[styles.appName, { color: colors.foreground }]}>Abastece Manaus</Text>
          <View style={styles.titleMetaRow}>
            <View style={[styles.cityBadge, { backgroundColor: colors.primary + '14' }]}>
              <IconSymbol name="leaf.fill" size={10} color={colors.primary} />
              <Text style={[styles.appCity, { color: colors.primary }]}>Amazonas</Text>
            </View>
            <View style={[styles.sourceBadge, { backgroundColor: colors.secondary + '14' }]}>
              <Text style={[styles.sourceText, { color: colors.secondary }]}>{sourceLabel}</Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={onOpenList}
          accessibilityRole="button"
          accessibilityLabel="Abrir lista de postos"
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <IconSymbol name="list.bullet" size={16} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Atualizar postos e preços"
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed || refreshing ? 0.7 : 1,
            },
          ]}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol name="arrow.clockwise" size={16} color={colors.primary} />
          )}
        </Pressable>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={15} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Buscar posto ou bairro"
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          accessibilityLabel="Buscar posto ou bairro"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => onSearchChange('')} hitSlop={8} accessibilityLabel="Limpar busca">
            <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <FuelTypeFilter selected={fuelType} onSelect={onFuelSelect} />

      <View style={styles.radiusRow}>
        {MAP_RADIUS_OPTIONS_KM.map((km) => {
          const selected = mapRadiusKm === km;
          return (
            <Pressable
              key={km}
              onPress={() => onRadiusKm(km)}
              accessibilityRole="button"
              accessibilityLabel={`Raio de ${km} quilômetros`}
              style={[
                styles.radiusChip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.radiusChipText, { color: selected ? '#fff' : colors.foreground }]}>
                {km} km
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.statusText, { color: colors.muted }]}>
        {countLabel}
      </Text>

      {stationsSource === 'cache' ? (
        <Text style={[styles.statusText, { color: colors.warning }]}>
          Dados salvos no aparelho
        </Text>
      ) : null}

      {stationsSource === 'offline' ? (
        <Pressable onPress={onReloadOffline} accessibilityRole="button" accessibilityLabel="Tentar conectar ao servidor">
          <Text style={[styles.statusText, { color: colors.warning }]}>
            Sem servidor ({apiBaseUrl}) - toque para tentar de novo
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  appName: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  appCity: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    padding: 0,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 16,
    paddingBottom: 5,
  },
});
