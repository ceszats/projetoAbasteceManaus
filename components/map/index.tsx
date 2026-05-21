import React from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View, Text } from 'react-native';
import { Station, FuelType, getPriceCategory, getPriceCategoryColor, isOutdated } from '@/data/stations';

interface MapProps {
  mapRef: React.RefObject<any>;
  initialRegion: any;
  stations: Station[];
  fuelType: FuelType;
  onMarkerPress: (station: Station) => void;
  userLocation: { latitude: number; longitude: number } | null;
}

export default function Map({ mapRef, initialRegion, stations, fuelType, onMarkerPress, userLocation }: MapProps) {
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton={false}
      userInterfaceStyle="light"
    >
      {stations.map(station => {
        const price = station.prices.find(p => p.type === fuelType);
        const cat = price ? getPriceCategory(price.price) : 'medium';
        const pinColor = getPriceCategoryColor(cat);
        const outdated = price ? isOutdated(price.updatedAt) : false;

        return (
          <Marker
            key={station.id}
            coordinate={{ latitude: station.latitude, longitude: station.longitude }}
            onPress={() => onMarkerPress(station)}
          >
            {/* Custom pin */}
            <View style={[styles.pin, { backgroundColor: pinColor, borderColor: '#fff' }]}>
              {price ? (
                <Text style={styles.pinText}>
                  {price.price.toFixed(2)}
                </Text>
              ) : (
                <Text style={styles.pinTextSmall}>⛽</Text>
              )}
              {outdated && (
                <View style={styles.pinWarning}>
                  <Text style={{ fontSize: 8 }}>⚠</Text>
                </View>
              )}
            </View>
            <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
          </Marker>
        );
      })}
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
});
