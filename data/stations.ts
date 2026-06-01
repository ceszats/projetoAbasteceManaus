import { RAW_STATIONS } from './stations-mock-data';

export type FuelType = 'gasolina' | 'aditivada' | 'etanol' | 'diesel' | 'gnv';
export type PriceSource = 'sefaz' | 'user' | 'reference' | 'catalog';

export interface FuelPrice {
  type: FuelType;
  price: number;
  updatedAt: Date;
  confirmations: number;
  /** Preço vindo do banco / SEFAZ */
  isLive?: boolean;
  /** Preço estimado de referência quando não há SEFAZ/catálogo para o posto. */
  isReference?: boolean;
  source?: PriceSource;
}

export type PriceConfidence = 'confirmed' | 'recent' | 'outdated';

export interface StationReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: Date;
}

export interface PriceHistory {
  date: Date;
  price: number;
}

export interface Station {
  id: string;
  name: string;
  brand: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  prices: FuelPrice[];
  reviews: StationReview[];
  priceHistory: { [key in FuelType]?: PriceHistory[] };
  amenities: string[];
  isFavorite?: boolean;
  distance?: number; // km, calculado dinamicamente
}

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
const MOCK_PRICE_AGES_HOURS = [2, 5, 9, 14, 20, 28, 36, 44, 54, 72];

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const MANAUS_NEIGHBORHOOD_CENTERS = [
  { name: 'Centro', latitude: -3.1342, longitude: -60.0233 },
  { name: 'Adrianopolis', latitude: -3.1038, longitude: -60.0037 },
  { name: 'Nossa Senhora das Gracas', latitude: -3.1054, longitude: -60.0231 },
  { name: 'Aleixo', latitude: -3.0806, longitude: -59.9914 },
  { name: 'Parque 10 de Novembro', latitude: -3.0742, longitude: -60.0148 },
  { name: 'Chapada', latitude: -3.0912, longitude: -60.0237 },
  { name: 'Flores', latitude: -3.0516, longitude: -60.0044 },
  { name: 'Cidade Nova', latitude: -3.0295, longitude: -59.9956 },
  { name: 'Novo Aleixo', latitude: -3.0363, longitude: -59.9549 },
  { name: 'Tancredo Neves', latitude: -3.0551, longitude: -59.9361 },
  { name: 'Sao Jose Operario', latitude: -3.0872, longitude: -59.9465 },
  { name: 'Coroado', latitude: -3.0839, longitude: -59.9722 },
  { name: 'Japiim', latitude: -3.1181, longitude: -59.9909 },
  { name: 'Distrito Industrial', latitude: -3.1259, longitude: -59.9648 },
  { name: 'Raiz', latitude: -3.1162, longitude: -60.0028 },
  { name: 'Cachoeirinha', latitude: -3.1122, longitude: -60.0157 },
  { name: 'Sao Francisco', latitude: -3.1027, longitude: -60.0116 },
  { name: 'Petropolis', latitude: -3.1011, longitude: -59.9983 },
  { name: 'Educandos', latitude: -3.1374, longitude: -60.0141 },
  { name: 'Armando Mendes', latitude: -3.0977, longitude: -59.9309 },
  { name: 'Jorge Teixeira', latitude: -3.0366, longitude: -59.9294 },
  { name: 'Zumbi dos Palmares', latitude: -3.0687, longitude: -59.9394 },
  { name: 'Ponta Negra', latitude: -3.0736, longitude: -60.1021 },
  { name: 'Taruma', latitude: -3.0105, longitude: -60.0799 },
  { name: 'Taruma-Acu', latitude: -2.9656, longitude: -60.0711 },
  { name: 'Redencao', latitude: -3.0539, longitude: -60.0449 },
  { name: 'Alvorada', latitude: -3.0829, longitude: -60.0529 },
  { name: 'Dom Pedro', latitude: -3.0897, longitude: -60.0441 },
  { name: 'Compensa', latitude: -3.1079, longitude: -60.0612 },
  { name: 'Santo Agostinho', latitude: -3.0951, longitude: -60.0701 },
  { name: 'Planalto', latitude: -3.0687, longitude: -60.0657 },
  { name: 'Colonia Santo Antonio', latitude: -3.0143, longitude: -60.0572 },
  { name: 'Santa Etelvina', latitude: -2.9936, longitude: -60.0281 },
  { name: 'Lago Azul', latitude: -2.9568, longitude: -60.0218 },
  { name: 'Colonia Terra Nova', latitude: -2.9831, longitude: -60.0562 },
  { name: 'Monte das Oliveiras', latitude: -2.9902, longitude: -60.0079 },
  { name: 'Nova Cidade', latitude: -2.9948, longitude: -59.9856 },
  { name: 'Novo Israel', latitude: -3.0018, longitude: -60.0442 },
] as const;

