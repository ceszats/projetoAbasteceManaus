/** Cores oficiais aproximadas das bandeiras de postos */
export const STATION_BRAND_COLORS: Record<string, string> = {
  Ipiranga: '#FF6B00',
  Shell: '#DD1D21',
  BR: '#009B3A',
  Ale: '#0066CC',
  Bandeirante: '#6B21A8',
  'Raízen': '#DD1D21',
  Raizen: '#DD1D21',
};

export function getStationBrandColor(brand: string, fallback = '#15803D'): string {
  return STATION_BRAND_COLORS[brand] ?? fallback;
}
