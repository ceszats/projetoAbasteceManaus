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

import { getDb } from "./db";
import { contributions, stations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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
  { query: "GAS NATURAL",        fuelType: "gnv"       },
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
  cnpjEmpresa: string;
  enderecoEmpresa: string;
  municipio: string;
  dataEmissao: string;
}

async function matchStation(hit: SefazHit): Promise<string> {
  const db = await getDb();
  const cnpjLimpo = cleanCnpj(hit.cnpjEmpresa);
  const nomeUpper = hit.nomeEmpresa.toUpperCase();

  if (db) {
    // 1. Match por CNPJ exato no banco de dados
    const byId = await db
      .select({ id: stations.id })
      .from(stations)
      .where(eq(stations.cnpj, cnpjLimpo))
      .limit(1);

    if (byId.length > 0) return byId[0].id;

    // 3. Match por similaridade de nome
    const allStations = await db.select({ id: stations.id, name: stations.name, brand: stations.brand }).from(stations);
    for (const s of allStations) {
      if (
        nomeUpper.includes(s.name.toUpperCase()) ||
        nomeUpper.includes(s.brand.toUpperCase()) ||
        s.name.toUpperCase().includes(nomeUpper.substring(0, 10))
      ) {
        return s.id;
      }
    }
  }

  // 2. Override manual por nome
  if (NAME_OVERRIDES[nomeUpper]) return NAME_OVERRIDES[nomeUpper];

  // 4. Fallback: registra com CNPJ como ID temporário
  return `cnpj-${cnpjLimpo}`;
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
    signal: AbortSignal.timeout(15_000), // timeout obrigatório de 15s
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json?.hits?.hits ?? []).map((h: any) => h._source as SefazHit);
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

  for (const { query, fuelType } of FUEL_MAP) {
    console.log(`[SEFAZ] Buscando: ${query}`);

    let hits: SefazHit[] = [];

    // Erros de rede não abortam o sync inteiro — continua para o próximo produto
    try {
      hits = await fetchSefaz(query);
      console.log(`[SEFAZ] ${hits.length} resultados para ${query}`);
    } catch (err) {
      const msg = `Erro ao buscar ${query}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[SEFAZ] ${msg}`);
      errors.push(msg);
      // Aguarda antes de continuar para não bombardear o servidor em falhas
      await sleep(3_000);
      continue;
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

      // INSERT separado com try/catch — duplicatas são ignoradas silenciosamente
      try {
        await db!.insert(contributions).values({
          userId: 0, // contribuição automática da SEFAZ
          stationId,
          fuelType,
          price: hit.valorUnitario.toFixed(3),
          createdAt: new Date(hit.dataEmissao).toISOString(), // data da NFC-e, não do sistema
        });
        synced++;
      } catch {
        // Silencioso: provavelmente duplicata ou restrição de integridade
        skipped++;
      }
    }

    // Delay obrigatório de 3s entre produtos para não sobrecarregar a SEFAZ
    await sleep(3_000);
  }

  console.log(`[SEFAZ] Sync concluído: ${synced} salvos, ${skipped} ignorados, ${errors.length} erros`);
  return { synced, skipped, errors };
}