const ADDRESS_NEIGHBORHOODS: Array<{ match: string; neighborhood: string }> = [
  { match: 'nossa sra das gracas', neighborhood: 'Nossa Senhora das Gracas' },
  { match: 'nossa senhora das gracas', neighborhood: 'Nossa Senhora das Gracas' },
  { match: 'djalma batista 535', neighborhood: 'Nossa Senhora das Gracas' },
  { match: 'avenida tancredo neves', neighborhood: 'Parque 10 de Novembro' },
  { match: 'avenida cosme ferreira', neighborhood: 'Sao Jose Operario' },
  { match: 'avenida arquiteto jose henriques bento rodrigues', neighborhood: 'Monte das Oliveiras' },
  { match: 'avenida general rodrigo otavio', neighborhood: 'Japiim' },
  { match: 'rua conde de sergimirim', neighborhood: 'Raiz' },
  { match: 'avenida autaz mirim', neighborhood: 'Sao Jose Operario' },
  { match: 'avenida torquato tapajos', neighborhood: 'Santa Etelvina' },
  { match: 'rua valerio botelho de andrade', neighborhood: 'Cachoeirinha' },
  { match: 'avenida do turismo', neighborhood: 'Taruma' },
  { match: 'avenida jacira reis', neighborhood: 'Dom Pedro' },
];

export function getStationNeighborhood(station: Station): string {
  const normalizedAddress = normalizeSearchText(station.address);
  const addressMatch = ADDRESS_NEIGHBORHOODS.find(({ match }) =>
    normalizedAddress.includes(match),
  );

  if (addressMatch) return addressMatch.neighborhood;
  if (station.neighborhood && station.neighborhood !== 'Manaus') return station.neighborhood;

  return MANAUS_NEIGHBORHOOD_CENTERS.reduce((closest, current) => {
    const currentDistance = calculateDistance(
      station.latitude,
      station.longitude,
      current.latitude,
      current.longitude,
    );
    const closestDistance = calculateDistance(
      station.latitude,
      station.longitude,
      closest.latitude,
      closest.longitude,
    );
    return currentDistance < closestDistance ? current : closest;
  }).name;
}

export function stationMatchesSearch(station: Station, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const neighborhood = getStationNeighborhood(station);
  const haystack = [station.name, station.brand, station.address, station.neighborhood, neighborhood]
    .map(normalizeSearchText)
    .join(' ');

  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length <= 1) {
    return haystack.includes(q);
  }
  return tokens.every((token) => haystack.includes(token));
}

/** Preços do banco (SEFAZ) substituem mock por tipo de combustível. */
export function mergeStationPrices(livePrices: FuelPrice[], fallbackPrices: FuelPrice[] = []): FuelPrice[] {
  const byType = new Map<FuelType, FuelPrice>();
  for (const price of fallbackPrices) {
    byType.set(price.type, {
      ...price,
      updatedAt: price.updatedAt instanceof Date ? price.updatedAt : new Date(price.updatedAt),
    });
  }
  for (const price of livePrices) {
    byType.set(price.type, {
      ...price,
      isLive: price.isLive ?? price.source === 'sefaz',
      source: price.source ?? (price.isLive ? 'sefaz' : 'user'),
      updatedAt: price.updatedAt instanceof Date ? price.updatedAt : new Date(price.updatedAt),
    });
  }
  return Array.from(byType.values());
}

function getMockPriceUpdatedAt(stationIndex: number, priceIndex: number) {
  const ageIndex = (stationIndex + priceIndex * 2) % MOCK_PRICE_AGES_HOURS.length;
  return hoursAgo(MOCK_PRICE_AGES_HOURS[ageIndex]);
}

function getMockConfirmations(stationIndex: number, priceIndex: number, current: number) {
  const ageIndex = (stationIndex + priceIndex * 2) % MOCK_PRICE_AGES_HOURS.length;
  if (ageIndex <= 4) return Math.max(current, 2 + ((stationIndex + priceIndex) % 4));
  if (ageIndex <= 7) return Math.max(current, 1 + ((stationIndex + priceIndex) % 3));
  return Math.max(1, current);
}

export const STATIONS: Station[] = RAW_STATIONS.map((station, stationIndex) => ({
  ...station,
  neighborhood: getStationNeighborhood(station),
  prices: station.prices.map((price, priceIndex) => ({
    ...price,
    updatedAt: getMockPriceUpdatedAt(stationIndex, priceIndex),
    confirmations: getMockConfirmations(stationIndex, priceIndex, price.confirmations),
  })),
}));

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  gasolina: 'Gasolina',
  aditivada: 'Aditivada',
  etanol: 'Etanol',
  diesel: 'Diesel',
  gnv: 'GNV',
};

