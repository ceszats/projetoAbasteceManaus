import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/hooks/theme/use-theme';
import { useApp } from '@/context/AppContext';
import {
  STATIONS,
  FUEL_TYPE_LABELS,
  FUEL_TYPE_ICONS,
  getPriceCategory,
  getPriceCategoryColor,
  getPriceConfidence,
  formatTimeAgo,
  isOutdated,
  FuelType,
  calculateDistance,
  MANAUS_CENTER,
} from '@/data/stations';
import { trpc } from '@/lib/trpc';
import { usePriceEngine } from '@/hooks/fuel/use-price-engine';
import { useNearbyGeofence } from '@/hooks/location/use-nearby-geofence';
import { PriceConfirmBanner } from '@/components/fuel/PriceConfirmBanner';
import { RouteModal } from '@/components/navigation/RouteModal';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 100;

function PriceHistoryChart({ history, color }: { history: { date: Date; price: number }[]; color: string }) {
  if (!history || history.length < 2) return null;

  const prices = history.map(h => h.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 0.1;

  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((h.price - minP) / range) * (CHART_HEIGHT - 20) - 10;
    return { x, y, price: h.price };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20}>
      {/* Grid lines */}
      <Line x1="0" y1={CHART_HEIGHT - 10} x2={CHART_WIDTH} y2={CHART_HEIGHT - 10} stroke="#E5E7EB" strokeWidth="1" />
      <Line x1="0" y1={10} x2={CHART_WIDTH} y2={10} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4,4" />

      {/* Line */}
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Last point dot */}
      <Circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="5"
        fill={color}
      />

      {/* Min/Max labels */}
      <SvgText x="0" y={CHART_HEIGHT + 16} fontSize="10" fill="#9CA3AF">
        R$ {minP.toFixed(2)}
      </SvgText>
      <SvgText x={CHART_WIDTH - 48} y={CHART_HEIGHT + 16} fontSize="10" fill="#9CA3AF">
        R$ {maxP.toFixed(2)}
      </SvgText>
    </Svg>
  );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: size, lineHeight: size + 4 }}>
          {i <= rating ? '⭐' : '☆'}
        </Text>
      ))}
    </View>
  );
}

