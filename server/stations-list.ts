import * as db from "./db";

const FUEL_TYPES = ["gasolina", "aditivada", "etanol", "diesel", "gnv"] as const;
const SEFAZ_USER_ID = 0;
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;

function getContributionSource(row: Awaited<ReturnType<typeof db.getAllContributions>>[number]) {
  return row.source === "sefaz" || row.userId === SEFAZ_USER_ID ? "sefaz" : "user";
}

function summarizeStationPrices(rows: Awaited<ReturnType<typeof db.getAllContributions>>) {
  const grouped = new Map<string, Array<{ price: number; createdAt: Date; source: "sefaz" | "user" }>>();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const row of rows) {
    if (!FUEL_TYPES.includes(row.fuelType as (typeof FUEL_TYPES)[number])) continue;

    const price = Number.parseFloat(row.price);
    const createdAt = new Date(row.createdAt);
    if (!Number.isFinite(price) || Number.isNaN(createdAt.getTime())) continue;

    const key = `${row.stationId}:${row.fuelType}`;
    const items = grouped.get(key) ?? [];
    items.push({ price, createdAt, source: getContributionSource(row) });
    grouped.set(key, items);
  }

  const byStation = new Map<
    string,
    Array<{
      type: (typeof FUEL_TYPES)[number];
      price: number;
      updatedAt: Date;
      confirmations: number;
      isLive: true;
      source: "sefaz" | "user";
    }>
  >();

  for (const [key, items] of grouped) {
    const [stationId, fuelType] = key.split(":") as [string, (typeof FUEL_TYPES)[number]];
    const recent = items.filter((item) => item.createdAt.getTime() >= cutoff);
    const sample = recent.length > 0 ? recent : items;
    const sorted = sample.map((item) => item.price).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const updatedAt = sample.reduce(
      (latest, item) => (item.createdAt > latest ? item.createdAt : latest),
      sample[0].createdAt,
    );
    const source = sample.some((item) => item.source === "sefaz") ? "sefaz" : "user";

    const prices = byStation.get(stationId) ?? [];
    prices.push({
      type: fuelType,
      price: Number(median.toFixed(2)),
      updatedAt,
      confirmations: sample.length,
      isLive: true,
      source,
    });
    byStation.set(stationId, prices);
  }

  return byStation;
}

export async function getSefazStatus() {
  const contributions = await db.getAllContributions();
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  const sefazRows = contributions.filter((row) => {
    const createdAt = new Date(row.createdAt).getTime();
    return getContributionSource(row) === "sefaz" && Number.isFinite(createdAt) && createdAt >= cutoff;
  });

  const lastSync = sefazRows.length > 0
    ? sefazRows.reduce((latest, row) => (
        row.createdAt.localeCompare(latest) > 0 ? row.createdAt : latest
      ), sefazRows[0].createdAt)
    : null;

  return {
    count: sefazRows.length,
    lastSync,
  };
}

export async function listStationsWithPrices() {
  const [stations, contributions] = await Promise.all([
    db.getAllStations(),
    db.getAllContributions(),
  ]);
  const pricesByStation = summarizeStationPrices(contributions);

  return stations
    .filter((station) => !/^pre.o recente$/i.test(station.name))
    .map((station) => ({
      ...station,
      latitude: Number(station.latitude),
      longitude: Number(station.longitude),
      prices: pricesByStation.get(station.id) ?? [],
    }));
}
