"use client";

import { useEffect } from "react";

/**
 * One-shot client effect: when a signed-in visitor lands on any page,
 * check if localStorage holds a guest wishlist that hasn't been synced
 * to the server yet. If so, POST it to /api/wishlist/merge and stamp
 * a sessionStorage marker so we don't re-fire per-page.
 *
 * Sits inside <Providers> in the root layout so it mounts once per
 * SPA session. Renders nothing.
 */

const LOCAL_KEY = "pl_wishlist";
const SYNCED_MARKER = "pl_wishlist_synced";
const SIGNED_IN_COOKIE = "pl_signed_in";

function isSignedIn(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${SIGNED_IN_COOKIE}=1`));
}

export function WishlistSyncOnLogin() {
  useEffect(() => {
    if (!isSignedIn()) return;
    if (sessionStorage.getItem(SYNCED_MARKER) === "1") return;

    let items: Array<{ id: number }> = [];
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) items = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      // Nothing to merge, but still mark so we don't recheck on every route.
      sessionStorage.setItem(SYNCED_MARKER, "1");
      return;
    }

    const payload = items
      .map((i) => ({ product_id: Number(i?.id) }))
      .filter((r) => Number.isInteger(r.product_id) && r.product_id > 0);
    if (payload.length === 0) return;

    fetch("/api/wishlist/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
      keepalive: true,
    })
      .then((r) => r.json().catch(() => null))
      .then((r) => {
        if (r && r.ok) {
          sessionStorage.setItem(SYNCED_MARKER, "1");
          // Nudge any mounted wishlist listeners to re-read localStorage
          // (server list is authoritative from here on, but the button
          // state comes from localStorage which is already up-to-date).
          window.dispatchEvent(new CustomEvent("wishlist:change"));
        }
      })
      .catch(() => {
        /* silently retry next session */
      });
  }, []);

  return null;
}
