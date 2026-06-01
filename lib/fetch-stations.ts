import { getApiBaseUrl } from '@/constants/oauth';
import type { FuelType } from '@/data/stations';

export type StationFromApi = {
  id: string;
  name: string;
  brand: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  amenities: string | string[] | null;
  prices: Array<{
    type: FuelType;
    price: number;
    updatedAt: string | Date;
    confirmations: number;
    isLive?: boolean;
    source?: 'sefaz' | 'user';
  }>;
};

export async function fetchStationsFromApi(): Promise<StationFromApi[]> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('URL da API não configurada');

  const res = await fetch(`${base}/api/stations`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Resposta inválida da API');
  }

  return data;
}
