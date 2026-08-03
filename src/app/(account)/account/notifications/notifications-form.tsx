"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateNotificationsAction,
  type AccountActionState,
} from "@/app/actions/account";
import type { NotificationPrefs } from "@/services/account";

const initial: AccountActionState = { ok: false };

const TOPICS: Array<{
  key: keyof Omit<NotificationPrefs, "channels">;
  label: string;
  hint: string;
}> = [
  { key: "order_updates", label: "Order updates", hint: "Confirmation, dispatch, delivery" },
  { key: "back_in_stock", label: "Back in stock", hint: "When a product on your wishlist restocks" },
  { key: "price_drops", label: "Price drops", hint: "When wishlist items go on sale" },
  { key: "new_arrivals", label: "New arrivals", hint: "First look at newly launched research compounds" },
  { key: "promotions", label: "Promotions", hint: "Occasional offers and discount codes" },
  { key: "newsletter", label: "Newsletter", hint: "Monthly research digest and lab updates" },
];

const CHANNELS: Array<{ key: keyof NotificationPrefs["channels"]; label: string; hint?: string }> = [
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS", hint: "Coming soon" },
  { key: "push", label: "Web push", hint: "Coming soon" },
];

export function NotificationsForm({ initial: prefs }: { initial: NotificationPrefs }) {
  const [state, formAction, pending] = useActionState(
    updateNotificationsAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-8">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Topics
        </h3>
        <ul className="mt-3 divide-y rounded-2xl border border-border bg-card">
          {TOPICS.map((t) => (
            <li key={t.key} className="flex items-start gap-3 p-4">
              <input
                id={`topic-${t.key}`}
                type="checkbox"
                name={t.key}
                defaultChecked={prefs[t.key]}
                className="mt-1 h-4 w-4 accent-[color:hsl(var(--brand-500))]"
              />
              <label htmlFor={`topic-${t.key}`} className="cursor-pointer">
                <span className="text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {t.hint}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Channels
        </h3>
        <ul className="mt-3 divide-y rounded-2xl border border-border bg-card">
          {CHANNELS.map((c) => {
            const isReady = c.key === "email";
            return (
              <li key={c.key} className="flex items-start gap-3 p-4">
                <input
                  id={`ch-${c.key}`}
                  type="checkbox"
                  name={`channel_${c.key}`}
                  defaultChecked={prefs.channels[c.key]}
                  disabled={!isReady}
                  className="mt-1 h-4 w-4 accent-[color:hsl(var(--brand-500))] disabled:cursor-not-allowed disabled:opacity-40"
                />
                <label
                  htmlFor={`ch-${c.key}`}
                  className={`cursor-pointer ${isReady ? "" : "opacity-60"}`}
                >
                  <span className="text-sm font-medium">{c.label}</span>
                  {c.hint && (
                    <span className="block text-xs text-muted-foreground">
                      {c.hint}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-2 text-sm text-brand-700">
          {state.message}
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
