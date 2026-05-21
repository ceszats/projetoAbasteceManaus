import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { STATIONS, Station, FuelType } from '@/data/stations';
import { trpc } from '@/lib/trpc';

export interface PriceAlert {
  id: string;
  fuelType: FuelType;
  maxPrice: number;
  stationId?: string; // undefined = qualquer posto
  active: boolean;
  createdAt: Date;
}

export interface UserContribution {
  stationId: string;
  fuelType: FuelType;
  price: number;
  date: Date;
}

export interface AuthenticatedUser {
  id: number;
  name: string | null;
  email: string | null;
  openId: string;
  profilePictureUrl?: string;
}

interface AppState {
  stations: Station[];
  favoriteIds: string[];
  alerts: PriceAlert[];
  contributions: UserContribution[];
  selectedFuelType: FuelType;
  sortBy: 'price' | 'distance' | 'rating';
  maxDistance: number; // km
  userLocation: { latitude: number; longitude: number } | null;
  comparatorIds: string[];
  user: AuthenticatedUser | null;
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
  | { type: 'HYDRATE'; state: Partial<AppState> };

const initialState: AppState = {
  stations: STATIONS,
  favoriteIds: [],
  alerts: [],
  contributions: [],
  selectedFuelType: 'gasolina',
  sortBy: 'price',
  maxDistance: 50,
  userLocation: null,
  comparatorIds: [],
  user: null,
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
            ? { ...p, price: action.price, updatedAt: new Date(), confirmations: p.confirmations + 1 }
            : p
        );
        // Se o tipo não existia, adiciona
        const exists = prices.some(p => p.type === action.fuelType);
        if (!exists) {
          prices.push({ type: action.fuelType, price: action.price, updatedAt: new Date(), confirmations: 1 });
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
    case 'HYDRATE':
      return { ...state, ...action.state };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

const STORAGE_KEY = '@fuelmap_state';

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Carregar estado salvo
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        dispatch({ type: 'HYDRATE', state: {
          favoriteIds: saved.favoriteIds ?? [],
          alerts: (saved.alerts ?? []).map((a: PriceAlert) => ({ ...a, createdAt: new Date(a.createdAt) })),
          contributions: (saved.contributions ?? []).map((c: UserContribution) => ({ ...c, date: new Date(c.date) })),
          selectedFuelType: saved.selectedFuelType ?? 'gasolina',
          sortBy: saved.sortBy ?? 'price',
          maxDistance: Math.max(saved.maxDistance ?? 50, 50),
          comparatorIds: saved.comparatorIds ?? [],
        }});
      } catch {}
    });
  }, []);

  // Buscar postos do banco via API
  const { data: dbStations } = trpc.stations.list.useQuery(undefined, {
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  useEffect(() => {
    if (dbStations && dbStations.length > 0) {
      const mappedStations = dbStations.map(dbS => ({
        ...STATIONS.find((station) => station.id === dbS.id),
        id: dbS.id,
        name: dbS.name,
        brand: dbS.brand,
        address: dbS.address,
        neighborhood: dbS.neighborhood,
        latitude: dbS.latitude,
        longitude: dbS.longitude,
        prices: dbS.prices.length > 0
          ? dbS.prices
          : (STATIONS.find((station) => station.id === dbS.id)?.prices ?? []),
        reviews: STATIONS.find((station) => station.id === dbS.id)?.reviews ?? [],
        priceHistory: STATIONS.find((station) => station.id === dbS.id)?.priceHistory ?? { gasolina: [], etanol: [], diesel: [], gnv: [], aditivada: [] },
        amenities: parseAmenities(dbS.amenities),
        isFavorite: state.favoriteIds.includes(dbS.id),
      }));
      
      // Mescla com os hardcoded para garantir que a UI tenha dados caso o banco esteja vazio
      // (opcional: podemos usar só o banco se preferir)
      dispatch({ type: 'HYDRATE', state: { stations: mappedStations } });
    }
  }, [dbStations]);

  // Persistir estado relevante
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      favoriteIds: state.favoriteIds,
      alerts: state.alerts,
      contributions: state.contributions,
      selectedFuelType: state.selectedFuelType,
      sortBy: state.sortBy,
      maxDistance: state.maxDistance,
      comparatorIds: state.comparatorIds,
    }));
  }, [state.favoriteIds, state.alerts, state.contributions, state.selectedFuelType, state.sortBy, state.maxDistance, state.comparatorIds]);

  // Captura a localizacao do usuario para ordenar/filtrar por distancia e centralizar mapa.
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
            distanceInterval: 25,
            timeInterval: 10000,
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
        // Mantem fallback para o centro de Manaus caso a localizacao falhe.
      }
    };

    startLocation();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