export default function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, tokens } = useTheme();
  const { state, dispatch } = useApp();
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('gasolina');
  const [showRoute, setShowRoute] = useState(false);

  const station = useMemo(() => {
    const s = state.stations.find(s => s.id === id);
    if (!s) return null;
    return {
      ...s,
      isFavorite: state.favoriteIds.includes(s.id),
      distance: calculateDistance(
        state.userLocation?.latitude ?? MANAUS_CENTER.latitude,
        state.userLocation?.longitude ?? MANAUS_CENTER.longitude,
        s.latitude,
        s.longitude
      ),
    };
  }, [id, state.stations, state.favoriteIds, state.userLocation]);

  // Busca contribuições reais do servidor
  const { data: dbContributions } = trpc.stations.prices.useQuery(
    { stationId: id as string },
    { enabled: !!id }
  );

  // Hook de geofencing para saber se o usuário está no posto
  const nearbyStation = useNearbyGeofence();
  const isAtThisStation = nearbyStation?.id === id;

  // Motor de preços: calcula mediana por combustível usando contribuições do banco
  const FUEL_TYPES_ALL: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];

  const livePriceMap = useMemo(() => {
    const map: Record<string, { median: number; count: number; lastAt: Date }> = {};
    if (!dbContributions || dbContributions.length === 0) return map;
    for (const ft of FUEL_TYPES_ALL) {
      const items = dbContributions.filter(c => c.fuelType === ft);
      if (items.length === 0) continue;
      const recent24h = items.filter(c =>
        new Date(c.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      const use = recent24h.length > 0 ? recent24h : items;
      const sorted = [...use].map(c => c.price).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      const lastAt = use.reduce((latest, c) =>
        new Date(c.createdAt) > new Date(latest.createdAt) ? c : latest
      ).createdAt;
      map[ft] = { median: parseFloat(med.toFixed(2)), count: use.length, lastAt: new Date(lastAt) };
    }
    return map;
  }, [dbContributions]);

  const currentFuelPrices = useMemo(() => {
    if (!dbContributions) return [];
    return dbContributions.filter(c => c.fuelType === selectedFuel);
  }, [dbContributions, selectedFuel]);

  const priceStats = usePriceEngine(currentFuelPrices, selectedFuel);

  if (!station) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.foreground }]}>Posto não encontrado</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  // Mescla preços ao vivo (DB) com estáticos: DB tem prioridade
  const FUEL_TYPES_ORDERED: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];
  const displayPrices = (() => {
    const result: { type: FuelType; price: number; updatedAt: Date; confirmations: number; isLive: boolean }[] = [];
    for (const ft of FUEL_TYPES_ORDERED) {
      const live = livePriceMap[ft];
      if (live) {
        result.push({ type: ft, price: live.median, updatedAt: live.lastAt, confirmations: live.count, isLive: true });
      } else {
        const staticP = station.prices.find(p => p.type === ft);
        if (staticP) result.push({ ...staticP, isLive: false });
      }
    }
    return result;
  })();

  const selectedPrice = displayPrices.find(p => p.type === selectedFuel);
  const priceCategory = selectedPrice ? getPriceCategory(selectedPrice.price) : 'medium';
  const priceColor = getPriceCategoryColor(priceCategory);
  const selectedConfidence = selectedPrice && !selectedPrice.isLive ? getPriceConfidence(selectedPrice) : null;
  const history = station.priceHistory[selectedFuel];
  const avgRating = station.reviews.length > 0
    ? station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length
    : 0;

  const brandColors: Record<string, string> = {
    'Ipiranga': '#FF6B00',
    'Shell': '#DD1D21',
    'BR': '#009B3A',
    'Ale': '#0066CC',
    'Bandeirante': '#6B21A8',
    'Raízen': '#DD1D21',
  };
  const brandColor = brandColors[station.brand] ?? colors.primary;

  const handleFavorite = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'TOGGLE_FAVORITE', stationId: station.id });
  };

  const handleReport = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/report/${station.id}` as any);
  };

  const handleDirections = () => setShowRoute(true);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
          ...tokens.shadows.soft,
        }
      ]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={[styles.headerBrand, { color: brandColor }]}>{station.brand}</Text>
        </View>
        <Pressable
          onPress={handleFavorite}
          style={({ pressed }) => [styles.favBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol
            name="heart.fill"
            size={22}
            color={station.isFavorite ? '#EF4444' : colors.border}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Banner de Confirmação Inteligente (Geofencing) */}
        {isAtThisStation && priceStats.medianPrice && (
          <PriceConfirmBanner
            stationName={station.name}
            fuelType={selectedFuel}
            price={priceStats.medianPrice}
            onConfirm={() => {
              dispatch({
                type: 'REPORT_PRICE',
                stationId: station.id,
                fuelType: selectedFuel,
                price: priceStats.medianPrice!,
              });
            }}
            onIncorrect={handleReport}
          />
        )}

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}>
          <View style={styles.infoRow}>
            <IconSymbol name="location.fill" size={14} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.muted }]}>{station.address}, {station.neighborhood}</Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol name="car.fill" size={14} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              {station.distance < 1 ? `${Math.round(station.distance * 1000)}m de você` : `${station.distance.toFixed(1)}km de você`}
            </Text>
          </View>
          {station.reviews.length > 0 && (
            <View style={styles.infoRow}>
              <StarRating rating={Math.round(avgRating)} size={12} />
              <Text style={[styles.infoText, { color: colors.muted }]}>
                {avgRating.toFixed(1)} ({station.reviews.length} avaliações)
              </Text>
            </View>
          )}
          {/* Amenities */}
          {station.amenities.length > 0 && (
            <View style={styles.amenitiesRow}>
              {station.amenities.map(a => (
                <View key={a} style={[styles.amenityChip, { backgroundColor: colors.border + '60', borderColor: colors.border }]}>
                  <Text style={[styles.amenityText, { color: colors.muted }]}>{a}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Preços */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preços</Text>
        <View style={[styles.pricesCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}>
          {displayPrices.length === 0 ? (
            <Text style={[styles.priceTime, { color: colors.muted, padding: 16, textAlign: 'center' }]}>
              Sem preços disponíveis — contribua reportando!
            </Text>
          ) : displayPrices.map((p, i) => {
            const cat = getPriceCategory(p.price);
            const pc = getPriceCategoryColor(cat);
            const outdated = !p.isLive && isOutdated(p.updatedAt);
            const isSelected = p.type === selectedFuel;
            return (
              <Pressable
                key={p.type}
                onPress={() => setSelectedFuel(p.type)}
                style={({ pressed }) => [
                  styles.priceRow,
                  i < displayPrices.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                  isSelected && { backgroundColor: colors.primary + '10' },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.fuelIcon}>{FUEL_TYPE_ICONS[p.type]}</Text>
                <Text style={[styles.fuelName, { color: colors.foreground }]}>{FUEL_TYPE_LABELS[p.type]}</Text>
                <View style={styles.priceRight}>
                  {p.isLive ? (
                    <View style={{ backgroundColor: colors.success + '25', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, color: colors.success, fontWeight: '700', letterSpacing: 0.3 }}>AO VIVO</Text>
                    </View>
                  ) : outdated ? (
                    <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.warning} />
                  ) : null}
                  <Text style={[styles.priceTime, { color: outdated ? colors.warning : colors.muted }]}>
                    {formatTimeAgo(p.updatedAt)}
                  </Text>
                  <View style={[styles.priceBadge, { backgroundColor: pc + '20' }]}>
                    <Text style={[styles.priceValue, { color: pc }]}>R$ {p.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <IconSymbol name="person.2.fill" size={11} color={colors.muted} />
                    <Text style={[styles.confirmText, { color: colors.muted }]}>{p.confirmations}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Histórico de preços */}
        {history && history.length >= 2 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Histórico — {FUEL_TYPE_LABELS[selectedFuel]} (30 dias)
            </Text>
            <View style={[styles.chartCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}>
              <PriceHistoryChart history={history} color={priceColor} />
              <Text style={[styles.chartNote, { color: colors.muted }]}>
                Variação: R$ {Math.min(...history.map(h => h.price)).toFixed(2)} — R$ {Math.max(...history.map(h => h.price)).toFixed(2)}
              </Text>
            </View>
          </>
        )}

        {selectedConfidence && (
          <View
            style={[
              styles.confidenceBanner,
              {
                backgroundColor:
                  selectedConfidence === 'confirmed'
                    ? colors.success + '14'
                    : selectedConfidence === 'recent'
                      ? colors.warning + '14'
                      : colors.error + '14',
                borderColor:
                  selectedConfidence === 'confirmed'
                    ? colors.success + '55'
                    : selectedConfidence === 'recent'
                      ? colors.warning + '55'
                      : colors.error + '55',
              },
            ]}
          >
            <Text
              style={[
                styles.confidenceBannerText,
                {
                  color:
                    selectedConfidence === 'confirmed'
                      ? colors.success
                      : selectedConfidence === 'recent'
                        ? colors.warning
                        : colors.error,
                },
              ]}
            >
              {selectedConfidence === 'confirmed'
                ? 'Preço confirmado por múltiplas contribuições recentes.'
                : selectedConfidence === 'recent'
                  ? 'Preço recente, aguardando mais confirmações.'
                  : 'Preço desatualizado, recomendamos nova contribuição.'}
            </Text>
          </View>
        )}

        {/* Avaliações */}
        {station.reviews.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Avaliações</Text>
            {station.reviews.map(review => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + '30' }]}>
                    <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>
                      {review.author.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reviewAuthor, { color: colors.foreground }]}>{review.author}</Text>
                    <StarRating rating={review.rating} size={12} />
                  </View>
                  <Text style={[styles.reviewDate, { color: colors.muted }]}>
                    {formatTimeAgo(review.date)}
                  </Text>
                </View>
                {review.comment && (
                  <Text style={[styles.reviewComment, { color: colors.muted }]}>{review.comment}</Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.bottomActions, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          onPress={handleReport}
          style={({ pressed }) => [
            styles.reportBtn,
            { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <IconSymbol name="pencil" size={16} color={colors.primary} />
          <Text style={[styles.reportBtnText, { color: colors.primary }]}>Reportar Preço</Text>
        </Pressable>
        <Pressable
          onPress={handleDirections}
          style={({ pressed }) => [
            styles.directionsBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
              ...tokens.shadows.premium,
            },
          ]}
        >
          <IconSymbol name="car.fill" size={16} color="#fff" />
          <Text style={styles.directionsBtnText}>Como Chegar</Text>
        </Pressable>
      </View>

      {/* Modal de navegação in-app */}
      {station && (
        <RouteModal
          visible={showRoute}
          onClose={() => setShowRoute(false)}
          stationName={station.name}
          stationBrand={station.brand}
          destination={{ latitude: station.latitude, longitude: station.longitude }}
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
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    zIndex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  headerBrand: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  favBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 4,
  },
  infoCard: {
    marginBottom: 8,
    padding: 14,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  amenityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  amenityText: {
    fontSize: 11,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 8,
  },
  pricesCard: {
    overflow: 'hidden',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  fuelIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  fuelName: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    flex: 1,
  },
  priceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceTime: {
    fontSize: 11,
    lineHeight: 15,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  confirmText: {
    fontSize: 11,
    lineHeight: 15,
  },
  chartCard: {
    padding: 16,
    gap: 8,
  },
  chartNote: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  reviewDate: {
    fontSize: 11,
    lineHeight: 15,
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
  },
  confidenceBanner: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  confidenceBannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 0.5,
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  reportBtnText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  directionsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  directionsBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
});
