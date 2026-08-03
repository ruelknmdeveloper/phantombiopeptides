"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateAccountAction, type AuthState } from "@/app/actions/auth";

const initial: AuthState = { ok: false };

/**
 * Inline "save this for next time?" activation prompt shown on the
 * /thank-you page. Prefill email/name comes from the
 * pl_checkout_intent cookie server-side; we only need the password
 * (and an optional marketing consent) from the customer here.
 */
export function SaveForNextTime({
  firstName,
  email,
}: {
  firstName: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    activateAccountAction,
    initial,
  );
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (state.ok && state.message === "signed_in") {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-brand-200 bg-brand-50/60 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white">
          <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <h2 className="mt-3 text-lg font-medium">
          You&apos;re signed in{firstName ? `, ${firstName}` : ""}.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account is ready. Next checkout will be a lot faster.
        </p>
        <Button asChild className="mt-4">
          <Link href="/account">Go to your account →</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-x-6 -inset-y-4 -z-10 rounded-[36px] opacity-70 blur-2xl"
          style={{
            background:
              "linear-gradient(140deg, hsl(var(--brand-200) / 0.5) 0%, hsl(var(--brand-100) / 0.2) 50%, transparent 100%)",
          }}
        />
        <div className="rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl sm:p-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-700">
              <ShieldCheck className="h-3 w-3" />
              Save this for next time?
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Set a password &amp; get faster checkouts
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Order history, saved addresses, and wishlist — all in one place.
            </p>
          </div>

          <form action={formAction} className="mt-6 space-y-4 text-left">
            <div className="rounded-lg border border-border/70 bg-background-muted px-3 py-2 text-xs text-muted-foreground">
              Signing up as{" "}
              <span className="font-medium text-foreground">{email}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={10}
                  required
                  placeholder="At least 10 characters"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition hover:text-brand-600"
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                name="marketing_consent"
                className="mt-0.5 h-4 w-4 accent-[color:hsl(var(--brand-500))]"
              />
              <span>
                Send me occasional product updates and new arrivals. I can
                unsubscribe anytime.
              </span>
            </label>

            {state.error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Activating…" : "Save & activate account"}
            </Button>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              No thanks — continue as guest
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
