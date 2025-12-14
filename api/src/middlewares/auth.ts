import type { Context, MiddlewareHandler, Next } from "hono";
import { decode, verify } from "djwt";

type FirebaseClaims = {
  iss?: string;
  aud?: string;
  sub?: string;
  user_id?: string;
};

type CachedKey = {
  key: CryptoKey;
  expiresAt: number;
};

const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const FIREBASE_ISSUER_PREFIX = "https://securetoken.google.com/";
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

let jwksCache: { keys: JsonWebKey[]; expiresAt: number } | null = null;
const keyCache = new Map<string, CachedKey>();

export const authMiddleware: MiddlewareHandler<AppEnv> = async (
  c: Context<AppEnv>,
  next: Next,
) => {
  if (c.req.path === "/v1/health") {
    return await next();
  }

  const userId = await resolveUserId(c);
  if (!userId) {
    return c.json({ message: "unauthorized" }, 401);
  }
  c.set("userId", userId);
  await next();
};

async function resolveUserId(c: Context<AppEnv>): Promise<string | undefined> {
  const header = c.req.header("authorization");
  const bearer = extractBearer(header);
  const allowImpersonation = Deno.env.get("ALLOW_DEV_IMPERSONATION") === "true";
  const fallback = allowImpersonation
    ? c.req.header("x-user-id")?.trim()
    : undefined;

  if (bearer && isJwt(bearer)) {
    const projectId = firebaseProjectId();
    if (projectId) {
      const uid = await verifyFirebaseIdToken(bearer, projectId);
      if (uid) return uid;
    }
  } else if (bearer) {
    return bearer;
  }

  return fallback || undefined;
}

function extractBearer(authHeader?: string | null): string | undefined {
  if (!authHeader) return undefined;
  const matches = authHeader.match(/^Bearer (.+)$/i);
  return matches?.[1]?.trim();
}

function isJwt(token: string): boolean {
  return token.split(".").length === 3;
}

async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
): Promise<string | undefined> {
  const kid = parseKid(token);
  if (!kid) return undefined;

  try {
    const key = await getFirebasePublicKey(kid);
    if (!key) return undefined;
    const claims = await verify(token, key) as FirebaseClaims;
    if (!isExpectedIssuer(claims.iss, projectId)) return undefined;
    if (claims.aud !== projectId) return undefined;
    const uid = claims.user_id ?? claims.sub;
    return typeof uid === "string" ? uid : undefined;
  } catch {
    return undefined;
  }
}

function parseKid(token: string): string | undefined {
  try {
    const [header] = decode(token);
    if (header && typeof header === "object" && "kid" in header) {
      const kid = (header as Record<string, unknown>).kid;
      return typeof kid === "string" ? kid : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function isExpectedIssuer(iss: string | undefined, projectId: string): boolean {
  return iss === `${FIREBASE_ISSUER_PREFIX}${projectId}`;
}

function firebaseProjectId(): string | undefined {
  return Deno.env.get("FIREBASE_PROJECT_ID") ??
    Deno.env.get("GOOGLE_CLOUD_PROJECT") ??
    Deno.env.get("FIRESTORE_PROJECT_ID");
}

async function getFirebasePublicKey(
  kid: string,
): Promise<CryptoKey | undefined> {
  const cached = keyCache.get(kid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  const keys = await loadJwks();
  const jwk = keys.find((k) => extractKid(k) === kid);
  if (!jwk) return undefined;

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const expiresAt = jwksCache?.expiresAt ?? (Date.now() + DEFAULT_CACHE_TTL_MS);
  keyCache.set(kid, { key: cryptoKey, expiresAt });
  return cryptoKey;
}

async function loadJwks(): Promise<JsonWebKey[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase JWKS: ${response.status}`);
  }
  const body = await response.json() as { keys?: JsonWebKey[] };
  const maxAge = parseCacheControl(response.headers.get("cache-control"));
  const expiresAt = Date.now() + (maxAge ?? DEFAULT_CACHE_TTL_MS);
  jwksCache = { keys: body.keys ?? [], expiresAt };
  return jwksCache.keys;
}

function extractKid(jwk: JsonWebKey): string | undefined {
  const kid = (jwk as Record<string, unknown>).kid;
  return typeof kid === "string" ? kid : undefined;
}

function parseCacheControl(cacheControl: string | null): number | undefined {
  if (!cacheControl) return undefined;
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  if (!maxAgeMatch) return undefined;
  return Number(maxAgeMatch[1]) * 1000;
}

export type AppEnv = {
  Variables: {
    userId: string;
  };
};
