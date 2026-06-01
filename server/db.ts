import { eq, and, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { InsertUser, users, userProfiles, contributions, confirmations, stations } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { UserProfile, InsertUserProfile, Contribution, InsertContribution, InsertConfirmation, InsertStation, DbStation } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

function ensureColumn(sqlite: Database.Database, table: string, column: string, definition: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((row) => row.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureLocalSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      brand text DEFAULT 'Independente' NOT NULL,
      address text DEFAULT 'Endereco nao cadastrado' NOT NULL,
      neighborhood text DEFAULT 'Manaus' NOT NULL,
      latitude real NOT NULL,
      longitude real NOT NULL,
      cnpj text,
      amenities text DEFAULT '[]' NOT NULL,
      osmId text,
      createdAt text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      openId text NOT NULL,
      name text,
      email text,
      loginMethod text,
      role text DEFAULT 'user' NOT NULL,
      createdAt text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      lastSignedIn text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_openId_unique ON users (openId);

    CREATE TABLE IF NOT EXISTS userProfiles (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      userId integer NOT NULL,
      profilePictureUrl text,
      oauthProvider text NOT NULL,
      oauthId text NOT NULL,
      createdAt text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS userProfiles_userId_unique ON userProfiles (userId);

    CREATE TABLE IF NOT EXISTS contributions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      userId integer NOT NULL,
      stationId text NOT NULL,
      fuelType text NOT NULL,
      price text NOT NULL,
      source text DEFAULT 'user' NOT NULL,
      createdAt text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contributions_station_fuel
      ON contributions (stationId, fuelType, createdAt);
  `);

  ensureColumn(sqlite, "contributions", "source", "text DEFAULT 'user' NOT NULL");
  sqlite.exec(`UPDATE contributions SET source = 'sefaz' WHERE userId = 0 AND source = 'user'`);
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  const databaseUrl = process.env.DATABASE_URL || (process.env.NODE_ENV === "production" ? "" : "file:./local.db");

  if (!_db && databaseUrl) {
    try {
      const sqlitePath = databaseUrl.replace("file:", "");
      const sqlite = new Database(sqlitePath);
      ensureLocalSchema(sqlite);
      _db = drizzle(sqlite);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values = {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      lastSignedIn: user.lastSignedIn ?? new Date().toISOString(),
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
    };

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: values.lastSignedIn,
        role: values.role,
      },
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getOrCreateOAuthUser(
  oauthProvider: "google" | "facebook",
  oauthId: string,
  name: string | null,
  email: string | null,
  profilePictureUrl?: string
) {
  const db = await getDb();
  if (!db) return null;

  try {
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.oauthProvider, oauthProvider),
          eq(userProfiles.oauthId, oauthId)
        )
      );

    if (existingProfile.length > 0) {
      const userId = existingProfile[0].userId;
      await db
        .update(users)
        .set({ lastSignedIn: new Date().toISOString() })
        .where(eq(users.id, userId));
      
      const user = await db.select().from(users).where(eq(users.id, userId));
      return user[0] || null;
    }

    const openId = `${oauthProvider}-${oauthId}`;
    const insertResult = await db.insert(users).values({
      openId,
      name,
      email,
      loginMethod: oauthProvider,
      role: "user",
      lastSignedIn: new Date().toISOString(),
    });

    const userId = Number(insertResult.lastInsertRowid);

    await db.insert(userProfiles).values({
      userId,
      oauthProvider,
      oauthId,
      profilePictureUrl,
    });

    const user = await db.select().from(users).where(eq(users.id, userId));
    return user[0] || null;
  } catch (error) {
    console.error("Error creating OAuth user:", error);
    return null;
  }
}

export async function getUserProfileWithOAuth(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const profile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  if (profile.length === 0) return null;

  const user = await db.select().from(users).where(eq(users.id, userId));
  if (user.length === 0) return null;

  return {
    ...profile[0],
    user: user[0],
  };
}

export async function getUserContributions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(contributions)
    .where(eq(contributions.userId, userId));
}

export async function addContribution(data: InsertContribution) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(contributions).values(data);
    return Number(result.lastInsertRowid);
  } catch (error) {
    console.error("Error adding contribution:", error);
    return null;
  }
}

export async function getContributionOverview() {
  const db = await getDb();
  if (!db) {
    return {
      total: 0,
      sefaz: 0,
      user: 0,
      lastUserContribution: null as string | null,
      lastSefazContribution: null as string | null,
    };
  }

  const rows = await db.select().from(contributions);
  const lastBySource = (source: "sefaz" | "user") => {
    const filtered = rows.filter((row) => row.source === source);
    if (filtered.length === 0) return null;
    return filtered.reduce((latest, row) => (
      row.createdAt.localeCompare(latest) > 0 ? row.createdAt : latest
    ), filtered[0].createdAt);
  };

  return {
    total: rows.length,
    sefaz: rows.filter((row) => row.source === "sefaz" || row.userId === 0).length,
    user: rows.filter((row) => row.source === "user" && row.userId !== 0).length,
    lastUserContribution: lastBySource("user"),
    lastSefazContribution: lastBySource("sefaz"),
  };
}

export async function addConfirmation(data: InsertConfirmation) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(confirmations).values(data);
    return Number(result.lastInsertRowid);
  } catch (error) {
    console.error("Error adding confirmation:", error);
    return null;
  }
}

export async function getStationContributions(stationId: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(contributions)
    .where(eq(contributions.stationId, stationId));
}

export async function getAllContributions(): Promise<Contribution[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(contributions);
}

/** Remove contribuições automáticas SEFAZ (userId=0) mais antigas que keepHours */
export async function pruneSefazContributions(keepHours = 72): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const cutoff = new Date(Date.now() - keepHours * 60 * 60 * 1000).toISOString();
  const result = await db
    .delete(contributions)
    .where(and(eq(contributions.userId, 0), lt(contributions.createdAt, cutoff)));

  return result.changes ?? 0;
}

export async function hasSefazContribution(
  stationId: string,
  fuelType: string,
  price: string,
  createdAt: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const rows = await db
    .select({ id: contributions.id })
    .from(contributions)
    .where(
      and(
        eq(contributions.userId, 0),
        eq(contributions.stationId, stationId),
        eq(contributions.fuelType, fuelType),
        eq(contributions.price, price),
        eq(contributions.createdAt, createdAt),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Busca a reputação de um usuário baseada nas suas contribuições.
 */
export async function getUserReputation(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, confirmed: 0 };

  const all = await db
    .select()
    .from(contributions)
    .where(eq(contributions.userId, userId));

  // Por enquanto, consideramos confirmada qualquer contribuição
  // Em uma versão real, haveria uma tabela de confirmações
  return {
    total: all.length,
    confirmed: Math.floor(all.length * 0.8), // Simulação de 80% de confirmação
  };
}
/**
 * Retorna todos os postos do banco.
 */
export async function getAllStations(): Promise<DbStation[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stations);
}

/**
 * Insere ou atualiza um posto (upsert pelo id primário).
 */
export async function upsertStation(data: InsertStation): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(stations).values(data).onConflictDoUpdate({
      target: stations.id,
      set: {
        name: data.name,
        brand: data.brand,
        address: data.address,
        neighborhood: data.neighborhood,
        latitude: data.latitude,
        longitude: data.longitude,
        cnpj: data.cnpj,
        amenities: data.amenities,
        osmId: data.osmId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Database] Failed to upsert station:", error);
    throw error;
  }
}

/**
 * Conta postos cadastrados.
 */
export async function getStationCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ id: stations.id }).from(stations);
  return result.length;
}
