import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppState as RNAppState, Platform } from 'react-native';

import * as Location from 'expo-location';

import {
  STATIONS,
  Station,
  FuelType,
  FuelPrice,
  mergeStationPrices,
  MAP_NEARBY_RADIUS_KM,
  MAP_RADIUS_OPTIONS_KM,
  type MapRadiusKm,
  type MapViewMode,
} from '@/data/stations';

import { fetchStationsFromApi, type StationFromApi } from '@/lib/fetch-stations';
import { fetchSefazStatusFromApi, type SefazStatus } from '@/lib/fetch-sefaz-status';

import { loadCachedStations, saveCachedStations } from '@/lib/stations-cache';

import { getApiBaseUrl } from '@/constants/oauth';

import {
  clearAuthSession,
  restoreSessionUser,
  type AuthenticatedUser,
} from '@/lib/auth-session';

export type { AuthenticatedUser };



export interface PriceAlert {

  id: string;

  fuelType: FuelType;

  maxPrice: number;

  stationId?: string;

  active: boolean;

  createdAt: Date;

}



export interface UserContribution {

  stationId: string;

  fuelType: FuelType;

  price: number;

  date: Date;

}



export type StationsSource = 'loading' | 'api' | 'cache' | 'offline';



interface AppState {

  stations: Station[];

  favoriteIds: string[];

  alerts: PriceAlert[];

  contributions: UserContribution[];

  selectedFuelType: FuelType;

  sortBy: 'price' | 'distance' | 'rating';

  maxDistance: number;

  userLocation: { latitude: number; longitude: number } | null;

  comparatorIds: string[];

  user: AuthenticatedUser | null;

  mapViewMode: MapViewMode;

  mapRadiusKm: MapRadiusKm;

  mapLiveOnly: boolean;

}



type Action =

  | { type: 'TOGGLE_FAVORITE'; stationId: string }

  | { type: 'REPORT_PRICE'; stationId: string; fuelType: FuelType; price: number }

  | { type: 'ADD_ALERT'; alert: PriceAlert }

  | { type: 'TOGGLE_ALERT'; alertId: string }

  | { type: 'DELETE_ALERT'; alertId: string }

  | { type: 'SET_FUEL_TYPE'; fuelType: FuelType }

  | { type: 'SET_SORT'; sortBy: 'price' | 'distance' | 'rating' }

  | { type: 'SET_MAX_DISTANCE'; distance: number }

  | { type: 'SET_USER_LOCATION'; location: { latitude: number; longitude: number } }

  | { type: 'SET_COMPARATOR_IDS'; ids: string[] }

  | { type: 'SET_USER'; user: AuthenticatedUser | null }

  | { type: 'SET_MAP_VIEW_MODE'; mode: MapViewMode }

  | { type: 'SET_MAP_RADIUS_KM'; radiusKm: MapRadiusKm }

  | { type: 'SET_MAP_LIVE_ONLY'; liveOnly: boolean }

  | { type: 'HYDRATE'; state: Partial<AppState> };



const initialState: AppState = {

  stations: [],

  favoriteIds: [],

  alerts: [],

  contributions: [],

  selectedFuelType: 'gasolina',

  sortBy: 'price',

  maxDistance: 50,

  userLocation: null,

  comparatorIds: [],

  user: null,

  mapViewMode: 'distance',

  mapRadiusKm: MAP_NEARBY_RADIUS_KM as MapRadiusKm,

  mapLiveOnly: false,

};



