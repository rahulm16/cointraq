import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE, SESSION_MAX_AGE_DAYS } from "./constants";

const MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return new TextEncoder().encode(s);
}

/** Sign a session JWT (30-day expiry). SPEC §10. */
export async function signSession(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_DAYS}d`)
    .sign(secret());
}

/** Verify a session JWT; returns true when valid and unexpired. */
export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionMaxAge = MAX_AGE_SECONDS;

/**
 * Resolve the bcrypt hash from APP_PASSWORD_HASH, accepting either form:
 *  - base64 of the hash (recommended — no "$" so Next's .env expansion leaves it
 *    alone; the hash-password script prints this)
 *  - a raw bcrypt hash starting with "$2" (works if you escaped the "$" in .env)
 * Returns null when unset. Never throws on malformed base64.
 */
export function resolvePasswordHash(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v.startsWith("$2")) return v; // already a raw bcrypt hash
  try {
    const decoded = Buffer.from(v, "base64").toString("utf8");
    if (decoded.startsWith("$2")) return decoded;
  } catch {
    /* fall through */
  }
  return v; // last resort: use as-is (will simply fail to match)
}
