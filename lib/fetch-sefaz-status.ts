import { getApiBaseUrl } from '@/constants/oauth';

export type SefazStatus = {
  count: number;
  lastSync: string | null;
};

export async function fetchSefazStatusFromApi(): Promise<SefazStatus> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('URL da API não configurada');

  const res = await fetch(`${base}/api/sefaz/status`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }

  const data = await res.json();
  return {
    count: Number(data?.count ?? 0),
    lastSync: typeof data?.lastSync === 'string' ? data.lastSync : null,
  };
}
