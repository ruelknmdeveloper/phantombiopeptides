"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAddressesAction,
  type AccountActionState,
} from "@/app/actions/account";
import type { WcAccountAddress } from "@/services/account";

interface Props {
  billing: WcAccountAddress;
  shipping: WcAccountAddress;
}

const empty: AccountActionState = { ok: false };

export function AddressesForm({ billing, shipping }: Props) {
  const [state, formAction, pending] = useActionState(
    updateAddressesAction,
    empty,
  );
  const [sameAsBilling, setSameAsBilling] = useState(false);

  return (
    <form action={formAction} className="space-y-8">
      <AddressBlock prefix="billing" title="Billing address" initial={billing} withContact />

      <div className="rounded-2xl border border-border bg-card p-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={sameAsBilling}
            onChange={(e) => setSameAsBilling(e.target.checked)}
            className="h-4 w-4 accent-[color:hsl(var(--brand-500))]"
          />
          Shipping address is the same as billing
        </label>
      </div>

      {!sameAsBilling && (
        <AddressBlock
          prefix="shipping"
          title="Shipping address"
          initial={shipping}
        />
      )}

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
        {pending ? "Saving…" : "Save addresses"}
      </Button>

      {sameAsBilling && (
        <MirrorHiddenFields prefix="shipping" mirror="billing" />
      )}
    </form>
  );
}

function AddressBlock({
  prefix,
  title,
  initial,
  withContact = false,
}: {
  prefix: "billing" | "shipping";
  title: string;
  initial: WcAccountAddress;
  withContact?: boolean;
}) {
  const F = (name: keyof WcAccountAddress) => `${prefix}_${name}`;
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldWrap id={F("first_name")} label="First name">
          <Input id={F("first_name")} name={F("first_name")} defaultValue={initial.first_name ?? ""} />
        </FieldWrap>
        <FieldWrap id={F("last_name")} label="Last name">
          <Input id={F("last_name")} name={F("last_name")} defaultValue={initial.last_name ?? ""} />
        </FieldWrap>
      </div>
      <FieldWrap id={F("company")} label="Company (optional)">
        <Input id={F("company")} name={F("company")} defaultValue={initial.company ?? ""} />
      </FieldWrap>
      <FieldWrap id={F("address_1")} label="Address">
        <Input id={F("address_1")} name={F("address_1")} defaultValue={initial.address_1 ?? ""} />
      </FieldWrap>
      <FieldWrap id={F("address_2")} label="Apt / suite (optional)">
        <Input id={F("address_2")} name={F("address_2")} defaultValue={initial.address_2 ?? ""} />
      </FieldWrap>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldWrap id={F("city")} label="City">
          <Input id={F("city")} name={F("city")} defaultValue={initial.city ?? ""} />
        </FieldWrap>
        <FieldWrap id={F("state")} label="State / region">
          <Input id={F("state")} name={F("state")} defaultValue={initial.state ?? ""} />
        </FieldWrap>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldWrap id={F("postcode")} label="Postal code">
          <Input id={F("postcode")} name={F("postcode")} defaultValue={initial.postcode ?? ""} />
        </FieldWrap>
        <FieldWrap id={F("country")} label="Country (ISO code)">
          <Input
            id={F("country")}
            name={F("country")}
            defaultValue={initial.country ?? ""}
            placeholder="e.g. US"
            maxLength={2}
          />
        </FieldWrap>
      </div>
      {withContact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldWrap id={F("email")} label="Contact email">
            <Input
              id={F("email")}
              name={F("email")}
              type="email"
              autoComplete="email"
              defaultValue={initial.email ?? ""}
            />
          </FieldWrap>
          <FieldWrap id={F("phone")} label="Contact phone">
            <Input
              id={F("phone")}
              name={F("phone")}
              type="tel"
              autoComplete="tel"
              defaultValue={initial.phone ?? ""}
            />
          </FieldWrap>
        </div>
      )}
    </section>
  );
}

function FieldWrap({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * When "same as billing" is checked we hide the shipping form but the
 * server still needs those fields. Copy the billing values into
 * hidden inputs on submit.
 */
function MirrorHiddenFields({
  prefix,
  mirror,
}: {
  prefix: "billing" | "shipping";
  mirror: "billing" | "shipping";
}) {
  const keys = [
    "first_name", "last_name", "company",
    "address_1", "address_2", "city",
    "state", "postcode", "country",
  ];
  return (
    <>
      {keys.map((k) => (
        <input
          key={k}
          type="hidden"
          name={`${prefix}_${k}`}
          data-mirror-source={`${mirror}_${k}`}
          value=""
          ref={(el) => {
            if (!el) return;
            const source = document.getElementById(`${mirror}_${k}`) as
              | HTMLInputElement
              | null;
            if (source) el.value = source.value;
          }}
        />
      ))}
    </>
  );
}