function reducer(state: AppState, action: Action): AppState {

  switch (action.type) {

    case 'TOGGLE_FAVORITE': {

      const isFav = state.favoriteIds.includes(action.stationId);

      const favoriteIds = isFav

        ? state.favoriteIds.filter(id => id !== action.stationId)

        : [...state.favoriteIds, action.stationId];

      const stations = state.stations.map(s =>

        s.id === action.stationId ? { ...s, isFavorite: !isFav } : s

      );

      return { ...state, favoriteIds, stations };

    }

    case 'REPORT_PRICE': {

      const stations = state.stations.map(s => {

        if (s.id !== action.stationId) return s;

        const prices = s.prices.map(p =>

          p.type === action.fuelType

            ? {
                ...p,
                price: action.price,
                updatedAt: new Date(),
                confirmations: p.confirmations + 1,
                isLive: false,
                isReference: false,
                source: 'user' as const,
              }

            : p

        );

        const exists = prices.some(p => p.type === action.fuelType);

        if (!exists) {

          prices.push({
            type: action.fuelType,
            price: action.price,
            updatedAt: new Date(),
            confirmations: 1,
            isLive: false,
            isReference: false,
            source: 'user' as const,
          });

        }

        return { ...s, prices };

      });

      const contribution: UserContribution = {

        stationId: action.stationId,

        fuelType: action.fuelType,

        price: action.price,

        date: new Date(),

      };

      return { ...state, stations, contributions: [contribution, ...state.contributions] };

    }

    case 'ADD_ALERT':

      return { ...state, alerts: [...state.alerts, action.alert] };

    case 'TOGGLE_ALERT':

      return {

        ...state,

        alerts: state.alerts.map(a =>

          a.id === action.alertId ? { ...a, active: !a.active } : a

        ),

      };

    case 'DELETE_ALERT':

      return { ...state, alerts: state.alerts.filter(a => a.id !== action.alertId) };

    case 'SET_FUEL_TYPE':

      return { ...state, selectedFuelType: action.fuelType };

    case 'SET_SORT':

      return { ...state, sortBy: action.sortBy };

    case 'SET_MAX_DISTANCE':

      return { ...state, maxDistance: action.distance };

    case 'SET_USER_LOCATION':

      return { ...state, userLocation: action.location };

    case 'SET_COMPARATOR_IDS':

      return { ...state, comparatorIds: action.ids };

    case 'SET_USER':

      return { ...state, user: action.user };

    case 'SET_MAP_VIEW_MODE':

      return { ...state, mapViewMode: action.mode };

    case 'SET_MAP_RADIUS_KM':

      return { ...state, mapRadiusKm: action.radiusKm, maxDistance: action.radiusKm };

    case 'SET_MAP_LIVE_ONLY':

      return { ...state, mapLiveOnly: action.liveOnly };

    case 'HYDRATE':

      return { ...state, ...action.state };

    default:

      return state;

  }

}



function parseAmenities(value: string | string[] | null | undefined): string[] {

  if (Array.isArray(value)) return value;

  if (!value) return [];

  try {

    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];

  } catch {

    return [];

  }

}

const REFERENCE_FUEL_TYPES: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];
const DEFAULT_REFERENCE_PRICE: Record<FuelType, number> = {
  gasolina: 6.29,
  aditivada: 6.59,
  etanol: 4.59,
  diesel: 5.99,
  gnv: 4.89,
};

const CITY_REFERENCE_PRICE = REFERENCE_FUEL_TYPES.reduce<Record<FuelType, number>>((acc, fuelType) => {
  const prices = STATIONS
    .flatMap((station) => station.prices)
    .filter((price) => price.type === fuelType)
    .map((price) => price.price);
  acc[fuelType] = prices.length
    ? prices.reduce((sum, price) => sum + price, 0) / prices.length
    : DEFAULT_REFERENCE_PRICE[fuelType];
  return acc;
}, { ...DEFAULT_REFERENCE_PRICE });

