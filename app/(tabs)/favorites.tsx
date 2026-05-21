import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/layout/screen-container';
import { StationCard } from '@/components/fuel/StationCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/hooks/theme/use-theme';
import { useApp } from '@/context/AppContext';
import {
  Station,
  calculateDistance,
  MANAUS_CENTER,
} from '@/data/stations';
import * as Haptics from 'expo-haptics';

export default function FavoritesScreen() {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useApp();

  const fuelType = state.selectedFuelType;

  const favoriteStations = useMemo(() => {
    return state.favoriteIds
      .map(id => {
        const s = state.stations.find(s => s.id === id);
        if (!s) return null;
        return {
          ...s,
          isFavorite: true,
          distance: calculateDistance(
            state.userLocation?.latitude ?? MANAUS_CENTER.latitude,
            state.userLocation?.longitude ?? MANAUS_CENTER.longitude,
            s.latitude,
            s.longitude
          ),
        };
      })
      .filter(Boolean) as (Station & { distance: number })[];
  }, [state.favoriteIds, state.stations, state.userLocation]);

  const handleRemoveAll = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    state.favoriteIds.forEach(id => dispatch({ type: 'TOGGLE_FAVORITE', stationId: id }));
  };

  const renderItem = ({ item }: { item: Station & { distance: number } }) => {
    // Calcular variação de preço (simulado: diferença entre primeiro e último do histórico)
    const history = item.priceHistory[fuelType];
    let priceChange: number | null = null;
    if (history && history.length >= 2) {
      priceChange = history[history.length - 1].price - history[0].price;
    }

    return (
      <View>
        <StationCard station={item} fuelType={fuelType} showDistance />
        {priceChange !== null && (
          <View style={[styles.priceChangeRow, { marginHorizontal: 16 }]}>
            <View style={[
              styles.priceChangeBadge,
              {
                backgroundColor: priceChange < 0 ? colors.success + '15' : priceChange > 0 ? colors.error + '15' : colors.muted + '15',
                borderRadius: tokens.radius.sm,
              },
            ]}>
              <IconSymbol
                name={priceChange < 0 ? 'arrow.down' : priceChange > 0 ? 'arrow.up' : 'checkmark'}
                size={12}
                color={priceChange < 0 ? colors.success : priceChange > 0 ? colors.error : colors.muted}
              />
              <Text style={[
                styles.priceChangeText,
                { color: priceChange < 0 ? colors.success : priceChange > 0 ? colors.error : colors.muted },
              ]}>
                {priceChange === 0
                  ? 'Estável nos últimos 30 dias'
                  : `${priceChange < 0 ? '-' : '+'}R$ ${Math.abs(priceChange).toFixed(2)} nos últimos 30 dias`}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Favoritos</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>
            {favoriteStations.length} posto{favoriteStations.length !== 1 ? 's' : ''} salvo{favoriteStations.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {favoriteStations.length > 0 && (
          <Pressable
            onPress={handleRemoveAll}
            style={({ pressed }) => [styles.clearBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.clearBtnText, { color: colors.error }]}>Limpar</Text>
          </Pressable>
        )}
      </View>

      {favoriteStations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 64 }}>❤️</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum favorito ainda</Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>
            Toque no ícone de coração em qualquer posto para salvá-lo aqui.
          </Text>
          <View style={[styles.tipCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}>
            <Text style={{ fontSize: 20 }}>💡</Text>
            <Text style={[styles.tipText, { color: colors.muted }]}>
              Postos favoritos mostram a variação de preço dos últimos 30 dias, para você acompanhar de perto.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={favoriteStations}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  headerSub: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  priceChangeRow: {
    marginTop: -2,
    marginBottom: 4,
  },
  priceChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  priceChangeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  tipCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
