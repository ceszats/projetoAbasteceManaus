import React from 'react';
import { View, Text, Pressable, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getStationBrandColor } from '@/constants/brand-colors';
import {
  Station,
  FuelType,
  getPriceCategory,
  getPriceCategoryColor,
  formatTimeAgo,
  isOutdated,
  FUEL_TYPE_LABELS,
  getPriceSource,
  getPriceSourceLabel,
} from '@/data/stations';

type StationPreviewSheetProps = {
  station: Station;
  fuelType: FuelType;
  isFavorite: boolean;
  paddingBottom: number;
  borderRadius: number;
  colors: ReturnType<typeof import('@/hooks/theme/use-theme').useTheme>['colors'];
  tokens: ReturnType<typeof import('@/hooks/theme/use-theme').useTheme>['tokens'];
  onClose: () => void;
  onToggleFavorite: () => void;
  onDirections: () => void;
  onReportPrice: () => void;
  onViewDetail: () => void;
};

export function StationPreviewSheet({
  station,
  fuelType,
  isFavorite,
  paddingBottom,
  borderRadius,
  colors,
  tokens,
  onClose,
  onToggleFavorite,
  onDirections,
  onReportPrice,
  onViewDetail,
}: StationPreviewSheetProps) {
  const price = station.prices.find((p) => p.type === fuelType);
  const cat = price ? getPriceCategory(price.price) : 'medium';
  const priceColor = getPriceCategoryColor(cat);
  const outdated = price ? isOutdated(price.updatedAt) : false;
  const brandColor = getStationBrandColor(station.brand, colors.primary);
  const distanceLabel = typeof station.distance === 'number'
    ? station.distance < 1
      ? `${Math.round(station.distance * 1000)} m`
      : `${station.distance.toFixed(1)} km`
    : null;
  const priceSource = getPriceSource(price);
  const sourceLabel = getPriceSourceLabel(price);

  return (
    <TouchableWithoutFeedback>
      <View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: paddingBottom + 10,
            borderRadius,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 12,
          },
        ]}
      >
        <View style={[styles.bsBrandStrip, { backgroundColor: brandColor }]} />

        <View style={styles.bsTopRow}>
          <View style={[styles.bottomSheetHandle, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            style={({ pressed }) => [
              styles.bsIconBtn,
              {
                backgroundColor: isFavorite ? '#EF444415' : colors.background,
                borderColor: isFavorite ? '#EF4444' : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <IconSymbol name="heart.fill" size={14} color={isFavorite ? '#EF4444' : colors.muted} />
          </Pressable>
          <Pressable
            hitSlop={12}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar previa do posto"
            style={({ pressed }) => [
              styles.bsIconBtn,
              { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <IconSymbol name="xmark" size={12} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.bsBody}>
          <View>
            <Text style={[styles.bsName, { color: colors.foreground }]} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={[styles.bsAddr, { color: colors.muted }]} numberOfLines={1}>
              {station.brand} - {station.neighborhood}
            </Text>
          </View>

          {price ? (
            <View style={styles.bsPriceRow}>
              <View style={[styles.bsPricePill, { backgroundColor: priceColor + '18' }]}>
                <Text style={[styles.bsPriceMain, { color: priceColor }]}>R$ {price.price.toFixed(2)}</Text>
                <Text style={[styles.bsPriceLabel, { color: priceColor + 'BB' }]}>/ L</Text>
              </View>
              <View style={[styles.bsFuelChip, { backgroundColor: colors.secondary + '14' }]}>
                <Text style={[styles.bsFuelText, { color: colors.secondary }]}>{FUEL_TYPE_LABELS[fuelType]}</Text>
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
                  <IconSymbol name={priceSource === 'sefaz' ? 'checkmark.seal.fill' : 'archivebox.fill'} size={9} color={colors.muted} />
                  <Text style={[styles.bsMetaText, { color: colors.muted }]}>{sourceLabel}</Text>
                </View>
                {distanceLabel ? (
                  <View style={[styles.bsMetaChip, { backgroundColor: colors.primary + '12' }]}>
                    <IconSymbol name="location.fill" size={9} color={colors.primary} />
                    <Text style={[styles.bsMetaText, { color: colors.primary }]}>{distanceLabel}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.bsNoPriceChip, { backgroundColor: colors.muted + '15' }]}>
              <Text style={[styles.bsMetaText, { color: colors.muted }]}>Sem preco cadastrado</Text>
            </View>
          )}

          <View style={styles.bsActions}>
            <Pressable
              onPress={onReportPrice}
              accessibilityRole="button"
              accessibilityLabel="Editar preco do posto"
              style={({ pressed }) => [
                styles.bsBtnSecondary,
                { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <IconSymbol name="pencil" size={14} color={colors.primary} />
              <Text style={[styles.bsBtnSecondaryText, { color: colors.primary }]}>Editar</Text>
            </Pressable>
            <Pressable
              onPress={onViewDetail}
              accessibilityRole="button"
              accessibilityLabel="Ver detalhes do posto"
              style={({ pressed }) => [
                styles.bsBtnSecondary,
                { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <IconSymbol name="info.circle.fill" size={14} color={colors.primary} />
              <Text style={[styles.bsBtnSecondaryText, { color: colors.primary }]}>Detalhes</Text>
            </Pressable>
            <Pressable
              onPress={onDirections}
              accessibilityRole="button"
              accessibilityLabel="Ver rotas ate o posto"
              style={({ pressed }) => [
                styles.bsBtnPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, ...tokens.shadows.premium },
              ]}
            >
              <IconSymbol name="car.fill" size={14} color="#fff" />
              <Text style={styles.bsBtnText}>Tracar rota</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  bottomSheet: { position: 'absolute', left: 12, right: 12, bottom: 0, zIndex: 20 },
  bsBrandStrip: { height: 4, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  bsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  bottomSheetHandle: { width: 36, height: 4, borderRadius: 2, flex: 1, maxWidth: 36 },
  bsIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bsBody: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  bsName: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  bsAddr: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  bsPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  bsPricePill: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  bsPriceMain: { fontSize: 22, fontWeight: '800' },
  bsPriceLabel: { fontSize: 12, fontWeight: '600', marginLeft: 2 },
  bsFuelChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  bsFuelText: { fontSize: 10, fontWeight: '900', lineHeight: 14 },
  bsChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  bsMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bsMetaText: { fontSize: 10, fontWeight: '600' },
  bsNoPriceChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  bsActions: { flexDirection: 'row', gap: 10 },
  bsBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bsBtnSecondaryText: { fontSize: 14, fontWeight: '700' },
  bsBtnPrimary: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  bsBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
