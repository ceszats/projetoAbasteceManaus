/**
 * sefaz-sync.ts
 *
 * Sincroniza preços de combustível do Busca Preço Amazonas (SEFAZ/AM).
 * Os dados vêm de NFC-e emitidas pelos postos, via Elasticsearch público.
 *
 * Convenções:
 *  - userId = 0  → contribuição automática (não é um usuário real)
 *  - createdAt   → dataEmissao da NFC-e (não o timestamp atual)
 *  - stationId   → id do posto em data/stations.ts ou "cnpj-{CNPJ}" como fallback
 */

import { getDb, hasSefazContribution, pruneSefazContributions } from "./db";
import { contributions, stations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { Agent } from "undici";

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// Limites de sanidade por combustível (rejeita valores absurdos)
// ---------------------------------------------------------------------------

const PRICE_LIMITS: Record<string, { min: number; max: number }> = {
  gasolina:  { min: 4.00, max: 10.00 },
  aditivada: { min: 4.50, max: 11.00 },
  etanol:    { min: 3.00, max: 8.00  },
  diesel:    { min: 4.00, max: 10.00 },
  gnv:       { min: 3.00, max: 8.00  },
};

// ---------------------------------------------------------------------------
// Mapeamento de produtos SEFAZ → fuelType do app
// ---------------------------------------------------------------------------

const FUEL_MAP: { query: string; fuelType: string }[] = [
  { query: "GASOLINA COMUM",     fuelType: "gasolina"  },
  { query: "GASOLINA ADITIVADA", fuelType: "aditivada" },
  { query: "ETANOL HIDRATADO",   fuelType: "etanol"    },
  { query: "OLEO DIESEL S10",    fuelType: "diesel"    },
  { query: "GAS NATURAL VEICULAR", fuelType: "gnv"     },
];

// ---------------------------------------------------------------------------
// Overrides manuais: nome da empresa SEFAZ → stationId do app
// Adicione entradas conforme identificar postos não matcheados pelo CNPJ
// ---------------------------------------------------------------------------

const NAME_OVERRIDES: Record<string, string> = {
  // Ex: "ATEM DISTRIBUIDORA DE COMBUSTIVEIS LTDA": "osm-1366693707",
};

// ---------------------------------------------------------------------------
// Match de postos
// ---------------------------------------------------------------------------

interface SefazHit {
  nomeProduto: string;
  valorUnitario: number;
  nomeEmpresa: string;
  cnpjEmpresa?: string;
  enderecoEmpresa: string;
  municipio: string;
  dataEmissao: string;
  latitude?: number;
  longitude?: number;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stableIdFromHit(hit: SefazHit): string {
  const source = normalizeText(`${hit.nomeEmpresa} ${hit.enderecoEmpresa}`).toLowerCase();
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return `sefaz-${Math.abs(hash)}`;
}

function parseRelativeSefazTime(value: string): string {
  const text = normalizeText(value);
  const now = Date.now();
  let ms = 0;

  const days = text.match(/(\d+)\s+DIA/);
  const hours = text.match(/(\d+)\s+HORA/);
  const minutes = text.match(/(\d+)\s+MINUTO/);
  const seconds = text.match(/(\d+)\s+SEGUNDO/);

  if (days) ms += Number(days[1]) * 24 * 60 * 60 * 1000;
  if (hours) ms += Number(hours[1]) * 60 * 60 * 1000;
  if (minutes) ms += Number(minutes[1]) * 60 * 1000;
  if (seconds) ms += Number(seconds[1]) * 1000;

  return new Date(now - ms).toISOString();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&atilde;/gi, "ã")
    .replace(/&aacute;/gi, "á")
    .replace(/&acirc;/gi, "â")
    .replace(/&eacute;/gi, "é")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&otilde;/gi, "õ")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

async function matchStation(hit: SefazHit): Promise<string> {
  const db = await getDb();
  const cnpjLimpo = cleanCnpj(hit.cnpjEmpresa ?? "");
  const nomeUpper = hit.nomeEmpresa.toUpperCase();

  if (db) {
    // 1. Match por CNPJ exato no banco de dados
    if (cnpjLimpo) {
      const byId = await db
        .select({ id: stations.id })
        .from(stations)
        .where(eq(stations.cnpj, cnpjLimpo))
        .limit(1);

      if (byId.length > 0) return byId[0].id;
    }

    // 2. Match por similaridade de nome/endereço
    const hitName = normalizeText(hit.nomeEmpresa);
    const hitAddress = normalizeText(hit.enderecoEmpresa);
    const allStations = await db.select().from(stations);
    let best: { id: string; score: number } | null = null;
    for (const s of allStations) {
      const stationName = normalizeText(s.name);
      const stationBrand = normalizeText(s.brand);
      const stationAddress = normalizeText(s.address);
      const stationNeighborhood = normalizeText(s.neighborhood);
      let score = 0;

      if (stationName && hitName.includes(stationName)) score += 3;
      if (stationName && stationName.includes(hitName.slice(0, 12))) score += 2;
      if (stationBrand && hitName.includes(stationBrand)) score += 1;
      if (stationAddress && hitAddress.includes(stationAddress.slice(0, 12))) score += 3;
      if (stationNeighborhood && hitAddress.includes(stationNeighborhood)) score += 1;

      if (!best || score > best.score) best = { id: s.id, score };
    }

    if (best && best.score >= 3) return best.id;

    const fallbackId = cnpjLimpo ? `cnpj-${cnpjLimpo}` : stableIdFromHit(hit);
    const latitude = hit.latitude ?? -3.1019;
    const longitude = hit.longitude ?? -60.025;

    await db.insert(stations).values({
      id: fallbackId,
      name: hit.nomeEmpresa,
      brand: "Independente",
      address: hit.enderecoEmpresa || "Endereco nao cadastrado",
      neighborhood: "Manaus",
      latitude,
      longitude,
      cnpj: cnpjLimpo || null,
      amenities: JSON.stringify(["SEFAZ"]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: stations.id,
      set: {
        name: hit.nomeEmpresa,
        address: hit.enderecoEmpresa || "Endereco nao cadastrado",
        latitude,
        longitude,
        cnpj: cnpjLimpo || null,
        updatedAt: new Date().toISOString(),
      },
    });

    return fallbackId;
  }

  // 2. Override manual por nome
  if (NAME_OVERRIDES[nomeUpper]) return NAME_OVERRIDES[nomeUpper];

  // 4. Fallback sem banco
  return cnpjLimpo ? `cnpj-${cnpjLimpo}` : stableIdFromHit(hit);
}

// ---------------------------------------------------------------------------
// Busca produtos na SEFAZ
// ---------------------------------------------------------------------------

const SEFAZ_ENDPOINT = "https://bpelastic.sefaz.am.gov.br/buscapreco/produto/_search";

const SEFAZ_HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://buscapreco.sefaz.am.gov.br",
  "Referer": "https://buscapreco.sefaz.am.gov.br/",
  "User-Agent": "FuelMapManaus/1.0 (app publico de precos; contato@fuelmap.app)",
};

const sefazDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

async function fetchSefaz(query: string): Promise<SefazHit[]> {
  const body = {
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["nomeProduto"],
              type: "phrase_prefix",
            },
          },
        ],
        filter: [
          { term: { municipio: "MANAUS" } },
          {
            range: {
              dataEmissao: {
                gte: "now-48h",
                lte: "now",
              },
            },
          },
        ],
      },
    },
    sort: [{ dataEmissao: { order: "desc" } }],
    size: 500,
    _source: [
      "nomeProduto",
      "valorUnitario",
      "nomeEmpresa",
      "cnpjEmpresa",
      "enderecoEmpresa",
      "municipio",
      "dataEmissao",
    ],
  };

  const res = await fetch(SEFAZ_ENDPOINT, {
    method: "POST",
    headers: SEFAZ_HEADERS,
    body: JSON.stringify(body),
    dispatcher: sefazDispatcher,
    signal: AbortSignal.timeout(15_000), // timeout obrigatório de 15s
  } as RequestInit & { dispatcher: Agent });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.hits?.hits ?? []).map((h: any) => h._source as SefazHit);
}

