"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Peptide research quiz — lead-capture funnel that posts to /api/quiz-lead
 * (which forwards to WordPress via the phantom-accounts plugin).
 *
 * Fire-and-forget on both partial and complete submissions, exactly as
 * the vendor spec called for — the user experience never blocks on the
 * network. The completed POST returns the guide PDF URL so we can show
 * an on-screen download link even if the email is slow.
 */

interface Question {
  id: "q1" | "q2" | "q3" | "q4" | "q5";
  multi: boolean;
  title: string;
  note?: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    id: "q1", multi: false,
    title: "What brought you to Phantom Bio Peptides today?",
    options: [
      "I'm completely new to peptide research",
      "I keep hearing about peptides and want to learn more",
      "I'm researching a specific compound",
      "I want to compare different peptide categories",
      "I'm looking for a reliable research supplier",
      "Someone referred me to Phantom",
    ],
  },
  {
    id: "q2", multi: false,
    title: "Which area of peptide research interests you most?",
    options: [
      "Metabolic and appetite-signaling research",
      "Skin and cosmetic research",
      "Tissue-repair and inflammatory-pathway research",
      "Cognitive, neurological, and sleep research",
      "Mitochondrial, energy, and longevity research",
      "Growth-hormone and endocrine research",
      "Reproductive and hormonal research",
      "I'm not sure yet",
    ],
  },
  {
    id: "q3", multi: true,
    title: "Which compounds are you most interested in learning about?",
    note: "Select all that apply",
    options: [
      "Semaglutide, Tirzepatide, Retatrutide, or Cagrilintide",
      "BPC-157, TB-500, KPV, GLOW, or KLOW",
      "GHK-Cu or Snap-8",
      "Semax, Selank, DSIP, or Pinealon",
      "MOTS-c, SS-31, Epithalon, NAD+, or Glutathione",
      "CJC + Ipamorelin, Tesamorelin, GHRP-2, GHRP-6, or IGF-1 LR3",
      "HCG, Kisspeptin, PT-141, or MT-2",
      "I'm not sure which compound yet",
    ],
  },
  {
    id: "q4", multi: false,
    title: "What would you most like to understand?",
    options: [
      "What different peptides are",
      "What researchers study them for",
      "How similar compounds compare",
      "Scientific mechanisms and receptor pathways",
      "Human evidence versus laboratory or animal research",
      "Risks, limitations, and regulatory status",
      "COAs, purity testing, and product documentation",
      "A beginner-friendly overview of everything",
    ],
  },
  {
    id: "q5", multi: false,
    title: "How familiar are you with peptide research?",
    options: [
      "I'm completely new",
      "I know a few basic terms",
      "I've researched several compounds",
      "I regularly read studies and scientific content",
      "I work in a scientific, medical, or laboratory-related field",
    ],
  },
];

type StepIndex = number;

type ContactState = { firstName: string; phone: string; email: string };
type AnswersState = Record<Question["id"], string | string[]>;

const INITIAL_ANSWERS: AnswersState = {
  q1: "", q2: "", q3: [], q4: "", q5: "",
};

const TOTAL_STEPS = 1 /* contact */ + QUESTIONS.length + 1 /* consent */;

export function QuizFlow() {
  const [step, setStep] = useState<StepIndex>(0);
  const [contact, setContact] = useState<ContactState>({
    firstName: "", phone: "", email: "",
  });
  const [answers, setAnswers] = useState<AnswersState>(INITIAL_ANSWERS);
  const [consent, setConsent] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedSig = useRef<string>("");

  useEffect(() => {
    setError(null);
  }, [step]);

  const progress = Math.min(100, Math.round((step / TOTAL_STEPS) * 100));
  const isContact = step === 0;
  const isConsent = step === TOTAL_STEPS - 1;
  const isDone = step >= TOTAL_STEPS;
  const currentQuestion = !isContact && !isConsent && !isDone
    ? QUESTIONS[step - 1]
    : null;

  function postLead(payload: unknown) {
    // Fire-and-forget — never block the UI on WP.
    fetch("/api/quiz-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (data && typeof data.pdf_url === "string") {
          setPdfUrl(data.pdf_url);
        }
      })
      .catch(() => {
        /* swallow — client already validated */
      });
  }

  function captureStarted() {
    const sig = `${contact.email}|${contact.phone}|${contact.firstName}`;
    if (sig === startedSig.current) return;
    startedSig.current = sig;
    postLead({
      stage: "started",
      first_name: contact.firstName,
      phone: contact.phone,
      email: contact.email,
      referrer: document.referrer || undefined,
      ...readUtm(),
    });
  }

  function captureCompleted() {
    postLead({
      stage: "completed",
      first_name: contact.firstName,
      phone: contact.phone,
      email: contact.email,
      consent: true,
      answers: QUESTIONS.map((q) => ({
        id: q.id,
        question: q.title,
        answer: answers[q.id],
      })),
      referrer: document.referrer || undefined,
      ...readUtm(),
    });
  }

  function next() {
    if (isContact) {
      if (!contact.firstName.trim()) return setError("Please enter your first name.");
      if (contact.phone.replace(/[^0-9]/g, "").length < 7) return setError("Please enter a valid phone number.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) return setError("Please enter a valid email address.");
      captureStarted();
      setStep(1);
      return;
    }
    if (currentQuestion) {
      const value = answers[currentQuestion.id];
      const empty = currentQuestion.multi ? (value as string[]).length === 0 : !value;
      if (empty) return setError("Please choose an option to continue.");
      setStep(step + 1);
      return;
    }
    if (isConsent) {
      if (!consent) return setError("Please confirm to receive your guide.");
      captureCompleted();
      setStep(TOTAL_STEPS);
    }
  }

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
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/85 shadow-[0_30px_80px_-40px_hsl(var(--brand-500)/0.35)] backdrop-blur-xl">
        <div className="h-1 w-full bg-brand-50">
          <div
            className="h-full transition-[width] duration-500"
            style={{
              width: `${isDone ? 100 : progress}%`,
              background:
                "linear-gradient(90deg, hsl(var(--brand-500)), hsl(var(--brand-300)))",
            }}
          />
        </div>

        <div className="p-8 sm:p-10">
          {isDone ? (
            <DoneStep firstName={contact.firstName} email={contact.email} pdfUrl={pdfUrl} />
          ) : isConsent ? (
            <ConsentStep
              consent={consent}
              onToggle={() => setConsent((c) => !c)}
              onBack={() => setStep(step - 1)}
              onSubmit={next}
              error={error}
            />
          ) : isContact ? (
            <ContactStep
              contact={contact}
              setContact={setContact}
              onNext={next}
              error={error}
            />
          ) : currentQuestion ? (
            <QuestionStep
              q={currentQuestion}
              index={step}
              total={QUESTIONS.length}
              value={answers[currentQuestion.id]}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [currentQuestion.id]: v }))
              }
              onBack={() => setStep(step - 1)}
              onNext={next}
              error={error}
            />
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        FDA Disclosure: The statements on this website have not been evaluated
        by the U.S. Food and Drug Administration. Compounds are for laboratory
        research and in-vitro use only — not for human consumption.
      </p>
    </div>
  );
}

