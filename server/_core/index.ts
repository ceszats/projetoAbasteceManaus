import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerSocialOAuthRoutes } from "./socialOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getAllowedOrigins, rateLimit, securityHeaders } from "./security";
import { sdk } from "./sdk";
import { syncSefazPrices } from "../sefaz-sync";
import * as db from "../db";

const routeCache = new Map<string, { expiresAt: number; value: unknown }>();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Job agendado da SEFAZ — roda em background, não bloqueia o servidor.
 * Loop while(true) + await sleep() é mais seguro que setInterval para
 * operações assíncronas longas (evita sobreposição de execuções).
 */
async function startSefazJob(): Promise<void> {
  // Aguarda 30s para o banco estabilizar antes do primeiro sync
  await sleep(30_000);

  while (true) {
    try {
      const result = await syncSefazPrices();
      console.log(`[SEFAZ] Job: ${result.synced} salvos, ${result.skipped} ignorados, ${result.errors.length} erros`);
    } catch (err) {
      console.error("[SEFAZ] Erro fatal no job:", err);
    }
    // Aguarda 6 horas até o próximo ciclo
    await sleep(6 * 60 * 60 * 1000);
  }
}

function parseCoordinate(value: unknown, label: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} invalido`);
  }
  return numberValue;
}

function routeCacheKey(originLat: number, originLng: number, destinationLat: number, destinationLng: number) {
  const round = (value: number) => value.toFixed(5);
  return `${round(originLat)},${round(originLng)}:${round(destinationLat)},${round(destinationLng)}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seg`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const isDev = process.env.NODE_ENV !== "production";

  app.use(securityHeaders);

  // Enable CORS for all routes
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin) {
      if (isDev) {
        res.header("Access-Control-Allow-Origin", origin);
      } else {
        const allowedOrigins = getAllowedOrigins();
        if (allowedOrigins.includes(origin)) {
          res.header("Access-Control-Allow-Origin", origin);
        }
      }
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Reduced limit to prevent DoS attacks via huge JSON payloads
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  app.use("/api/auth", rateLimit({ windowMs: 60_000, max: 30 }));
  app.use("/api/oauth", rateLimit({ windowMs: 60_000, max: 20 }));
  app.use("/api/contributions", rateLimit({ windowMs: 60_000, max: 20 }));
  app.use("/api/trpc", rateLimit({ windowMs: 60_000, max: 120 }));

  registerOAuthRoutes(app);
  registerSocialOAuthRoutes(app);

  // --- MOCK OAUTH PORTAL ---
  if (isDev) {
    app.get("/app-auth", (req, res) => {
      const { redirectUri, state } = req.query;
      res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f3f4f6; }
            .card { background: white; padding: 2rem; border-radius: 1rem; shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 90%; }
            button { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-size: 1rem; cursor: pointer; margin-top: 1rem; width: 100%; }
            button.fb { background: #1877f2; }
            h1 { font-size: 1.5rem; color: #1f2937; }
            p { color: #6b7280; margin-bottom: 2rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Simulador de Login</h1>
            <p>Escolha um provedor para continuar para o FuelMap Manaus</p>
            <button onclick="login('google')">Entrar com Google</button>
            <button class="fb" onclick="login('facebook')">Entrar com Facebook</button>
          </div>
          <script>
            function login(provider) {
              const code = "mock_code_" + provider;
              const state = "${state || ""}";
              const redirectUri = "${redirectUri || ""}";
              window.location.href = redirectUri + "?code=" + code + "&state=" + state;
            }
          </script>
        </body>
      </html>
    `);
    });

    // --- MOCK OAUTH API ENDPOINTS ---
    app.post("/webdev.v1.WebDevAuthPublicService/ExchangeToken", (_req, res) => {
      res.json({
        accessToken: "mock_access_token_" + Date.now(),
        tokenType: "Bearer",
        expiresIn: 3600
      });
    });

    app.post("/webdev.v1.WebDevAuthPublicService/GetUserInfo", (req, res) => {
      const authHeader = req.headers.authorization || "";
      const isGoogle = authHeader.includes("google") || JSON.stringify(req.body).includes("google");

      res.json({
        openId: isGoogle ? "google-mock-id-123" : "facebook-mock-id-456",
        name: isGoogle ? "Teste Google" : "Teste Facebook",
        email: isGoogle ? "google@teste.com" : "facebook@teste.com",
        platform: isGoogle ? "google" : "facebook"
      });
    });
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get("/api/stations", async (_req, res) => {
    try {
      const { listStationsWithPrices } = await import("../stations-list");
      const stations = await listStationsWithPrices();
      res.json(stations);
    } catch (err) {
      console.error("[API] /api/stations failed:", err);
      res.status(500).json({ error: "Falha ao carregar postos" });
    }
  });

  app.get("/api/sefaz/status", async (_req, res) => {
    try {
      const { getSefazStatus } = await import("../stations-list");
      res.json(await getSefazStatus());
    } catch (err) {
      console.error("[API] /api/sefaz/status failed:", err);
      res.status(500).json({ error: "Falha ao carregar status SEFAZ" });
    }
  });

  app.post("/api/contributions", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const stationId = String(req.body?.stationId ?? "").trim();
      const fuelType = String(req.body?.fuelType ?? "");
      const price = Number(req.body?.price);
      const validFuelTypes = ["gasolina", "aditivada", "etanol", "diesel", "gnv"];

      if (!stationId || !validFuelTypes.includes(fuelType)) {
        res.status(400).json({ error: "Posto ou combustivel invalido" });
        return;
      }

      if (!Number.isFinite(price) || price < 3 || price > 12) {
        res.status(400).json({ error: "Preco fora da faixa esperada" });
        return;
      }

      const id = await db.addContribution({
        userId: user.id,
        stationId,
        fuelType,
        price: price.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
        source: "user",
      });

      if (!id) {
        res.status(500).json({ error: "Falha ao salvar contribuicao" });
        return;
      }

      res.status(201).json({ id, source: "user", createdAt: new Date().toISOString() });
    } catch (err) {
      console.error("[API] /api/contributions failed:", err);
      const message = err instanceof Error ? err.message : "";
      const isAuthError = message.includes("Invalid session") || message.includes("User not found");
      res.status(isAuthError ? 401 : 500).json({
        error: isAuthError ? "Sessao obrigatoria para contribuir" : "Falha ao salvar contribuicao",
      });
    }
  });

  app.get("/api/admin/overview", async (_req, res) => {
    try {
      const { listStationsWithPrices, getSefazStatus } = await import("../stations-list");
      const [stations, sefazStatus, contributions] = await Promise.all([
        listStationsWithPrices(),
        getSefazStatus(),
        db.getContributionOverview(),
      ]);

      const pricedStations = stations.filter((station) => station.prices.length > 0).length;
      const sefazPricedStations = stations.filter((station) =>
        station.prices.some((price) => price.source === "sefaz"),
      ).length;
      const userPricedStations = stations.filter((station) =>
        station.prices.some((price) => price.source === "user"),
      ).length;

      res.json({
        stations: {
          total: stations.length,
          withAnyPrice: pricedStations,
          withSefazPrice: sefazPricedStations,
          withUserPrice: userPricedStations,
          withoutPrice: Math.max(0, stations.length - pricedStations),
        },
        contributions,
        sefazStatus,
      });
    } catch (err) {
      console.error("[API] /api/admin/overview failed:", err);
      res.status(500).json({ error: "Falha ao carregar painel" });
    }
  });

  app.get("/api/routes/driving", async (req, res) => {
    try {
      const originLat = parseCoordinate(req.query.originLat, "originLat");
      const originLng = parseCoordinate(req.query.originLng, "originLng");
      const destinationLat = parseCoordinate(req.query.destinationLat, "destinationLat");
      const destinationLng = parseCoordinate(req.query.destinationLng, "destinationLng");
      const cacheKey = routeCacheKey(originLat, originLng, destinationLat, destinationLng);
      const cached = routeCache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        res.json({ ...(cached.value as object), cached: true });
        return;
      }

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${originLng},${originLat};${destinationLng},${destinationLat}` +
        `?overview=full&geometries=geojson`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(502).json({ error: "Falha no provedor de rota" });
        return;
      }

      const data = await response.json();
      const route = data?.routes?.[0];
      const coordinates = route?.geometry?.coordinates;
      if (data?.code !== "Ok" || !route || !Array.isArray(coordinates)) {
        res.status(404).json({ error: "Rota nao encontrada" });
        return;
      }

      const value = {
        polyline: coordinates.map(([longitude, latitude]: [number, number]) => ({ latitude, longitude })),
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        distanceLabel: formatDistance(route.distance),
        durationLabel: formatDuration(route.duration),
        provider: "osrm",
      };
      routeCache.set(cacheKey, { expiresAt: Date.now() + 15 * 60 * 1000, value });
      res.json({ ...value, cached: false });
    } catch (err) {
      console.error("[API] /api/routes/driving failed:", err);
      res.status(500).json({ error: "Nao foi possivel calcular a rota" });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);

    // Inicia o job da SEFAZ em background — não bloqueia o boot do servidor
    startSefazJob().catch(err => console.error("[SEFAZ] Falha ao iniciar job:", err));
  });
}

startServer().catch(console.error);
