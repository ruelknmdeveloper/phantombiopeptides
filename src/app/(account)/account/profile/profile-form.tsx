"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateProfileAction,
  type AccountActionState,
} from "@/app/actions/account";

interface Initial {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birthday: string;
  marketing_consent: boolean;
}

const empty: AccountActionState = { ok: false };

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, empty);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" name="first_name" defaultValue={initial.first_name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" defaultValue={initial.last_name} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" defaultValue={initial.email} disabled />
        <p className="text-xs text-muted-foreground">
          Contact support to change your email address.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={initial.phone}
            placeholder="+1 415 555 0119"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthday">Birthday (optional)</Label>
          <Input
            id="birthday"
            name="birthday"
            type="date"
            defaultValue={initial.birthday}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <input
          type="checkbox"
          name="pl_marketing_consent"
          defaultChecked={initial.marketing_consent}
          className="mt-0.5 h-4 w-4 accent-[color:hsl(var(--brand-500))]"
        />
        <span>
          <span className="font-medium text-foreground">Marketing emails</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Occasional product updates, new arrivals, and offers. You can
            unsubscribe anytime.
          </span>
        </span>
      </label>

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
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
