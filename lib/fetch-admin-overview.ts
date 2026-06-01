import { getApiBaseUrl } from '@/constants/oauth';

export type AdminOverview = {
  stations: {
    total: number;
    withAnyPrice: number;
    withSefazPrice: number;
    withUserPrice: number;
    withoutPrice: number;
  };
  contributions: {
    total: number;
    sefaz: number;
    user: number;
    lastUserContribution: string | null;
    lastSefazContribution: string | null;
  };
  sefazStatus: {
    count: number;
    lastSync: string | null;
  };
};

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('URL da API nao configurada');

  const response = await fetch(`${base}/api/admin/overview`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }
  return response.json();
}
