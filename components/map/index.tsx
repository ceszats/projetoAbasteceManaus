import React, { useCallback, useMemo, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import {
  Station,
  FuelType,
  MapStationView,
  getPriceCategory,
  getPriceCategoryColor,
  isOutdated,
} from '@/data/stations';
import {
  buildStationClusterIndex,
  getClusterExpansionRegion,
  getClustersForRegion,
  type MapRegion,
} from '@/lib/map-cluster';

interface MapProps {
  mapRef: React.RefObject<any>;
  initialRegion: MapRegion;
  stations: MapStationView[];
  fuelType: FuelType;
  onMarkerPress: (station: Station) => void;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onRegionChangeComplete?: (region: MapRegion) => void;
  userLocation: { latitude: number; longitude: number } | null;
  enableClustering?: boolean;
}

export default function Map({
  mapRef,
  initialRegion,
  stations,
  fuelType,
  onMarkerPress,
  onMapPress,
  onRegionChangeComplete,
  enableClustering = true,
}: MapProps) {
  const [region, setRegion] = useState<MapRegion>(initialRegion);

  const stationById = useMemo(() => {
    const lookup: Record<string, MapStationView> = {};
    for (const station of stations) {
      lookup[station.id] = station;
    }
    return lookup;
  }, [stations]);

  const clusterIndex = useMemo(() => {
    if (!enableClustering || stations.length < 8) return null;
    return buildStationClusterIndex(stations, fuelType);
  }, [enableClustering, stations, fuelType]);

  const clusters = useMemo(() => {
    if (!clusterIndex) return null;
    return getClustersForRegion(clusterIndex, region);
  }, [clusterIndex, region]);

  const handleRegionChangeComplete = useCallback((next: MapRegion) => {
    setRegion(next);
    onRegionChangeComplete?.(next);
  }, [onRegionChangeComplete]);

  const handleClusterPress = useCallback(
    (clusterId: number, pointCount: number) => {
      if (!clusterIndex) return;
      const next = getClusterExpansionRegion(clusterIndex, clusterId, pointCount);
      if (next) {
        mapRef.current?.animateToRegion(next, 450);
      }
    },
    [clusterIndex, mapRef],
  );

  const renderStationMarker = useCallback((station: MapStationView) => {
    const price = station.prices.find((p) => p.type === fuelType);

    if (station.mapPinTier === 'catalog' || !price) {
      return (
        <Marker
          key={`${station.id}-${fuelType}-dot`}
          coordinate={{ latitude: station.latitude, longitude: station.longitude }}
            onPress={() => onMarkerPress(station)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={`Posto ${station.name}, sem preço recente`}
        >
          <View style={styles.dotPinOuter}>
            <View style={styles.dotPinInner} />
          </View>
        </Marker>
      );
    }

    const cat = getPriceCategory(price.price);
    const pinColor = station.mapPinTier === 'reference'
      ? '#1F7A8C'
      : station.mapPinTier === 'user'
        ? '#7C3AED'
        : getPriceCategoryColor(cat);
    const outdated = isOutdated(price.updatedAt);

    return (
      <Marker
        key={`${station.id}-${fuelType}-live`}
        coordinate={{ latitude: station.latitude, longitude: station.longitude }}
        onPress={() => onMarkerPress(station)}
        tracksViewChanges={false}
        accessibilityLabel={`${station.name}, ${fuelType} R$ ${price.price.toFixed(2)}`}
      >
        <View style={[styles.pin, { backgroundColor: pinColor, borderColor: '#fff' }]}>
          <Text style={styles.pinText}>{price.price.toFixed(2)}</Text>
        {station.mapPinTier === 'reference' || station.mapPinTier === 'user' ? (
          <Text style={styles.referencePinText}>{station.mapPinTier === 'user' ? 'user' : 'ref.'}</Text>
        ) : null}
          {outdated ? (
            <View style={styles.pinWarning}>
              <Text style={{ fontSize: 8 }}>⚠</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
      </Marker>
    );
  }, [fuelType, onMarkerPress]);

  const markers = useMemo(() => {
    if (!clusters) {
      return stations.map((station) => renderStationMarker(station));
    }

    return clusters.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const { cluster, cluster_id: clusterId, point_count: pointCount = 0 } = feature.properties;

      if (cluster && clusterId !== undefined) {
        return (
          <Marker
            key={`cluster-${clusterId}`}
            coordinate={{ latitude, longitude }}
            tracksViewChanges={false}
            onPress={() => handleClusterPress(clusterId, pointCount)}
          >
            <Pressable style={styles.clusterPin}>
              <Text style={styles.clusterText}>{pointCount}</Text>
            </Pressable>
          </Marker>
        );
      }

      const station = stationById[feature.properties.stationId];
      if (!station) return null;
      return renderStationMarker(station);
    });
  }, [clusters, stations, stationById, handleClusterPress, renderStationMarker]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      onRegionChangeComplete={handleRegionChangeComplete}
      onPress={(event) => {
        if ((event.nativeEvent as { action?: string }).action === 'marker-press') return;
        onMapPress?.(event.nativeEvent.coordinate);
      }}
      showsUserLocation
      showsMyLocationButton={false}
      userInterfaceStyle="light"
    >
      {markers}
    </MapView>
  );
}

const styles = StyleSheet.create({
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
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 4,
  },
  pinText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  referencePinText: {
    color: '#FFFFFFD9',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 9,
    marginTop: -2,
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
  dotPinOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F7FAF8',
    borderWidth: 2,
    borderColor: '#1F7A8C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1B6B43',
  },
  clusterPin: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F7A8C',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 5,
  },
  clusterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
