import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.ComponentProps<"input">;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors",
        className,
      )}
      // Chromium's password manager + Bitwarden/1Password extensions
      // inject inline styles (e.g. `caret-color: transparent`) before
      // hydration, tripping React's mismatch check on every keystroke-
      // capable input. That's exactly the case suppressHydrationWarning
      // exists for — the DOM diff is user-agent behaviour, not a bug.
      suppressHydrationWarning
      {...props}
    />
  );
}
