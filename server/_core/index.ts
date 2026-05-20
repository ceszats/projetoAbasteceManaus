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
import { syncSefazPrices } from "../sefaz-sync";

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
