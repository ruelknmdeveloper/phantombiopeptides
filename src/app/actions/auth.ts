"use server";

import { redirect } from "next/navigation";
import { setSessionCookie, clearSessionCookie } from "@/lib/wp-auth";
import { phantom, jwtAuth } from "@/lib/wp-fetch";
import { CartService } from "@/services/cart";
import { cookies } from "next/headers";

/**
 * Auth server actions. Each one takes FormData so it can be bound
 * directly to a <form action={…}> and used with `useActionState`.
 */

export interface AuthState {
  ok: boolean;
  error?: string;
  message?: string;
}

const GENERIC_ERR: AuthState = {
  ok: false,
  error: "Something went wrong. Please try again.",
};

export async function loginAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  try {
    const res = await jwtAuth<{ token?: string; message?: string }>("/token", {
      method: "POST",
      body: { username: email, password },
    });
    if (!res.token) {
      return { ok: false, error: "Invalid email or password." };
    }
    await setSessionCookie(res.token);
    await mergeGuestWishlistIfAny(res.token);
  } catch {
    // WP returns 403 on bad creds — keep the message generic to avoid
    // account enumeration.
    return { ok: false, error: "Invalid email or password." };
  }

  redirect("/account");
}

export async function setPasswordAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) {
    return { ok: false, error: "Use at least 10 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords don't match." };
  }
  try {
    const res = await phantom<{ ok: boolean; token?: string }>(
      "/auth/set-password",
      { method: "POST", body: { token, password } },
    );
    if (!res.token) return GENERIC_ERR;
    await setSessionCookie(res.token);
    await mergeGuestWishlistIfAny(res.token);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Link invalid or expired.",
    };
  }
  redirect("/account");
}

export async function requestResetAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { ok: false, error: "Enter your email." };
  try {
    await phantom("/auth/request-reset", {
      method: "POST",
      body: { email },
    });
  } catch {
    /* swallow — response is always generic */
  }
  return {
    ok: true,
    message: "If that email is registered, a reset link is on the way.",
  };
}

export async function resetPasswordAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) {
    return { ok: false, error: "Use at least 10 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords don't match." };
  }
  try {
    const res = await phantom<{ ok: boolean; token?: string }>("/auth/reset", {
      method: "POST",
      body: { token, password },
    });
    if (!res.token) return GENERIC_ERR;
    await setSessionCookie(res.token);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Link invalid or expired.",
    };
  }
  redirect("/account");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

/**
 * Post-checkout account activation. Called from the "save this for
 * next time?" prompt on /thank-you. Reads the short-lived intent
 * cookie set by finalizeCheckoutAction, POSTs to the combined
 * register-and-set-password WP endpoint, sets the session cookie,
 * clears the intent cookie.
 *
 * We don't `redirect()` here — the client swaps to a "you're all
 * set" success state in place, so the customer stays on the
 * thank-you page and can see the order confirmation.
 */
export async function activateAccountAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  const marketingConsent = form.get("marketing_consent") === "on";

  if (password.length < 10) {
    return { ok: false, error: "Use at least 10 characters." };
  }

  const store = await cookies();
  const raw = store.get("pl_checkout_intent")?.value;
  if (!raw) {
    return {
      ok: false,
      error:
        "This activation link has expired. Please sign in with the reset password link instead.",
    };
  }

  let intent: {
    order_id?: number;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  try {
    intent = JSON.parse(raw);
  } catch {
    return GENERIC_ERR;
  }

  const email = String(intent.email ?? "").trim();
  if (!email) return GENERIC_ERR;

  try {
    const res = await phantom<{ ok: boolean; token?: string }>(
      "/auth/register-and-set-password",
      {
        method: "POST",
        service: true,
        body: {
          email,
          first_name: intent.first_name ?? "",
          last_name: intent.last_name ?? "",
          password,
          marketing_consent: marketingConsent,
        },
      },
    );
    if (!res.token) return GENERIC_ERR;
    await setSessionCookie(res.token);
    await mergeGuestWishlistIfAny(res.token);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Something went wrong activating your account.",
    };
  }

  store.delete("pl_checkout_intent");
  return { ok: true, message: "signed_in" };
}

/**
 * If the browser holds a guest wishlist (`pl_wishlist_guest` cookie
 * mirror set by the client), forward it to WP so it merges with the
 * user's server-side list. The localStorage-only version continues to
 * work as a fallback and can be cleared client-side after the merge.
 */
async function mergeGuestWishlistIfAny(bearer: string): Promise<void> {
  const store = await cookies();
  const raw = store.get("pl_wishlist_guest")?.value;
  if (!raw) return;
  try {
    const items = JSON.parse(raw) as Array<{
      product_id: number;
      variation_id?: number;
    }>;
    if (!Array.isArray(items) || items.length === 0) return;
    await phantom("/wishlist/merge", {
      method: "POST",
      bearer,
      body: { items: items.slice(0, 200) },
    });
    store.delete("pl_wishlist_guest");
  } catch {
    /* best effort */
  }
  // Touch to keep the cart cookie warm across the login boundary.
  await CartService.get();
}