async function fetchSefazLegacy(query: string): Promise<SefazHit[]> {
  const params = new URLSearchParams({
    descricaoProd: query,
    latitude: "-3.1019",
    longitude: "-60.0250",
    tipoConsulta: "48",
    distancia: "9999",
    municipio: "Manaus",
  });

  const res = await fetch("https://buscapreco.sefaz.am.gov.br/item/grupo/p/1", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": SEFAZ_HEADERS["User-Agent"],
      "Origin": "https://buscapreco.sefaz.am.gov.br",
      "Referer": "https://buscapreco.sefaz.am.gov.br/home",
    },
    body: params.toString(),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const html = await res.text();
  const cardRegex = /<div class="card small p hoverable">([\s\S]*?)<!-- Modal Structure -->/g;
  const hits: SefazHit[] = [];
  let card: RegExpExecArray | null;

  while ((card = cardRegex.exec(html))) {
    const block = card[1];
    const productMatch = block.match(/card-title[^>]*data-tooltip="([^"]+)"/);
    const stationMatch = block.match(/<p class="truncate tooltipped padding10"[^>]*data-tooltip="([^"]+)"/);
    const addressMatch = block.match(/<span\s+class="truncate grey-text[^"]*"[^>]*data-tooltip="([^"]+)"/);
    const priceMatch = block.match(/R\$\s*([0-9]+,[0-9]{2})/);
    const timeMatch = block.match(/<p class="tb-valor-10">([^<]+)<\/p>/);
    const mapMatch = block.match(/refreshMap\(\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*\)/);

    const nomeProduto = productMatch ? decodeHtml(productMatch[1]) : query;
    const nomeEmpresa = stationMatch ? decodeHtml(stationMatch[1]) : "";
    const enderecoEmpresa = addressMatch ? decodeHtml(addressMatch[1]) : "";
    const valorUnitario = priceMatch ? Number(priceMatch[1].replace(",", ".")) : NaN;

    if (!nomeEmpresa || !Number.isFinite(valorUnitario)) continue;

    hits.push({
      nomeProduto: stripHtml(nomeProduto),
      valorUnitario,
      nomeEmpresa: stripHtml(nomeEmpresa),
      enderecoEmpresa: stripHtml(enderecoEmpresa),
      municipio: "MANAUS",
      dataEmissao: parseRelativeSefazTime(timeMatch?.[1] ?? ""),
      latitude: mapMatch ? Number(mapMatch[2]) : undefined,
      longitude: mapMatch ? Number(mapMatch[1]) : undefined,
    });
  }

  return hits;
}

