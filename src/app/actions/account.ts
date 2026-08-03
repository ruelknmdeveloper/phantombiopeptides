"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/wp-auth";
import { phantom } from "@/lib/wp-fetch";

/**
 * Server actions for the /account/* pages. Each takes FormData so it
 * can be bound to a <form action={…}> and used with useActionState.
 * All require a signed-in session; unauth = a friendly generic error.
 */

export interface AccountActionState {
  ok: boolean;
  error?: string;
  message?: string;
}

const NEED_AUTH: AccountActionState = {
  ok: false,
  error: "Your session expired. Please sign in again.",
};
const GENERIC_ERR: AccountActionState = {
  ok: false,
  error: "Something went wrong. Please try again.",
};

async function requireBearer(): Promise<string | null> {
  const session = await getSession();
  return session?.token ?? null;
}

// ── Profile ───────────────────────────────────────────────────

export async function updateProfileAction(
  _prev: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const bearer = await requireBearer();
  if (!bearer) return NEED_AUTH;

  const first_name = String(form.get("first_name") ?? "").trim();
  const last_name = String(form.get("last_name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const birthday = String(form.get("birthday") ?? "").trim();
  const marketing = form.get("pl_marketing_consent") === "on";

  try {
    await phantom("/me", {
      method: "PATCH",
      bearer,
      body: {
        first_name,
        last_name,
        phone,
        pl_birthday: birthday || undefined,
        pl_marketing_consent: marketing,
      },
    });
  } catch {
    return GENERIC_ERR;
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true, message: "Profile updated." };
}

// ── Addresses ─────────────────────────────────────────────────

function readAddress(form: FormData, prefix: "billing" | "shipping") {
  const keys = [
    "first_name", "last_name", "company",
    "address_1", "address_2", "city",
    "state", "postcode", "country",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = String(form.get(`${prefix}_${k}`) ?? "").trim();
    out[k] = v;
  }
  if (prefix === "billing") {
    out.email = String(form.get("billing_email") ?? "").trim();
    out.phone = String(form.get("billing_phone") ?? "").trim();
  }
  return out;
}

export async function updateAddressesAction(
  _prev: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const bearer = await requireBearer();
  if (!bearer) return NEED_AUTH;

  const billing = readAddress(form, "billing");
  const shipping = readAddress(form, "shipping");

  try {
    await phantom("/me", {
      method: "PATCH",
      bearer,
      body: { billing, shipping },
    });
  } catch {
    return GENERIC_ERR;
  }

  revalidatePath("/account/addresses");
  return { ok: true, message: "Addresses saved." };
}

// ── Notification prefs ────────────────────────────────────────

export async function updateNotificationsAction(
  _prev: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const bearer = await requireBearer();
  if (!bearer) return NEED_AUTH;

  const body = {
    order_updates: form.get("order_updates") === "on",
    back_in_stock: form.get("back_in_stock") === "on",
    price_drops: form.get("price_drops") === "on",
    new_arrivals: form.get("new_arrivals") === "on",
    promotions: form.get("promotions") === "on",
    newsletter: form.get("newsletter") === "on",
    channels: {
      email: form.get("channel_email") === "on",
      sms: form.get("channel_sms") === "on",
      push: form.get("channel_push") === "on",
    },
  };

  try {
    await phantom("/notifications", { method: "PUT", bearer, body });
  } catch {
    return GENERIC_ERR;
  }

  revalidatePath("/account/notifications");
  return { ok: true, message: "Preferences saved." };
}

// ── Security ──────────────────────────────────────────────────

export async function changePasswordAction(
  _prev: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const bearer = await requireBearer();
  if (!bearer) return NEED_AUTH;

  const current_password = String(form.get("current_password") ?? "");
  const new_password = String(form.get("new_password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (new_password.length < 10) {
    return { ok: false, error: "Use at least 10 characters." };
  }
  if (new_password !== confirm) {
    return { ok: false, error: "New passwords don't match." };
  }

  try {
    await phantom("/auth/change-password", {
      method: "POST",
      bearer,
      body: { current_password, new_password },
    });
  } catch (err) {
    // WordPress returns descriptive errors here — surface them so users
    // know if it was "current password wrong" vs "weak password".
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? "Current password is incorrect."
          : GENERIC_ERR.error,
    };
  }
  return { ok: true, message: "Password changed." };
}

// ── Wishlist ──────────────────────────────────────────────────

export async function removeWishlistItemAction(
  productId: number,
): Promise<AccountActionState> {
  const bearer = await requireBearer();
  if (!bearer) return NEED_AUTH;

  try {
    await phantom(`/wishlist/${productId}`, { method: "DELETE", bearer });
  } catch {
    return GENERIC_ERR;
  }

  const userId = (await getSession())?.userId;
  if (userId) revalidateTag(`user:${userId}:wishlist`, "default");
  revalidatePath("/account/wishlist");
  return { ok: true };
}
