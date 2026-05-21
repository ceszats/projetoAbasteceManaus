import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

const priceSchema = z.coerce
  .number()
  .min(3, "Preco abaixo do esperado")
  .max(12, "Preco acima do esperado")
  .refine((value) => Number.isFinite(value), "Preco invalido")
  .refine((value) => /^\d+(\.\d{1,3})?$/.test(String(value)), "Use ate 3 casas decimais");

const FUEL_TYPES = ["gasolina", "aditivada", "etanol", "diesel", "gnv"] as const;

function summarizeStationPrices(rows: Awaited<ReturnType<typeof db.getAllContributions>>) {
  const grouped = new Map<string, Array<{ price: number; createdAt: Date }>>();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const row of rows) {
    if (!FUEL_TYPES.includes(row.fuelType as (typeof FUEL_TYPES)[number])) continue;

    const price = Number.parseFloat(row.price);
    const createdAt = new Date(row.createdAt);
    if (!Number.isFinite(price) || Number.isNaN(createdAt.getTime())) continue;

    const key = `${row.stationId}:${row.fuelType}`;
    const items = grouped.get(key) ?? [];
    items.push({ price, createdAt });
    grouped.set(key, items);
  }

  const byStation = new Map<string, Array<{
    type: (typeof FUEL_TYPES)[number];
    price: number;
    updatedAt: Date;
    confirmations: number;
    isLive: true;
  }>>();

  for (const [key, items] of grouped) {
    const [stationId, fuelType] = key.split(":") as [string, (typeof FUEL_TYPES)[number]];
    const recent = items.filter((item) => item.createdAt.getTime() >= cutoff);
    const sample = recent.length > 0 ? recent : items;
    const sorted = sample.map((item) => item.price).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const updatedAt = sample.reduce((latest, item) => item.createdAt > latest ? item.createdAt : latest, sample[0].createdAt);

    const prices = byStation.get(stationId) ?? [];
    prices.push({
      type: fuelType,
      price: Number(median.toFixed(2)),
      updatedAt,
      confirmations: sample.length,
      isLive: true,
    });
    byStation.set(stationId, prices);
  }

  return byStation;
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  oauth: router({
    getOrCreateUser: protectedProcedure
      .input(
        z.object({
          provider: z.enum(["google", "facebook"]),
          oauthId: z.string(),
          name: z.string().nullable(),
          email: z.string().nullable(),
          profilePictureUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const user = await db.getOrCreateOAuthUser(
          input.provider,
          input.oauthId,
          input.name,
          input.email,
          input.profilePictureUrl
        );

        if (!user) {
          throw new Error("Failed to create or get OAuth user");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          openId: user.openId,
        };
      }),

    getProfile: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserProfileWithOAuth(ctx.user.id);
    }),
  }),

  contributions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserContributions(ctx.user.id);
    }),

    add: protectedProcedure
      .input(
        z.object({
          stationId: z.string().min(1, "stationId obrigatório"),
          fuelType: z.enum(["gasolina", "aditivada", "etanol", "diesel", "gnv"]),
          price: priceSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await db.addContribution({
          userId: ctx.user.id,
          stationId: input.stationId,
          fuelType: input.fuelType,
          price: input.price.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
        });

        if (!id) {
          throw new Error("Failed to add contribution");
        }

        return { id };
      }),

    byStation: publicProcedure
      .input(z.object({ stationId: z.string() }))
      .query(async ({ input }) => {
        return db.getStationContributions(input.stationId);
      }),
  }),

  stations: router({
    list: publicProcedure.query(async () => {
      const [stations, contributions] = await Promise.all([
        db.getAllStations(),
        db.getAllContributions(),
      ]);
      const pricesByStation = summarizeStationPrices(contributions);

      return stations
        .filter((station) => !/^pre.o recente$/i.test(station.name))
        .map((station) => ({
          ...station,
          prices: pricesByStation.get(station.id) ?? [],
        }));
    }),
    prices: publicProcedure
      .input(z.object({ stationId: z.string() }))
      .query(async ({ input }) => {
        const contributions = await db.getStationContributions(input.stationId);
        // Retorna as contribuições brutas para o frontend processar com usePriceEngine
        // ou podemos processar aqui no futuro.
        return contributions.map(c => ({
          price: parseFloat(c.price),
          createdAt: new Date(c.createdAt),
          fuelType: c.fuelType,
        }));
      }),
  }),

  user: router({
    reputation: protectedProcedure.query(async ({ ctx }) => {
      const rep = await db.getUserReputation(ctx.user.id);
      return rep;
    }),
  }),
});

export type AppRouter = typeof appRouter;
