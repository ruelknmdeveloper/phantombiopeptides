import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative min-h-[calc(100dvh-4rem)] overflow-hidden px-4 py-16"
      style={{
        background:
          "radial-gradient(1200px 500px at 85% -10%, hsl(var(--brand-100) / 0.9) 0%, transparent 65%)," +
          "radial-gradient(900px 400px at -10% 110%, hsl(var(--brand-50) / 1) 0%, transparent 55%)," +
          "hsl(var(--background))",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          background:
            "radial-gradient(circle at 1px 1px, hsl(var(--brand-500)) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative grid min-h-[calc(100dvh-4rem-8rem)] place-items-center">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
