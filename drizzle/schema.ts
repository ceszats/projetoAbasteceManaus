import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Postos de combustível — populados pelo seed Overpass e enriquecidos pela SEFAZ
 */
export const stations = sqliteTable("stations", {
  id: text("id").primaryKey(),                          // "osm-123" ou "cnpj-12345678000100"
  name: text("name").notNull(),
  brand: text("brand").notNull().default("Independente"),
  address: text("address").notNull().default("Endereço não cadastrado"),
  neighborhood: text("neighborhood").notNull().default("Manaus"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  cnpj: text("cnpj"),                                   // CNPJ sem pontuação, opcional
  amenities: text("amenities").notNull().default("[]"), // JSON array
  osmId: text("osmId"),                                 // ID original do OpenStreetMap
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DbStation = typeof stations.$inferSelect;
export type InsertStation = typeof stations.$inferInsert;

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role").default("user").notNull(), // 'user' or 'admin'
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSignedIn: text("lastSignedIn").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Extended user profile for FuelMap
 * Stores additional user data like profile picture and OAuth provider
 */
export const userProfiles = sqliteTable("userProfiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  profilePictureUrl: text("profilePictureUrl"),
  oauthProvider: text("oauthProvider").notNull(), // 'google' or 'facebook'
  oauthId: text("oauthId").notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * User contributions history
 * Tracks price reports submitted by users
 */
export const contributions = sqliteTable("contributions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  stationId: text("stationId").notNull(), // Reference to station mock data
  fuelType: text("fuelType").notNull(), // 'gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'
  price: text("price").notNull(), // Stored as decimal string
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Contribution = typeof contributions.$inferSelect;
export type InsertContribution = typeof contributions.$inferInsert;

/**
 * User confirmations for price reports
 */
export const confirmations = sqliteTable("confirmations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contributionId: integer("contributionId").notNull(),
  userId: integer("userId").notNull(),
  isValid: integer("isValid", { mode: 'boolean' }).notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Confirmation = typeof confirmations.$inferSelect;
export type InsertConfirmation = typeof confirmations.$inferInsert;
