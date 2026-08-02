import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { QuizFlow } from "./quiz-form";

const LOGO_SRC =
  "https://i0.wp.com/kickbackai-pkjdo.wpcomstaging.com/wp-content/uploads/2026/06/PHANTOM-BIO-LABS-4.png?w=1500&ssl=1";

export const metadata: Metadata = {
  title: "Peptide research quiz",
  description:
    "Answer 5 quick questions and get our free Researcher's Field Guide to Peptide Handling.",
  robots: { index: false, follow: false },
};

export default function QuizPage() {
  return (
    <div
      // `data-bare-page` triggers the site-chrome-hiding CSS in
      // globals.css so this route renders standalone (no navbar,
      // footer, cart drawer, age gate, promo modal, or back-to-top).
      data-bare-page
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
      <div className="relative mx-auto max-w-xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link
            href="/"
            aria-label="Phantom Bio Peptides — home"
            className="inline-flex items-center"
          >
            <Image
              src={LOGO_SRC}
              alt="Phantom Bio Peptides"
              width={1500}
              height={600}
              priority
              sizes="180px"
              className="h-10 w-auto"
            />
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            99% HPLC verified · ISL Labs certified
          </p>
        </div>
        <QuizFlow />
      </div>
    </div>
  );
}
