import { getApiBaseUrl } from '@/constants/oauth';
import type { FuelType } from '@/data/stations';

export async function reportStationPrice(input: {
  stationId: string;
  fuelType: FuelType;
  price: number;
}) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('URL da API nao configurada');

  const response = await fetch(`${base}/api/contributions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error ?? `API ${response.status}`);
  }

  return data as { id: number; source: 'user'; createdAt: string };
}
