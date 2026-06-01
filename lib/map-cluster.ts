import Supercluster from 'supercluster';
import type { FuelType, MapStationView } from '@/data/stations';

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type StationClusterFeature = {
  type: 'Feature';
  properties: {
    cluster: boolean;
    cluster_id?: number;
    point_count?: number;
    point_count_abbreviated?: string | number;
    stationId: string;
    mapPinTier: 'live' | 'user' | 'reference' | 'catalog';
    price: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
};

export function getZoomFromRegion(latitudeDelta: number): number {
  const delta = Math.max(latitudeDelta, 0.0001);
  return Math.min(20, Math.max(0, Math.round(Math.log(360 / delta) / Math.LN2)));
}

export function regionToBBox(region: MapRegion): [number, number, number, number] {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return [
    region.longitude - halfLng,
    region.latitude - halfLat,
    region.longitude + halfLng,
    region.latitude + halfLat,
  ];
}

export function buildStationClusterIndex(stations: MapStationView[], fuelType: FuelType) {
  const index = new Supercluster<StationClusterFeature['properties']>({
    radius: 56,
    maxZoom: 18,
    minPoints: 2,
  });

  const points: StationClusterFeature[] = stations.map((station) => {
    const price = station.prices.find((p) => p.type === fuelType)?.price ?? 0;
    return {
      type: 'Feature',
      properties: {
        cluster: false,
        stationId: station.id,
        mapPinTier: station.mapPinTier,
        price,
      },
      geometry: {
        type: 'Point',
        coordinates: [station.longitude, station.latitude],
      },
    };
  });

  index.load(points);
  return index;
}

export function getClustersForRegion(
  index: Supercluster<StationClusterFeature['properties']>,
  region: MapRegion,
): StationClusterFeature[] {
  const bbox = regionToBBox(region);
  const zoom = getZoomFromRegion(region.latitudeDelta);
  return index.getClusters(bbox, zoom) as StationClusterFeature[];
}

export function getClusterExpansionRegion(
  index: Supercluster<StationClusterFeature['properties']>,
  clusterId: number,
  count: number,
): MapRegion | null {
  const leaves = index.getLeaves(clusterId, Math.min(count, 24));
  if (leaves.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const leaf of leaves) {
    const [lng, lat] = leaf.geometry.coordinates;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  const latDelta = Math.max((maxLat - minLat) * 1.6, 0.012);
  const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.012);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}
