"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type AuthState } from "@/app/actions/auth";

const initial: AuthState = { ok: false };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-x-6 -inset-y-4 -z-10 rounded-[36px] blur-2xl opacity-70"
        style={{
          background:
            "linear-gradient(140deg, hsl(var(--brand-200) / 0.5) 0%, hsl(var(--brand-100) / 0.2) 50%, transparent 100%)",
        }}
      />
      <div className="rounded-3xl border border-border/70 bg-card/80 p-8 shadow-[0_30px_80px_-40px_hsl(var(--brand-500)/0.35)] backdrop-blur-xl sm:p-10">
        <div className="mb-8 space-y-2 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-700">
            <ShieldCheck className="h-3 w-3" />
            Secure sign-in
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back to <span className="text-brand-gradient">Phantom</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Access your orders, saved items, and preferences.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/account/reset"
                className="text-xs font-medium text-brand-600 hover:text-brand-500"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition hover:text-brand-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {state.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        New to Phantom? Place an order and your account is created automatically —
        no signup form needed.
      </p>
    </div>
  );
}
