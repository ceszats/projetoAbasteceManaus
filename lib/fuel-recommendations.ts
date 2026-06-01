import type { FuelType, Station } from '@/data/stations';

export const DEFAULT_TANK_LITERS = 40;
export const DEFAULT_CONSUMPTION_KM_PER_L = 10;

export type StationWithDistance = Station & { distance?: number };

export type RecommendationResult = {
  cheapest: StationWithDistance | null;
  nearest: StationWithDistance | null;
  bestValue: StationWithDistance | null;
};

export type EconomyEstimate = {
  grossSavings: number;
  travelCost: number;
  netSavings: number;
  extraDistanceKm: number;
};

export function getFuelPrice(station: StationWithDistance, fuelType: FuelType): number | null {
  return station.prices.find((price) => price.type === fuelType)?.price ?? null;
}

export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function stationDistance(station: StationWithDistance): number {
  return station.distance ?? Number.POSITIVE_INFINITY;
}

function tripFuelCost(distanceKm: number, fuelPrice: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const roundTripKm = distanceKm * 2;
  return (roundTripKm / DEFAULT_CONSUMPTION_KM_PER_L) * fuelPrice;
}

export function buildFuelRecommendations(
  stations: StationWithDistance[],
  fuelType: FuelType,
): RecommendationResult {
  const priced = stations.filter((station) => getFuelPrice(station, fuelType) !== null);

  if (priced.length === 0) {
    return { cheapest: null, nearest: null, bestValue: null };
  }

  const cheapest = [...priced].sort((a, b) => {
    return (getFuelPrice(a, fuelType) ?? 999) - (getFuelPrice(b, fuelType) ?? 999);
  })[0];

  const nearest = [...priced].sort((a, b) => stationDistance(a) - stationDistance(b))[0];

  const bestValue = [...priced].sort((a, b) => {
    const priceA = getFuelPrice(a, fuelType) ?? 999;
    const priceB = getFuelPrice(b, fuelType) ?? 999;
    const totalA = priceA * DEFAULT_TANK_LITERS + tripFuelCost(stationDistance(a), priceA);
    const totalB = priceB * DEFAULT_TANK_LITERS + tripFuelCost(stationDistance(b), priceB);
    return totalA - totalB;
  })[0];

  return { cheapest, nearest, bestValue };
}

export function estimateEconomyAgainstNearest(
  station: StationWithDistance | null,
  nearest: StationWithDistance | null,
  fuelType: FuelType,
): EconomyEstimate | null {
  if (!station || !nearest || station.id === nearest.id) return null;

  const targetPrice = getFuelPrice(station, fuelType);
  const nearestPrice = getFuelPrice(nearest, fuelType);
  if (targetPrice === null || nearestPrice === null) return null;

  const targetDistance = stationDistance(station);
  const nearestDistance = stationDistance(nearest);
  const extraDistanceKm = Math.max(0, targetDistance - nearestDistance);
  const grossSavings = (nearestPrice - targetPrice) * DEFAULT_TANK_LITERS;
  const travelCost = tripFuelCost(extraDistanceKm, targetPrice);
  const netSavings = grossSavings - travelCost;

  return {
    grossSavings,
    travelCost,
    netSavings,
    extraDistanceKm,
  };
}
