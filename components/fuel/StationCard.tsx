import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/hooks/theme/use-theme';
import { useApp } from '@/context/AppContext';
import {
  Station,
  FuelType,
  getPriceCategory,
  getPriceCategoryColor,
  formatTimeAgo,
  isOutdated,
  getPriceConfidence,
  FUEL_TYPE_LABELS,
  getPriceSource,
  getPriceSourceLabel,
} from '@/data/stations';
import { getStationBrandColor } from '@/constants/brand-colors';
import * as Haptics from 'expo-haptics';

interface StationCardProps {
  station: Station;
  fuelType?: FuelType;
  showDistance?: boolean;
  compact?: boolean;
}

export function StationCard({ station, fuelType = 'gasolina', showDistance = true, compact = false }: StationCardProps) {
  const { colors, tokens } = useTheme();
  const router = useRouter();
  const { state, dispatch } = useApp();

  const isFavorite = state.favoriteIds.includes(station.id);
  const price = station.prices.find((p) => p.type === fuelType);
  const category = price ? getPriceCategory(price.price) : 'medium';
  const priceColor = price ? getPriceCategoryColor(category) : colors.muted;
  const outdated = price ? isOutdated(price.updatedAt) : false;
  const confidence = price ? getPriceConfidence(price) : null;
  const brandColor = getStationBrandColor(station.brand, colors.muted);
  const priceSource = getPriceSource(price);
  const sourceLabel = getPriceSourceLabel(price);
  const distanceLabel = showDistance && station.distance !== undefined
    ? station.distance < 1
      ? `${Math.round(station.distance * 1000)}m`
      : `${station.distance.toFixed(1)}km`
    : null;

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/station/${station.id}` as any);
  };

  const handleFavorite = (e: any) => {
    e.stopPropagation();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'TOGGLE_FAVORITE', stationId: station.id });
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir posto ${station.name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          borderRadius: tokens.radius.sm,
          ...tokens.shadows.soft,
        },
        compact && styles.compact,
      ]}
    >
      <View style={[styles.brandStrip, { backgroundColor: brandColor }]} />

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.nameBlock}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={[styles.address, { color: colors.muted }]} numberOfLines={1}>
              {station.neighborhood} - {station.address}
            </Text>
          </View>
          <Pressable
            onPress={handleFavorite}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            style={({ pressed }) => [styles.favBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconSymbol
              name="heart.fill"
              size={20}
              color={isFavorite ? '#EF4444' : colors.border}
            />
          </Pressable>
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceBlock}>
            <View style={[styles.priceBadge, { backgroundColor: priceColor + '20' }]}>
              <Text style={[styles.priceValue, { color: priceColor }]}>
                {price ? `R$ ${price.price.toFixed(2)}` : 'Sem preco'}
              </Text>
            </View>
            <Text style={[styles.fuelLabel, { color: colors.muted }]}>
              {FUEL_TYPE_LABELS[fuelType]}
            </Text>
          </View>

          <View style={styles.metaBlock}>
            {distanceLabel ? (
              <View style={styles.metaItem}>
                <IconSymbol name="location.fill" size={12} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.muted }]}>{distanceLabel}</Text>
              </View>
            ) : null}
            {price ? (
              <View style={styles.metaItem}>
                <IconSymbol
                  name={outdated ? 'exclamationmark.triangle.fill' : 'clock.fill'}
                  size={12}
                  color={outdated ? colors.warning : colors.muted}
                />
                <Text style={[styles.metaText, { color: outdated ? colors.warning : colors.muted }]}>
                  {outdated ? 'Desatualizado' : formatTimeAgo(price.updatedAt)}
                </Text>
              </View>
            ) : null}
            {price ? (
              <View style={styles.metaItem}>
                <IconSymbol name={priceSource === 'sefaz' ? 'checkmark.seal.fill' : 'archivebox.fill'} size={12} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.muted }]}>{sourceLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {confidence ? (
          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  confidence === 'confirmed'
                    ? colors.success + '20'
                    : confidence === 'recent'
                      ? colors.warning + '20'
                      : colors.error + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.confidenceText,
                {
                  color:
                    confidence === 'confirmed'
                      ? colors.success
                      : confidence === 'recent'
                        ? colors.warning
                        : colors.error,
                },
              ]}
            >
              {confidence === 'confirmed' ? 'Confirmado' : confidence === 'recent' ? 'Recente' : 'Desatualizado'}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
  },
  compact: {
    marginHorizontal: 0,
    marginVertical: 3,
  },
  brandStrip: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  address: {
    fontSize: 12,
    lineHeight: 16,
  },
  favBtn: {
    padding: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  priceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  fuelLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaBlock: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 15,
  },
  confidenceBadge: {
    marginTop: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
});
