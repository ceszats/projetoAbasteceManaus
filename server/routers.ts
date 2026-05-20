import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { STATIONS } from "../data/stations";

const stationIds = new Set(STATIONS.map((station) => station.id));
const priceSchema = z.coerce
  .number()
  .min(3, "Preco abaixo do esperado")
  .max(12, "Preco acima do esperado")
  .refine((value) => Number.isFinite(value), "Preco invalido")
  .refine((value) => /^\d+(\.\d{1,3})?$/.test(String(value)), "Use ate 3 casas decimais");

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
          stationId: z.string().refine((id) => stationIds.has(id), "Posto nao encontrado"),
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
      return db.getAllStations();
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
