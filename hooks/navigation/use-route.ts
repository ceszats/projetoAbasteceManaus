/**
 * use-route.ts
 *
 * Hook para buscar a rota entre a localização do usuário e um posto.
 * Usa a API pública OSRM (Open Source Routing Machine) — gratuita, sem chave.
 * Endpoint: https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}
 */

import { useState, useEffect, useCallback } from 'react';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  /** Array de pontos do caminho para desenhar no mapa */
  polyline: RoutePoint[];
  /** Distância em metros */
  distanceMeters: number;
  /** Duração em segundos */
  durationSeconds: number;
  /** Distância formatada (ex: "2,3 km") */
  distanceLabel: string;
  /** Duração formatada (ex: "8 min") */
  durationLabel: string;
}

interface UseRouteReturn {
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Decodifica uma polyline encoded (formato OSRM/Google) em array de coordenadas.
 * OSRM usa o formato Polyline5 (precisão 5).
 */
function decodePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seg`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function useRoute(
  origin: RoutePoint | null,
  destination: RoutePoint,
): UseRouteReturn {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!origin) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.longitude},${origin.latitude};` +
      `${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=polyline`;

    fetch(url, { signal: AbortSignal.timeout(10_000) })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;

        if (data.code !== 'Ok' || !data.routes?.length) {
          throw new Error('Rota não encontrada');
        }

        const r = data.routes[0];
        const polyline = decodePolyline(r.geometry);

        setRoute({
          polyline,
          distanceMeters: r.distance,
          durationSeconds: r.duration,
          distanceLabel: formatDistance(r.distance),
          durationLabel: formatDuration(r.duration),
        });
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erro ao calcular rota');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [origin?.latitude, origin?.longitude, destination.latitude, destination.longitude, refreshKey]);

  return { route, loading, error, refresh };
}
