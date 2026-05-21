import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import type { Express, Request, Response } from "express";
import { ONE_YEAR_MS, COOKIE_NAME } from "../../shared/const.js";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { upsertUser, getUserByOpenId } from "../db";

type Provider = "google" | "facebook";

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId?: string;
  clientSecret?: string;
  scope: string;
};

const providers: Record<Provider, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    scope: "openid email profile",
  },
  facebook: {
    authorizeUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email",
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    scope: "email,public_profile",
  },
};

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function sign(value: string) {
  return createHmac("sha256", process.env.JWT_SECRET || "dev-only").update(value).digest("base64url");
}

function getServerBaseUrl(req: Request) {
  const configured = process.env.OAUTH_REDIRECT_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const proto = req.headers["x-forwarded-proto"]?.toString().split(",")[0] || req.protocol;
  return `${proto}://${req.get("host")}`;
}

function createState(provider: Provider, redirectUri: string) {
  const payload = JSON.stringify({
    provider,
    redirectUri,
    nonce: randomBytes(16).toString("hex"),
    ts: Date.now(),
  });
  const encoded = base64Url(payload);
  return `${encoded}.${sign(encoded)}`;
}

function verifyState(state: string, provider: Provider) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new Error("Invalid OAuth state");

  const expected = sign(encoded);
  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  const payload = JSON.parse(fromBase64Url(encoded)) as {
    provider: Provider;
    redirectUri: string;
    ts: number;
  };

  if (payload.provider !== provider) throw new Error("OAuth provider mismatch");
  if (Date.now() - payload.ts > 10 * 60 * 1000) throw new Error("OAuth state expired");
  return payload;
}

async function exchangeToken(provider: Provider, code: string, redirectUri: string) {
  const config = providers[provider];
  const body = new URLSearchParams({
    code,
    client_id: config.clientId || "",
    client_secret: config.clientSecret || "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) throw new Error(`Failed to exchange ${provider} token`);
  return response.json() as Promise<{ access_token: string }>;
}

async function fetchProfile(provider: Provider, accessToken: string) {
  const response = await fetch(providers[provider].userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to fetch ${provider} profile`);
  const data = (await response.json()) as Record<string, any>;

  return {
    openId: `${provider}-${data.sub || data.id}`,
    name: data.name ?? null,
    email: data.email ?? null,
    loginMethod: provider,
  };
}

function redirectWithSession(res: Response, redirectUri: string, sessionToken: string, user: unknown) {
  const url = new URL(redirectUri);
  url.searchParams.set("sessionToken", sessionToken);
  url.searchParams.set("user", Buffer.from(JSON.stringify(user)).toString("base64"));
  res.redirect(url.toString());
}

async function redirectWithDevSession(res: Response, provider: Provider, redirectUri: string) {
  const profile = {
    openId: `${provider}-mock-id-${provider === "google" ? "123" : "456"}`,
    name: provider === "google" ? "Teste Google" : "Teste Facebook",
    email: provider === "google" ? "google@teste.com" : "facebook@teste.com",
    loginMethod: provider,
  };

  await upsertUser({
    ...profile,
    lastSignedIn: new Date().toISOString(),
  });

  const savedUser = await getUserByOpenId(profile.openId);
  const sessionToken = await sdk.createSessionToken(profile.openId, {
    name: profile.name,
    expiresInMs: ONE_YEAR_MS,
  });

  const user = {
    id: savedUser?.id ?? null,
    ...profile,
    lastSignedIn: savedUser?.lastSignedIn ?? new Date().toISOString(),
  };

  redirectWithSession(res, redirectUri, sessionToken, user);
}

export function registerSocialOAuthRoutes(app: Express) {
  app.get("/api/oauth/:provider/start", (req: Request, res: Response) => {
    const provider = req.params.provider as Provider;
    const config = providers[provider];
    const redirectUri = typeof req.query.redirectUri === "string" ? req.query.redirectUri : "";
    const isDev = process.env.NODE_ENV !== "production";

    if (!config) {
      res.status(404).json({ error: "Unsupported OAuth provider" });
      return;
    }
    if ((!config.clientId || !config.clientSecret) && !isDev) {
      res.status(501).json({ error: `${provider} OAuth is not configured` });
      return;
    }
    if (!redirectUri) {
      res.status(400).json({ error: "redirectUri is required" });
      return;
    }
    if (!config.clientId || !config.clientSecret) {
      redirectWithDevSession(res, provider, redirectUri).catch((error) => {
        res.status(500).json({
          error: error instanceof Error ? error.message : "Dev OAuth failed",
        });
      });
      return;
    }

    const callbackUri = `${getServerBaseUrl(req)}/api/oauth/${provider}/callback`;
    const url = new URL(config.authorizeUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scope);
    url.searchParams.set("state", createState(provider, redirectUri));
    res.redirect(url.toString());
  });

  app.get("/api/oauth/:provider/callback", async (req: Request, res: Response) => {
    try {
      const provider = req.params.provider as Provider;
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const config = providers[provider];

      if (!config || !code || !state) {
        res.status(400).json({ error: "Invalid OAuth callback" });
        return;
      }

      const verifiedState = verifyState(state, provider);
      const callbackUri = `${getServerBaseUrl(req)}/api/oauth/${provider}/callback`;
      const token = await exchangeToken(provider, code, callbackUri);
      const profile = await fetchProfile(provider, token.access_token);

      await upsertUser({
        openId: profile.openId,
        name: profile.name,
        email: profile.email,
        loginMethod: profile.loginMethod,
        lastSignedIn: new Date().toISOString(),
      });

      const savedUser = await getUserByOpenId(profile.openId);
      const sessionToken = await sdk.createSessionToken(profile.openId, {
        name: profile.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const user = {
        id: savedUser?.id ?? null,
        openId: profile.openId,
        name: profile.name,
        email: profile.email,
        loginMethod: profile.loginMethod,
        lastSignedIn: savedUser?.lastSignedIn ?? new Date().toISOString(),
      };

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      redirectWithSession(res, verifiedState.redirectUri, sessionToken, user);
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "OAuth failed" });
    }
  });
}