export const FUEL_TYPE_ICONS: Record<FuelType, string> = {
  gasolina: 'G',
  aditivada: 'A',
  etanol: 'E',
  diesel: 'D',
  gnv: 'GNV',
};

export function getPriceCategory(price: number): 'cheap' | 'medium' | 'expensive' {
  if (price <= 6.05) return 'cheap';
  if (price <= 6.30) return 'medium';
  return 'expensive';
}

export function getPriceCategoryColor(category: 'cheap' | 'medium' | 'expensive', scheme: 'light' | 'dark' = 'light'): string {
  const colors = {
    cheap: scheme === 'light' ? '#15803D' : '#22C55E',
    medium: scheme === 'light' ? '#F59E0B' : '#FBBF24',
    expensive: scheme === 'light' ? '#DC2626' : '#F87171',
  };
  return colors[category];
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function isOutdated(date: Date | string): boolean {
  const hoursOld = (Date.now() - toDate(date).getTime()) / (1000 * 60 * 60);
  return hoursOld > 48;
}

export function getPriceConfidence(price: FuelPrice): PriceConfidence {
  const hoursOld = (Date.now() - toDate(price.updatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursOld <= 24 && price.confirmations >= 2) return 'confirmed';
  if (hoursOld <= 48) return 'recent';
  return 'outdated';
}

export function formatTimeAgo(date: Date | string): string {
  const minutes = Math.floor((Date.now() - toDate(date).getTime()) / (1000 * 60));
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function getLowestPrice(station: Station, fuelType: FuelType = 'gasolina'): FuelPrice | undefined {
  return station.prices.find(p => p.type === fuelType);
}

export function getPriceSource(price?: FuelPrice): PriceSource {
  if (!price) return 'catalog';
  if (price.source) return price.source;
  if (price.isLive) return 'sefaz';
  if (price.isReference) return 'reference';
  return 'user';
}

export function getPriceSourceLabel(price?: FuelPrice): string {
  const source = getPriceSource(price);
  if (source === 'sefaz') return 'SEFAZ';
  if (source === 'user') return 'usuario';
  if (source === 'reference') return 'referencia';
  return 'catalogo';
}

/** Raio padrão do mapa */
export const MAP_NEARBY_RADIUS_KM = 20;
export const MAP_RADIUS_OPTIONS_KM = [10, 20, 30, 50] as const;
export type MapRadiusKm = (typeof MAP_RADIUS_OPTIONS_KM)[number];
/** Busca por bairro pode abranger mais área */
export const MAP_SEARCH_RADIUS_KM = 40;
export const MAP_MIN_NEARBY_STATIONS = 24;
export const MAP_NEARBY_BACKFILL_RADIUS_KM = 50;

export type MapViewMode = 'distance' | 'all';

/** Área aproximada de Manaus para modo "todos os postos" */
export const MANAUS_BBOX = {
  minLat: -3.18,
  maxLat: -2.92,
  minLng: -60.18,
  maxLng: -59.82,
};

/** Modo "todos" usa clustering — limite alto só para performance */
export const MAP_ALL_MODE_MAX_STATIONS = 400;

export type MapPinTier = 'live' | 'user' | 'reference' | 'catalog';

export type MapStationView = Station & {
  mapPinTier: MapPinTier;
};

function stationCoords(station: Station) {
  return {
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
  };
}

function inManausBBox(latitude: number, longitude: number): boolean {
  return (
    latitude >= MANAUS_BBOX.minLat &&
    latitude <= MANAUS_BBOX.maxLat &&
    longitude >= MANAUS_BBOX.minLng &&
    longitude <= MANAUS_BBOX.maxLng
  );
}

function buildMapRows(
  stations: Station[],
  fuelType: FuelType,
  anchor: { latitude: number; longitude: number },
  liveOnly: boolean,
) {
  const anchorLat = Number(anchor.latitude);
  const anchorLng = Number(anchor.longitude);

  return stations
    .map((station) => {
      const coords = stationCoords(station);
      const price = station.prices.find((p) => p.type === fuelType);
      const mapPinTier: MapPinTier = price?.source === 'sefaz' || price?.isLive
        ? 'live'
        : price?.source === 'user'
          ? 'user'
          : price
            ? 'reference'
            : 'catalog';
      if (liveOnly && mapPinTier !== 'live') return null;

      return {
        station,
        distance: calculateDistance(anchorLat, anchorLng, coords.latitude, coords.longitude),
        mapPinTier,
      };
    })
    .filter((row): row is { station: Station; distance: number; mapPinTier: MapPinTier } => row !== null);
}

export function filterStationsForMap(
  stations: Station[],
  fuelType: FuelType,
  anchor: { latitude: number; longitude: number },
  options?: {
    viewMode?: MapViewMode;
    searchQuery?: string;
    radiusKm?: number;
    searchRadiusKm?: number;
    /** Se true, oculta postos sem preço SEFAZ recente */
    liveOnly?: boolean;
  },
): MapStationView[] {
  const viewMode = options?.viewMode ?? 'distance';
  const radiusKm = options?.radiusKm ?? MAP_NEARBY_RADIUS_KM;
  const searchRadiusKm = options?.searchRadiusKm ?? MAP_SEARCH_RADIUS_KM;
  const query = options?.searchQuery?.trim() ?? '';
  const liveOnly = options?.liveOnly ?? false;
  const withFuel = buildMapRows(stations, fuelType, anchor, liveOnly);
  const withinRadius = (distance: number, limitKm: number) => distance <= limitKm;

  if (query) {
    const matched = withFuel.filter(({ station, distance }) => {
      if (!stationMatchesSearch(station, query)) return false;
      if (viewMode === 'all') return inManausBBox(station.latitude, station.longitude);
      return withinRadius(distance, Math.max(radiusKm, searchRadiusKm));
    });
    return matched
      .sort((a, b) => a.distance - b.distance)
      .map(({ station, distance, mapPinTier }) => ({ ...station, distance, mapPinTier }));
  }

  if (viewMode === 'all') {
    const inCity = withFuel.filter(({ station }) =>
      inManausBBox(station.latitude, station.longitude),
    );
    const sorted = [...inCity].sort((a, b) => a.distance - b.distance);
    return sorted.slice(0, MAP_ALL_MODE_MAX_STATIONS).map(({ station, distance, mapPinTier }) => ({
      ...station,
      distance,
      mapPinTier,
    }));
  }

  const inRadius = withFuel.filter(({ distance }) => withinRadius(distance, radiusKm));
  const rows = query
    ? inRadius
    : inRadius.length >= MAP_MIN_NEARBY_STATIONS
      ? inRadius
      : withFuel
          .filter(({ distance }) => withinRadius(distance, Math.max(radiusKm, MAP_NEARBY_BACKFILL_RADIUS_KM)))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, Math.min(MAP_MIN_NEARBY_STATIONS, withFuel.length));

  return rows
    .sort((a, b) => a.distance - b.distance)
    .map(({ station, distance, mapPinTier }) => ({ ...station, distance, mapPinTier }));
}

/** Lista alinhada aos filtros do mapa */
export function filterStationsForList(
  stations: Station[],
  fuelType: FuelType,
  anchor: { latitude: number; longitude: number },
  options?: {
    viewMode?: MapViewMode;
    radiusKm?: number;
    searchRadiusKm?: number;
    liveOnly?: boolean;
    searchQuery?: string;
    selectedBrand?: string | null;
  },
): Array<Station & { distance: number }> {
  const viewMode = options?.viewMode ?? 'distance';
  const radiusKm = options?.radiusKm ?? MAP_NEARBY_RADIUS_KM;
  const searchRadiusKm = options?.searchRadiusKm ?? MAP_SEARCH_RADIUS_KM;
  const liveOnly = options?.liveOnly ?? false;
  const query = options?.searchQuery?.trim() ?? '';
  const anchorLat = Number(anchor.latitude);
  const anchorLng = Number(anchor.longitude);

  let list = stations
    .map((station) => ({
      ...station,
      distance: calculateDistance(
        anchorLat,
        anchorLng,
        Number(station.latitude),
        Number(station.longitude),
      ),
    }))
    .filter((station) => {
      const price = station.prices.find((p) => p.type === fuelType);
      if (!price) return false;
      if (liveOnly && !price.isLive) return false;
      return true;
    });

  if (options?.selectedBrand) {
    list = list.filter((s) => s.brand === options.selectedBrand);
  }

  if (query) {
    list = list.filter((s) => stationMatchesSearch(s, query));
    if (viewMode === 'distance') {
      list = list.filter((s) => s.distance <= searchRadiusKm);
    } else {
      list = list.filter((s) => inManausBBox(s.latitude, s.longitude));
    }
  } else if (viewMode === 'distance') {
    list = list.filter((s) => s.distance <= radiusKm);
  } else {
    list = list.filter((s) => inManausBBox(s.latitude, s.longitude));
  }

  return list;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Localização central de Manaus para referência
export const MANAUS_CENTER = {
  latitude: -3.1019,
  longitude: -60.0250,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
