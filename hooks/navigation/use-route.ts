import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '@/constants/oauth';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  polyline: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  distanceLabel: string;
  durationLabel: string;
}

interface UseRouteReturn {
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
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

function createFetchAbort(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timeoutId);
      controller.abort();
    },
  };
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
    if (!origin) {
      setRoute(null);
      setError('Localizacao nao disponivel');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      originLat: String(origin.latitude),
      originLng: String(origin.longitude),
      destinationLat: String(destination.latitude),
      destinationLng: String(destination.longitude),
    });
    const url = `${getApiBaseUrl()}/api/routes/driving?${params.toString()}`;

    const abort = createFetchAbort(8_000);

    fetch(url, { signal: abort.signal })
      .then(async (res) => {
        const data = await res.json();
        return { data, ok: res.ok };
      })
      .then(({ data, ok }) => {
        if (cancelled) return;

        if (!ok) {
          throw new Error(data?.error ?? 'Rota nao encontrada');
        }

        if (!Array.isArray(data.polyline) || data.polyline.length < 2) {
          throw new Error('Rota nao encontrada');
        }

        setRoute({
          polyline: data.polyline,
          distanceMeters: data.distanceMeters,
          durationSeconds: data.durationSeconds,
          distanceLabel: data.distanceLabel ?? formatDistance(data.distanceMeters),
          durationLabel: data.durationLabel ?? formatDuration(data.durationSeconds),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setRoute(null);
        setError('Nao foi possivel calcular a rota no app');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      abort.clear();
    };
  }, [origin?.latitude, origin?.longitude, destination.latitude, destination.longitude, refreshKey]);

  return { route, loading, error, refresh };
}
