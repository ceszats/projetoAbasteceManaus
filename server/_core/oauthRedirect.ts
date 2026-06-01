import { getAllowedOrigins } from "./security";

const DEFAULT_DEEP_LINK_SCHEME = "manus20260327112602";
const OAUTH_CALLBACK_PATH = "/oauth/callback";

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedWebOrigins() {
  const configuredOrigins = [
    ...getAllowedOrigins(),
    process.env.EXPO_WEB_PREVIEW_URL,
    process.env.EXPO_PACKAGER_PROXY_URL,
  ];

  return new Set(
    configuredOrigins
      .filter((origin): origin is string => typeof origin === "string" && origin.trim().length > 0)
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin): origin is string => !!origin),
  );
}

function isLocalWebRedirect(url: URL) {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
}

function getDeepLinkCallbackPath(url: URL) {
  const combined = `${url.hostname ? `/${url.hostname}` : ""}${url.pathname}`;
  return combined.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

export function isAllowedOAuthRedirectUri(redirectUri: string): boolean {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }

  const callbackPath = url.pathname.replace(/\/$/, "") || "/";

  if (url.protocol === "http:" || url.protocol === "https:") {
    if (callbackPath !== OAUTH_CALLBACK_PATH) return false;
    if (isLocalWebRedirect(url)) return true;
    return getAllowedWebOrigins().has(url.origin);
  }

  const allowedSchemes = new Set(
    [process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME, DEFAULT_DEEP_LINK_SCHEME]
      .filter((scheme): scheme is string => typeof scheme === "string" && scheme.length > 0)
      .map((scheme) => `${scheme.replace(/:$/, "")}:`),
  );

  return allowedSchemes.has(url.protocol) && getDeepLinkCallbackPath(url) === OAUTH_CALLBACK_PATH;
}

export function assertAllowedOAuthRedirectUri(redirectUri: string) {
  if (!isAllowedOAuthRedirectUri(redirectUri)) {
    throw new Error("OAuth redirectUri is not allowed");
  }
}
