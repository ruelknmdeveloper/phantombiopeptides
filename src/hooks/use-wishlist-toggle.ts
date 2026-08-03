"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Wishlist toggle logic, shared by the PDP heart (WishlistButton) and
 * the product-card grid heart. Handles both storage modes:
 *
 *   • Signed in  — optimistic localStorage + fire-and-forget POST/DELETE
 *                  to /api/wishlist (which forwards to WordPress).
 *   • Guest      — localStorage only. On next sign-in, wp-auth.ts
 *                  triggers /wishlist/merge to bring these into the
 *                  server list.
 *
 * Auth detected via the `pl_signed_in` non-httpOnly cookie set alongside
 * the JWT session cookie.
 */

const KEY = "pl_wishlist";
const SIGNED_IN_COOKIE = "pl_signed_in";

export interface WishlistItem {
  id: number;
  slug: string;
  name: string;
}

export function isSignedInClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${SIGNED_IN_COOKIE}=1`));
}

function readWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeWishlist(items: WishlistItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("wishlist:change"));
  } catch {
    /* localStorage disabled */
  }
}

async function syncAdd(productId: number) {
  try {
    await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
      keepalive: true,
    });
  } catch {
    /* fire-and-forget */
  }
}

async function syncRemove(productId: number) {
  try {
    await fetch(`/api/wishlist?product_id=${productId}`, {
      method: "DELETE",
      keepalive: true,
    });
  } catch {
    /* fire-and-forget */
  }
}

/**
 * Returns `{ saved, toggle }` — `saved` is the current state for the
 * given product id; `toggle()` flips it, updates localStorage, syncs to
 * WP if signed in, and shows a toast.
 */
export function useWishlistToggle(product: WishlistItem) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(readWishlist().some((p) => p.id === product.id));
    const onChange = () =>
      setSaved(readWishlist().some((p) => p.id === product.id));
    window.addEventListener("wishlist:change", onChange);
    return () => window.removeEventListener("wishlist:change", onChange);
  }, [product.id]);

  const toggle = useCallback(() => {
    const list = readWishlist();
    const exists = list.some((p) => p.id === product.id);
    const signedIn = isSignedInClient();

    if (exists) {
      writeWishlist(list.filter((p) => p.id !== product.id));
      toast("Removed from wishlist");
      if (signedIn) void syncRemove(product.id);
    } else {
      writeWishlist([product, ...list]);
      toast.success(signedIn ? "Saved to your wishlist" : "Saved to wishlist");
      if (signedIn) void syncAdd(product.id);
    }
  }, [product]);

  return { saved, toggle };
}
