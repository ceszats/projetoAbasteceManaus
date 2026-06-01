import { getApiBaseUrl } from '@/constants/oauth';
import type { FuelType } from '@/data/stations';
import { apiCall } from '@/lib/_core/api';

export async function reportStationPrice(input: {
  stationId: string;
  fuelType: FuelType;
  price: number;
}) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('URL da API nao configurada');

  return apiCall<{ id: number; source: 'user'; createdAt: string }>('/api/contributions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
