import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { syncSefazPrices } from "../sefaz-sync";
import * as db from "../db";
import { gte } from "drizzle-orm";
import { contributions } from "../../drizzle/schema";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }),
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Aciona o sync da SEFAZ manualmente (para diagnóstico/testes)
  sefazSync: publicProcedure.mutation(async () => {
    const result = await syncSefazPrices();
    return result;
  }),

  // Retorna status: quantos preços da SEFAZ temos nas últimas 48h
  sefazStatus: publicProcedure.query(async () => {
    const dbConn = await db.getDb();
    if (!dbConn) return { count: 0, lastSync: null };

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const rows = await dbConn
      .select()
      .from(contributions)
      .where(gte(contributions.createdAt, cutoff));

    // userId = 0 identifica contribuições automáticas da SEFAZ
    const sefazRows = rows.filter(r => r.userId === 0);

    const lastSync = sefazRows.length > 0
      ? sefazRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt
      : null;

    return { count: sefazRows.length, lastSync };
  }),

  // Retorna todos os postos do banco (para o app carregar na inicialização)
  stationsList: publicProcedure.query(async () => {
    return db.getAllStations();
  }),
});

