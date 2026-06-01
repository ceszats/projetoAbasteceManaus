/**
 * Sincroniza preços da SEFAZ manualmente (mesmo job do servidor).
 * Uso: pnpm run db:sync:sefaz
 */
import "dotenv/config";
import { syncSefazPrices } from "../server/sefaz-sync";

async function main() {
  const result = await syncSefazPrices();
  console.log("[SEFAZ] Resultado:", result);
  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[SEFAZ] Falha:", err);
  process.exitCode = 1;
});
