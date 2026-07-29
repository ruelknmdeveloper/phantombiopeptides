import "server-only";
import { env } from "@/env";
import { WooError } from "@/services/woocommerce";

/**
 * Thin fetch clients for the WordPress side.
 *
 *  - `phantom(path, {…})`  — /wp-json/phantom/v1/* endpoints from our
 *    companion plugin. Takes an optional bearer JWT for user-scoped
 *    reads/writes, or a service token for server-to-server calls.
 *
 *  - `jwtAuth(path, {…})`  — /wp-json/jwt-auth/v1/* endpoints from the
 *    JWT Authentication for WP REST API plugin (used for password
 *    login).
 */

interface PhantomFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  bearer?: string;
  /** Include the service token header (for /auth/register, /activity POST). */
  service?: boolean;
  revalidate?: number | false;
  tags?: string[];
}

function base(): string {
  if (!env.WC_STORE_URL) {
    throw new WooError("WC_STORE_URL is not configured.", 500);
  }
  return env.WC_STORE_URL.replace(/\/$/, "");
}

async function wpRequest<T>(
  path: string,
  opts: PhantomFetchOptions,
): Promise<T> {
  const { body, bearer, service, revalidate, tags, headers, ...rest } = opts;
  const method = (rest.method ?? "GET").toUpperCase();
  const isWrite = method !== "GET";

  const hdrs: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent":
      "PhantomBiopeptides-Nextjs/1.0 (+https://phantombiopeptides.com)",
    ...(headers as Record<string, string> | undefined),
  };
  if (bearer) hdrs.Authorization = `Bearer ${bearer}`;
  if (service) {
    if (!env.PHANTOM_SERVICE_TOKEN) {
      throw new WooError("PHANTOM_SERVICE_TOKEN is not configured.", 500);
    }
    hdrs["X-Phantom-Service-Token"] = env.PHANTOM_SERVICE_TOKEN;
  }

  const res = await fetch(`${base()}${path}`, {
    ...rest,
    headers: hdrs,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
    cache: isWrite ? "no-store" : undefined,
    next: isWrite
      ? undefined
      : revalidate === false
        ? { revalidate: 0 }
        : { revalidate: revalidate ?? 60, tags },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new WooError(
      `WordPress request failed: ${res.status} ${res.statusText}`,
      res.status,
      detail,
    );
  }
  return (await res.json()) as T;
}

export function phantom<T>(path: string, opts: PhantomFetchOptions = {}) {
  return wpRequest<T>(`/wp-json/phantom/v1${path}`, opts);
}

export function jwtAuth<T>(path: string, opts: PhantomFetchOptions = {}) {
  return wpRequest<T>(`/wp-json/jwt-auth/v1${path}`, opts);
}