async function fetchSefazWithFallback(query: string): Promise<SefazHit[]> {
  try {
    const hits = await fetchSefaz(query);
    const hasUsefulCoordinates = hits.some(
      (hit) => Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude),
    );

    if (hits.length > 0 && hasUsefulCoordinates) {
      console.log(`[SEFAZ] ${hits.length} resultados para ${query}`);
      return hits;
    }

    console.warn(`[SEFAZ] Elasticsearch sem coordenadas úteis para ${query}; tentando scraping HTML...`);
  } catch {
    console.warn(`[SEFAZ] Elasticsearch falhou para ${query}; tentando scraping HTML...`);
  }

  const legacyHits = await fetchSefazLegacy(query);
  console.log(`[SEFAZ] ${legacyHits.length} resultados HTML para ${query}`);
  return legacyHits;
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------

export async function syncSefazPrices(): Promise<{
  synced: number;
  skipped: number;
  errors: string[];
}> {
  const db = await getDb();
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  if (!db) {
    const message = "Banco de dados indisponivel. Configure DATABASE_URL ou use o SQLite local de desenvolvimento.";
    console.error(`[SEFAZ] ${message}`);
    return { synced, skipped, errors: [message] };
  }

  const pruned = await pruneSefazContributions(72);
  if (pruned > 0) {
    console.log(`[SEFAZ] Limpeza: ${pruned} contribuições antigas removidas`);
  }

  for (const { query, fuelType } of FUEL_MAP) {
    console.log(`[SEFAZ] Buscando: ${query}`);

    let hits: SefazHit[] = [];

    // Erros de rede não abortam o sync inteiro — continua para o próximo produto
    try {
      hits = await fetchSefazWithFallback(query);
    } catch (err) {
      console.warn(`[SEFAZ] Elasticsearch falhou para ${query}; tentando scraping HTML...`);
      try {
        hits = await fetchSefazLegacy(query);
        console.log(`[SEFAZ] ${hits.length} resultados HTML para ${query}`);
      } catch (fallbackErr) {
        const msg = `Erro ao buscar ${query}: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`;
        console.error(`[SEFAZ] ${msg}`);
        errors.push(msg);
      // Aguarda antes de continuar para não bombardear o servidor em falhas
        await sleep(3_000);
        continue;
      }
    }

    for (const hit of hits) {
      // Validação: deve ser de Manaus
      if (hit.municipio !== "MANAUS") { skipped++; continue; }

      // Validação: preço deve ser número finito
      if (!Number.isFinite(hit.valorUnitario)) { skipped++; continue; }

      // Validação: limites de sanidade
      const limits = PRICE_LIMITS[fuelType];
      if (hit.valorUnitario < limits.min || hit.valorUnitario > limits.max) {
        skipped++;
        continue;
      }

      const stationId = await matchStation(hit);
      const priceStr = hit.valorUnitario.toFixed(3);
      const createdAt = new Date(hit.dataEmissao).toISOString();

      if (await hasSefazContribution(stationId, fuelType, priceStr, createdAt)) {
        skipped++;
        continue;
      }

      try {
        await db.insert(contributions).values({
          userId: 0,
          stationId,
          fuelType,
          price: priceStr,
          source: "sefaz",
          createdAt,
        });
        synced++;
      } catch {
        skipped++;
      }
    }

    // Delay obrigatório de 3s entre produtos para não sobrecarregar a SEFAZ
    await sleep(3_000);
  }

  console.log(`[SEFAZ] Sync concluído: ${synced} salvos, ${skipped} ignorados, ${errors.length} erros`);
  return { synced, skipped, errors };
}
