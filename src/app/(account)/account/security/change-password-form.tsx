"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  type AccountActionState,
} from "@/app/actions/account";

const empty: AccountActionState = { ok: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, empty);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="space-y-4" key={state.ok ? "reset" : "form"}>
      <div className="space-y-1.5">
        <Label htmlFor="current_password">Current password</Label>
        <div className="relative">
          <Input
            id="current_password"
            name="current_password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide passwords" : "Show passwords"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition hover:text-brand-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new_password">New password</Label>
        <Input
          id="new_password"
          name="new_password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={10}
          placeholder="At least 10 characters"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={10}
        />
      </div>

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
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
