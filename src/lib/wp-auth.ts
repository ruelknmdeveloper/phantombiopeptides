import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

/**
 * Session cookie management + HS256 JWT verification.
 *
 * The JWT itself is minted by WordPress (JWT Authentication for WP
 * REST API plugin, or our own phantom-accounts endpoints). Both sides
 * sign with the shared `JWT_AUTH_SECRET_KEY`, so any token issued by
 * WP validates here and vice-versa.
 *
 * We deliberately avoid a heavy JWT library — this file uses only the
 * Node built-in `crypto` module. If we ever move auth checks to the
 * Edge runtime, swap in `jose`.
 */

const SESSION_COOKIE = "pl_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface WpJwtPayload {
  iss?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  data?: { user?: { id?: string | number } };
}

export interface WpSession {
  userId: number;
  token: string;
}

function b64urlDecode(input: string): Buffer {
  const pad = 4 - (input.length % 4 || 4);
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad % 4);
  return Buffer.from(b64, "base64");
}

/**
 * Verify an HS256 JWT signed with JWT_AUTH_SECRET_KEY. Returns the
 * payload on success, null on any failure (bad signature, expired,
 * malformed). Never throws — callers should treat null as unauth.
 */
export function verifyJwt(token: string): WpJwtPayload | null {
  if (!env.JWT_AUTH_SECRET_KEY) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = JSON.parse(b64urlDecode(headerB64).toString("utf8"));
    if (header.alg !== "HS256") return null;

    const expected = createHmac("sha256", env.JWT_AUTH_SECRET_KEY)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const actual = b64urlDecode(signatureB64);
    if (expected.length !== actual.length) return null;
    if (!timingSafeEqual(expected, actual)) return null;

    const payload = JSON.parse(
      b64urlDecode(payloadB64).toString("utf8"),
    ) as WpJwtPayload;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;
    if (typeof payload.nbf === "number" && payload.nbf > now + 5) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Read + verify the current session cookie. Returns null if missing or
 * invalid. Callers that need to gate a page should call `requireSession`
 * instead.
 */
export async function getSession(): Promise<WpSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyJwt(token);
  const rawId = payload?.data?.user?.id;
  const userId =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? parseInt(rawId, 10)
        : NaN;
  if (!Number.isFinite(userId) || userId <= 0) return null;
  return { userId, token };
}