function buildApiReferencePrice(data: StationFromApi[]): Record<FuelType, number> {
  return REFERENCE_FUEL_TYPES.reduce<Record<FuelType, number>>((acc, fuelType) => {
    const prices = data
      .flatMap((station) => station.prices ?? [])
      .filter((price) => price.type === fuelType)
      .map((price) => Number(price.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    acc[fuelType] = prices.length
      ? prices.reduce((sum, price) => sum + price, 0) / prices.length
      : CITY_REFERENCE_PRICE[fuelType];

    return acc;
  }, { ...CITY_REFERENCE_PRICE });
}

function stablePriceOffset(id: string, fuelType: FuelType): number {
  const seed = `${id}:${fuelType}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }
  return ((hash % 17) - 8) / 100;
}

function buildReferencePrices(
  stationId: string,
  existingPrices: FuelPrice[],
  referencePrice: Record<FuelType, number>,
): FuelPrice[] {
  const existingTypes = new Set(existingPrices.map((price) => price.type));
  const referenceDate = new Date();

  return REFERENCE_FUEL_TYPES
    .filter((fuelType) => !existingTypes.has(fuelType))
    .map((fuelType) => ({
      type: fuelType,
      price: Number((referencePrice[fuelType] + stablePriceOffset(stationId, fuelType)).toFixed(2)),
      updatedAt: referenceDate,
      confirmations: 0,
      isLive: false,
      isReference: true,
      source: 'reference' as const,
    }));
}



function mapApiStation(
  dbS: StationFromApi,
  favoriteIds: string[],
  referencePrice: Record<FuelType, number>,
): Station {
  const fallbackStation = STATIONS.find((station) => station.id === dbS.id);
  const fallbackPrices = fallbackStation?.prices ?? [];
  const amenities = parseAmenities(dbS.amenities);

  const livePrices = (dbS.prices ?? []).map((p) => ({

    type: p.type as FuelType,

    price: p.price,

    updatedAt: p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt),

    confirmations: p.confirmations,

    isLive: p.source === 'sefaz' || (p.source === undefined && (p.isLive ?? true)),
    source: p.source ?? (p.isLive === false ? 'user' : 'sefaz'),

  }));

  const referencePrices = buildReferencePrices(
    dbS.id,
    livePrices,
    referencePrice,
  );



  return {

    id: dbS.id,

    name: dbS.name,

    brand: dbS.brand,

    address: dbS.address,

    neighborhood: dbS.neighborhood && dbS.neighborhood !== 'Manaus'
      ? dbS.neighborhood
      : fallbackStation?.neighborhood ?? dbS.neighborhood,

    latitude: Number(dbS.latitude),

    longitude: Number(dbS.longitude),

    prices: mergeStationPrices(livePrices, referencePrices),

    reviews: [],

    priceHistory: fallbackStation?.priceHistory ?? { gasolina: [], etanol: [], diesel: [], gnv: [], aditivada: [] },

    amenities: amenities.length > 0
      ? amenities
      : fallbackStation?.amenities ?? [],

    isFavorite: favoriteIds.includes(dbS.id),

  };

}



const AppContext = createContext<{

  state: AppState;

  dispatch: React.Dispatch<Action>;

  stationsSource: StationsSource;
  sefazStatus: SefazStatus | null;

  apiBaseUrl: string;

  reloadStations: () => Promise<void>;

  authReady: boolean;

  logout: () => Promise<void>;

} | null>(null);



const STORAGE_KEY = '@fuelmap_state';



export function AppProvider({ children }: { children: React.ReactNode }) {

  const [state, dispatch] = useReducer(reducer, initialState);

  const [stationsSource, setStationsSource] = useState<StationsSource>('loading');
  const [sefazStatus, setSefazStatus] = useState<SefazStatus | null>(null);

  const [authReady, setAuthReady] = useState(false);

  const apiBaseUrl = getApiBaseUrl();

  const logout = useCallback(async () => {

    await clearAuthSession();

    dispatch({ type: 'SET_USER', user: null });

  }, []);



  const applyStationList = useCallback(
    (data: StationFromApi[], source: StationsSource) => {
      const referencePrice = buildApiReferencePrice(data);
      const mapped = data.map((dbS) => mapApiStation(dbS, state.favoriteIds, referencePrice));
      dispatch({ type: 'HYDRATE', state: { stations: mapped } });
      setStationsSource(source);
    },
    [state.favoriteIds],
  );

  const reloadStations = useCallback(async () => {

    setStationsSource('loading');

    try {

      const data = await fetchStationsFromApi();
      fetchSefazStatusFromApi()
        .then(setSefazStatus)
        .catch((err) => {
          console.warn('[App] Falha ao carregar status SEFAZ:', err);
          setSefazStatus(null);
        });

      if (!data.length) throw new Error('Lista de postos vazia');

      await saveCachedStations(data);

      applyStationList(data, 'api');

    } catch (err) {

      console.warn('[App] Falha ao carregar postos da API:', err, 'URL:', apiBaseUrl);

      const cached = await loadCachedStations();

      if (cached?.length) {

        applyStationList(cached, 'cache');

        return;

      }

      setStationsSource('offline');
      setSefazStatus(null);

      dispatch({

        type: 'HYDRATE',

        state: {

          stations: STATIONS.map((s) => ({

            ...s,

            isFavorite: state.favoriteIds.includes(s.id),

          })),

        },

      });

    }

  }, [apiBaseUrl, applyStationList, state.favoriteIds]);



  useEffect(() => {

    let mounted = true;

    const init = async () => {

      try {

        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        const saved = raw ? JSON.parse(raw) : null;

        const oauthUser = await restoreSessionUser();

        const hydrateState: Partial<AppState> = {};

        if (oauthUser) {

          hydrateState.user = oauthUser;

        } else if (saved?.user?.openId) {

          hydrateState.user = saved.user as AuthenticatedUser;

        }

        if (saved) {

          hydrateState.favoriteIds = saved.favoriteIds ?? [];

          hydrateState.alerts = (saved.alerts ?? []).map((a: PriceAlert) => ({

            ...a,

            createdAt: new Date(a.createdAt),

          }));

          hydrateState.contributions = (saved.contributions ?? []).map((c: UserContribution) => ({

            ...c,

            date: new Date(c.date),

          }));

          hydrateState.selectedFuelType = saved.selectedFuelType ?? 'gasolina';

          hydrateState.sortBy = saved.sortBy ?? 'price';

          hydrateState.maxDistance = saved.maxDistance ?? MAP_NEARBY_RADIUS_KM;

          hydrateState.comparatorIds = saved.comparatorIds ?? [];

          hydrateState.mapViewMode = saved.mapViewMode === 'all' ? 'all' : 'distance';

          hydrateState.mapRadiusKm = (MAP_RADIUS_OPTIONS_KM as readonly number[]).includes(saved.mapRadiusKm)

            ? (saved.mapRadiusKm as MapRadiusKm)

            : (MAP_NEARBY_RADIUS_KM as MapRadiusKm);

          hydrateState.mapLiveOnly = !!saved.mapLiveOnly;

        }

        if (mounted && Object.keys(hydrateState).length > 0) {

          dispatch({ type: 'HYDRATE', state: hydrateState });

        }

      } catch (err) {

        console.warn('[App] Falha ao inicializar sessão/prefs:', err);

      } finally {

        if (mounted) setAuthReady(true);

      }

    };

    init();

    return () => {

      mounted = false;

    };

  }, []);



  useEffect(() => {

    reloadStations();

  }, []);



  useEffect(() => {

    if (stationsSource !== 'api') return;

    const id = setInterval(() => reloadStations(), 3 * 60_000);

    return () => clearInterval(id);

  }, [stationsSource, reloadStations]);



  useEffect(() => {

    if (Platform.OS === 'web') return;

    const sub = RNAppState.addEventListener('change', (status) => {

      if (status === 'active') reloadStations();

    });

    return () => sub.remove();

  }, [reloadStations]);



  useEffect(() => {

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({

      favoriteIds: state.favoriteIds,

      alerts: state.alerts,

      contributions: state.contributions,

      selectedFuelType: state.selectedFuelType,

      sortBy: state.sortBy,

      maxDistance: state.maxDistance,

      comparatorIds: state.comparatorIds,

      mapViewMode: state.mapViewMode,

      mapRadiusKm: state.mapRadiusKm,

      mapLiveOnly: state.mapLiveOnly,

      user: state.user?.openId === 'demo-local' ? state.user : undefined,

    }));

  }, [
    state.favoriteIds,
    state.alerts,
    state.contributions,
    state.selectedFuelType,
    state.sortBy,
    state.maxDistance,
    state.comparatorIds,
    state.mapViewMode,
    state.mapRadiusKm,
    state.mapLiveOnly,
    state.user,
  ]);



  useEffect(() => {

    if (stationsSource !== 'api' || state.stations.length === 0) return;

    dispatch({

      type: 'HYDRATE',

      state: {

        stations: state.stations.map((s) => ({

          ...s,

          isFavorite: state.favoriteIds.includes(s.id),

        })),

      },

    });

  }, [state.favoriteIds, stationsSource]);



  useEffect(() => {

    let mounted = true;

    let subscription: Location.LocationSubscription | null = null;



    const startLocation = async () => {

      if (Platform.OS === 'web') return;



      try {

        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted' || !mounted) return;



        const current = await Location.getCurrentPositionAsync({

          accuracy: Location.Accuracy.Balanced,

        });



        if (mounted) {

          dispatch({

            type: 'SET_USER_LOCATION',

            location: {

              latitude: current.coords.latitude,

              longitude: current.coords.longitude,

            },

          });

        }



        subscription = await Location.watchPositionAsync(

          {

            accuracy: Location.Accuracy.Balanced,

            distanceInterval: 50,

            timeInterval: 8000,

          },

          (location) => {

            dispatch({

              type: 'SET_USER_LOCATION',

              location: {

                latitude: location.coords.latitude,

                longitude: location.coords.longitude,

              },

            });

          }

        );

      } catch {

        // sem GPS

      }

    };



    startLocation();



    return () => {

      mounted = false;

      subscription?.remove();

    };

  }, []);



  return (

    <AppContext.Provider value={{ state, dispatch, stationsSource, sefazStatus, apiBaseUrl, reloadStations, authReady, logout }}>

      {children}

    </AppContext.Provider>

  );

}



export function useApp() {

  const ctx = useContext(AppContext);

  if (!ctx) throw new Error('useApp must be used within AppProvider');

  return ctx;

}