function ContactStep({
  contact, setContact, onNext, error,
}: {
  contact: ContactState;
  setContact: (v: ContactState) => void;
  onNext: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-700">
          Free Research Guide
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Take the <span className="text-brand-gradient">60-second</span> research quiz
        </h1>
        <p className="text-sm text-muted-foreground">
          Answer 5 quick questions and get our free Researcher&apos;s Field
          Guide to Peptide Handling. First, where should we send it?
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => { e.preventDefault(); onNext(); }}
      >
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            value={contact.firstName}
            onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={contact.email}
            onChange={(e) => setContact({ ...contact, email: e.target.value })}
            required
          />
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" className="w-full">
          Start the quiz →
        </Button>
      </form>
    </div>
  );
}

function QuestionStep({
  q, index, total, value, onChange, onBack, onNext, error,
}: {
  q: Question;
  index: number;
  total: number;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
}) {
  const selected = (opt: string) =>
    q.multi ? (value as string[]).includes(opt) : value === opt;

  function toggle(opt: string) {
    if (q.multi) {
      const next = (value as string[]).includes(opt)
        ? (value as string[]).filter((v) => v !== opt)
        : [...(value as string[]), opt];
      onChange(next);
    } else {
      onChange(opt);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-700">
          Question {index} of {total}
          {q.note ? ` · ${q.note}` : ""}
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {q.title}
        </h2>
      </div>

      <div className="space-y-2">
        {q.options.map((opt) => {
          const isSel = selected(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                isSel
                  ? "border-brand-500 bg-brand-50/60"
                  : "border-border hover:border-brand-300 hover:bg-brand-50/30",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center border-2 transition",
                  q.multi ? "rounded-md" : "rounded-full",
                  isSel
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-border-strong bg-background",
                )}
              >
                {isSel && <Check className="h-3 w-3" strokeWidth={3.5} />}
              </span>
              <span className="text-sm text-foreground">{opt}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="button" size="lg" onClick={onNext} className="flex-1">
          Continue →
        </Button>
      </div>
    </div>
  );
}

function ConsentStep({
  consent, onToggle, onBack, onSubmit, error,
}: {
  consent: boolean;
  onToggle: () => void;
  onBack: () => void;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-700">
          <ShieldCheck className="h-3 w-3" />
          One last step
        </span>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Get your <span className="text-brand-gradient">free guide</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Confirm below and we&apos;ll send your Researcher&apos;s Field Guide
          to Peptide Handling straight to your inbox.
        </p>
      </div>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
          consent
            ? "border-brand-500 bg-brand-50/60"
            : "border-border hover:border-brand-300",
        )}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={onToggle}
          className="mt-1 h-4 w-4 accent-[color:hsl(var(--brand-500))]"
        />
        <span className="text-sm leading-relaxed text-muted-foreground">
          I confirm I am acquiring materials for laboratory research use only,
          and I agree to receive my research guide and related research
          resources from Phantom Bio Peptides. I can unsubscribe anytime.
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="button" size="lg" onClick={onSubmit} className="flex-1">
          Send my guide →
        </Button>
      </div>
    </div>
  );
}

function DoneStep({
  firstName, email, pdfUrl,
}: {
  firstName: string;
  email: string;
  pdfUrl: string | null;
}) {
  return (
    <div className="space-y-6 text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--brand-500)) 0%, hsl(var(--brand-300)) 100%)",
        }}
      >
        <Check className="h-8 w-8 text-white" strokeWidth={3} />
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          You&apos;re all set, {firstName || "researcher"}.
        </h2>
        <p className="text-sm text-muted-foreground">
          Your Researcher&apos;s Field Guide is on its way to{" "}
          <strong className="text-foreground">{email}</strong>. Check your inbox
          (and spam folder, just in case).
        </p>
      </div>

      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
        >
          <Download className="h-4 w-4" />
          Download the guide now
        </a>
      )}

      <a
        href="/shop"
        className="block text-sm text-brand-600 hover:text-brand-500"
      >
        Or browse the research catalog →
      </a>
    </div>
  );
}

function readUtm() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get("utm_source") ?? undefined,
    utm_medium: p.get("utm_medium") ?? undefined,
    utm_campaign: p.get("utm_campaign") ?? undefined,
  };
}
