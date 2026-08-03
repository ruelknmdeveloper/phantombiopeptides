"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPasswordAction, type AuthState } from "@/app/actions/auth";

const initial: AuthState = { ok: false };

export function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(setPasswordAction, initial);
  const [show, setShow] = useState(false);

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
            <Sparkles className="h-3 w-3" />
            Almost there
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Set your <span className="text-brand-gradient">password</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose a password to activate your account. Links expire seven days
            after issue.
          </p>
        </div>

        {!token ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            This link is missing its token. Open the link from the email we sent.
          </div>
        ) : (
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="token" value={token} />
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  placeholder="At least 10 characters"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition hover:text-brand-600"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                name="confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={10}
                placeholder="Repeat your password"
              />
            </div>
            {state.error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Set password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
