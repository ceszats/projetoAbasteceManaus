/**
 * cnpj-enrichment.ts
 *
 * Busca dados na BrasilAPI (gratuita, sem chave) para enriquecer postos 
 * que vieram da SEFAZ com CNPJ, tentando dar match com os dados do OpenStreetMap.
 */

import { getDb } from "./db";
import { stations } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
}

const BRASIL_API_URL = "https://brasilapi.com.br/api/cnpj/v1";

/**
 * Envia um request para a BrasilAPI e retorna os dados do CNPJ.
 */
async function fetchCnpj(cnpj: string): Promise<BrasilApiCnpjResponse | null> {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  try {
    const res = await fetch(`${BRASIL_API_URL}/${cleanCnpj}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      if (res.status === 404) return null; // CNPJ não encontrado
      throw new Error(`BrasilAPI erro ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`[BrasilAPI] Erro ao buscar CNPJ ${cleanCnpj}:`, error);
    return null;
  }
}

/**
 * Tenta enriquecer um posto que só tem CNPJ com dados do OSM, 
 * ou enriquecer um posto do OSM com o CNPJ recém descoberto.
 */
export async function enrichStationCnpj(cnpj: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const data = await fetchCnpj(cnpj);
  if (!data) return false;

  const nomeFantasia = (data.nome_fantasia || data.razao_social).toUpperCase();

  // Procurar por posto no banco com nome parecido e sem CNPJ
  const possibleMatches = await db
    .select()
    .from(stations)
    .where(or(
      like(stations.name, `%${nomeFantasia.substring(0, 10)}%`),
      like(stations.brand, `%${nomeFantasia.substring(0, 10)}%`)
    ));

  if (possibleMatches.length > 0) {
    // Pegar o primeiro match (pode ser aprimorado para checar endereço)
    const match = possibleMatches[0];
    
    // Atualizar o posto OSM com o CNPJ descoberto
    await db.update(stations).set({
      cnpj: data.cnpj,
      updatedAt: new Date().toISOString(),
    }).where(eq(stations.id, match.id));

    console.log(`[Enrichment] CNPJ ${cnpj} associado ao posto ${match.id} (${match.name})`);
    return true;
  }

  // Se não achou no OSM, atualizamos o registro temporário "cnpj-..." se existir
  const tempId = `cnpj-${data.cnpj}`;
  const existingTemp = await db.select().from(stations).where(eq(stations.id, tempId)).limit(1);

  if (existingTemp.length > 0) {
    await db.update(stations).set({
      name: data.nome_fantasia || data.razao_social,
      brand: "Independente", // Podemos tentar deduzir da razão social
      address: `${data.logradouro}, ${data.numero}`,
      neighborhood: data.bairro,
      updatedAt: new Date().toISOString(),
    }).where(eq(stations.id, tempId));
    console.log(`[Enrichment] Posto temporário ${tempId} atualizado com dados da BrasilAPI`);
    return true;
  }

  return false;
}
