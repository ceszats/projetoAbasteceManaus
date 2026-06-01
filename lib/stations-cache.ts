import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StationFromApi } from '@/lib/fetch-stations';

const CACHE_KEY = '@fuelmap_stations_cache_v1';
const CACHE_TTL_MS = 15 * 60 * 1000;

type StationsCachePayload = {
  savedAt: number;
  stations: StationFromApi[];
};

export async function loadCachedStations(): Promise<StationFromApi[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StationsCachePayload;
    if (!parsed?.stations?.length || !parsed.savedAt) return null;

    const age = Date.now() - parsed.savedAt;
    if (age > CACHE_TTL_MS * 4) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.stations;
  } catch {
    return null;
  }
}

export async function saveCachedStations(stations: StationFromApi[]): Promise<void> {
  try {
    const payload: StationsCachePayload = {
      savedAt: Date.now(),
      stations,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // cache opcional
  }
}

export function isCacheFresh(savedAt: number): boolean {
  return Date.now() - savedAt < CACHE_TTL_MS;
}
