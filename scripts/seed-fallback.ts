import { STATIONS } from "../data/stations";
import DatabaseConstructor from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { stations } from "../drizzle/schema";

const DB_PATH = (process.env.DATABASE_URL ?? "file:./local.db").replace("file:", "");
const sqlite = new DatabaseConstructor(DB_PATH);
const db = drizzle(sqlite);

async function seedFromHardcoded() {
  console.log(`[Seed Fallback] Inserindo ${STATIONS.length} postos do arquivo hardcoded...`);
  
  let inseridos = 0;
  for (const s of STATIONS) {
    try {
      await db.insert(stations).values({
        id: s.id,
        name: s.name,
        brand: s.brand,
        address: s.address,
        neighborhood: s.neighborhood,
        latitude: s.latitude,
        longitude: s.longitude,
        amenities: JSON.stringify(s.amenities || []),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).onConflictDoNothing();
      inseridos++;
    } catch (err) {
      console.error(`Erro ao inserir ${s.id}:`, err);
    }
  }
  console.log(`[Seed Fallback] Concluído! Inseridos/Atualizados: ${inseridos}`);
}

seedFromHardcoded().catch(console.error);
