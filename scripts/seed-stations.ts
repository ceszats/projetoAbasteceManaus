/**
 * seed-stations.ts
 *
 * Script de seed único — busca todos os postos de combustível de Manaus
 * via Overpass API (OpenStreetMap) e popula a tabela `stations` no banco.
 *
 * Executar: npx tsx scripts/seed-stations.ts
 *
 * Não precisa de chave de API. A Overpass API é pública e gratuita.
 */

import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { stations } from "../drizzle/schema";

// ---------------------------------------------------------------------------
// Conexão direta ao banco (sem passar pelo servidor Express)
// ---------------------------------------------------------------------------

const DB_PATH = (process.env.DATABASE_URL ?? "file:./drizzle/db.sqlite").replace("file:", "");
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);

// ---------------------------------------------------------------------------
// Tipos da resposta Overpass
// ---------------------------------------------------------------------------

interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassWay {
  type: "way";
  id: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

type OverpassElement = OverpassNode | OverpassWay;

// ---------------------------------------------------------------------------
// Mapeia brand OSM → brand padronizado
// ---------------------------------------------------------------------------

function normalizeBrand(raw?: string): string {
  if (!raw) return "Independente";
  const upper = raw.toUpperCase();
  if (upper.includes("IPIRANGA")) return "Ipiranga";
  if (upper.includes("SHELL")) return "Shell";
  if (upper.includes("PETROBRAS") || upper === "BR") return "BR";
  if (upper.includes("ATEM")) return "Atem";
  if (upper.includes("ALE")) return "Ale";
  if (upper.includes("RAIZEN") || upper.includes("RAÍZEN")) return "Raízen";
  if (upper.includes("EQUADOR")) return "Equador";
  if (upper.includes("BANDEIRANTE")) return "Bandeirante";
  return raw;
}

function extractAmenities(tags?: Record<string, string>): string[] {
  if (!tags) return [];
  const amenities: string[] = [];
  if (tags["shop"] === "convenience" || tags["amenity"] === "convenience") amenities.push("Conveniência");
  if (tags["car_wash"] === "yes") amenities.push("Lava-Car");
  if (tags["compressed_air"] === "yes") amenities.push("Ar/Água");
  if (tags["toilets"] === "yes") amenities.push("Banheiro");
  if (tags["hgv"] === "yes" || tags["hgv:local"] === "yes") amenities.push("Caminhões");
  return amenities;
}

// ---------------------------------------------------------------------------
// Busca postos via Overpass API
// ---------------------------------------------------------------------------

async function fetchOverpassStations(): Promise<OverpassElement[]> {
  const query = `
    [out:json][timeout:60];
    area[name="Manaus"]["admin_level"="8"]->.manaus;
    (
      node["amenity"="fuel"](area.manaus);
      way["amenity"="fuel"](area.manaus);
    );
    out center tags;
  `;

  console.log("[Seed] Buscando postos na Overpass API...");

  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: {
      "User-Agent": "FuelMapManaus/1.0 (app publico; contato@fuelmap.app)",
      "Accept": "*/*"
    },
    signal: AbortSignal.timeout(65_000),
  });

  if (!res.ok) throw new Error(`Overpass API: HTTP ${res.status}`);

  const json = await res.json();
  return json.elements as OverpassElement[];
}

// ---------------------------------------------------------------------------
// Converte elemento OSM → formato Station do banco
// ---------------------------------------------------------------------------

function elementToStation(el: OverpassElement): typeof stations.$inferInsert | null {
  const tags = el.tags ?? {};

  // Coordenadas
  let lat: number, lon: number;
  if (el.type === "node") {
    lat = el.lat;
    lon = el.lon;
  } else if (el.type === "way" && el.center) {
    lat = el.center.lat;
    lon = el.center.lon;
  } else {
    return null; // way sem centro — pular
  }

  // Filtro extra: confirmar que está em Manaus (bounding box aproximado)
  if (lat < -3.3 || lat > -2.8 || lon < -60.3 || lon > -59.7) return null;

  const osmId = `osm-${el.id}`;
  const brand = normalizeBrand(tags["brand"] ?? tags["operator"]);
  const name = tags["name"] ?? tags["brand"] ?? tags["operator"] ?? `Posto ${brand}`;
  const street = tags["addr:street"] ?? tags["addr:full"] ?? "Endereço não cadastrado";
  const number = tags["addr:housenumber"] ?? "";
  const address = number ? `${street}, ${number}` : street;
  const neighborhood = tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? "Manaus";
  const amenities = JSON.stringify(extractAmenities(tags));

  return {
    id: osmId,
    osmId,
    name,
    brand,
    address,
    neighborhood,
    latitude: lat,
    longitude: lon,
    cnpj: null,
    amenities,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[Seed] Iniciando seed de postos via Overpass API...\n");

  let elements: OverpassElement[];
  try {
    elements = await fetchOverpassStations();
  } catch (err) {
    console.error("[Seed] Falha ao buscar Overpass:", err);
    process.exit(1);
  }

  console.log(`[Seed] ${elements.length} elementos encontrados no OSM\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const el of elements) {
    const station = elementToStation(el);
    if (!station) { skipped++; continue; }

    try {
      await db.insert(stations).values(station).onConflictDoUpdate({
        target: stations.id,
        set: {
          name: station.name,
          brand: station.brand,
          address: station.address,
          neighborhood: station.neighborhood,
          latitude: station.latitude,
          longitude: station.longitude,
          amenities: station.amenities,
          osmId: station.osmId,
        },
      });
      inserted++;
    } catch (err) {
      console.error(`[Seed] Erro ao inserir ${station.id}:`, err);
      errors++;
    }
  }

  console.log(`\n[Seed] Concluído!`);
  console.log(`  ✅ Inseridos/atualizados: ${inserted}`);
  console.log(`  ⏭  Ignorados:             ${skipped}`);
  console.log(`  ❌ Erros:                 ${errors}`);
  console.log(`\nPróximo passo: npm run db:push (se ainda não rodou a migration)`);

  sqlite.close();
}

main().catch(err => {
  console.error("[Seed] Erro fatal:", err);
  process.exit(1);
});
