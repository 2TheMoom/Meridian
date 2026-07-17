"use client";

import { HeroPanel } from "@/components/HeroPanel";
import { HowItWorks } from "@/components/HowItWorks";
import { LogoMark } from "@/components/LogoMark";
import { RulesShowcase } from "@/components/RulesShowcase";

// Static preview only — no wallet connection or auth on this page at all.
// Opening the dashboard is a client-side view switch (see app/page.tsx),
// not a route change.
export function Landing({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  return (
    <main className="min-h-screen bg-ink">
      <header className="border-b border-paper/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
          <span className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="font-display text-lg italic text-paper sm:text-xl">Meridian</span>
          </span>
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden items-center gap-6 font-technical text-[11px] uppercase tracking-widest text-dim md:flex">
              <a href="#how-it-works" className="hover:text-paper">
                How it works
              </a>
              <a href="#rules" className="hover:text-paper">
                Rules
              </a>
            </nav>
            <button
              onClick={onOpenDashboard}
              className="border border-brass px-4 py-2 font-display text-sm text-brass hover:bg-brass hover:text-ink"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section>
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[7fr_5fr] lg:gap-12 lg:py-28">
          <div className="flex flex-col gap-6">
            <span className="font-technical text-[11px] uppercase tracking-[0.2em] text-dim">
              Monad mainnet · chain 143
            </span>
            <h1 className="font-display text-3xl leading-[1.2] text-paper sm:text-4xl sm:leading-[1.15] lg:text-5xl">
              The chain is too fast for a second thought.{" "}
              <span className="italic text-brass">Meridian is that thought,</span> running before you sign.
            </h1>
            <p className="max-w-md font-body text-base leading-relaxed text-dim">
              Meridian watches your registered wallet in real time and scores what it sees against six deterministic
              rules — no LLM in the scoring path — so you have a real chance to act before a mistake settles.
            </p>
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <button
                onClick={onOpenDashboard}
                className="border border-brass px-5 py-2.5 font-display text-sm text-brass hover:bg-brass hover:text-ink"
              >
                Get started
              </button>
              <a href="#how-it-works" className="font-technical text-xs text-dim underline underline-offset-4">
                see how it works
              </a>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroPanel />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-paper/10 bg-ink-raised">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="font-technical text-[11px] uppercase tracking-[0.2em] text-dim">How it works</p>
          <h2 className="mt-2 font-display text-2xl text-paper">Watch, score, protect.</h2>
          <div className="mt-8 sm:mt-10">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Rules */}
      <section id="rules">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="font-technical text-[11px] uppercase tracking-[0.2em] text-dim">The rules engine</p>
          <h2 className="mt-2 font-display text-2xl text-paper">Six rules, zero guesswork.</h2>
          <p className="mt-2 max-w-xl font-body text-sm text-dim">
            Every rule is a pure function. Claude only narrates the result — it never sees or computes the score.
          </p>
          <div className="mt-8 sm:mt-10">
            <RulesShowcase />
          </div>
        </div>
      </section>

      {/* Dashboard CTA */}
      <section className="border-t border-paper/10 bg-ink-raised">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-12 sm:px-6 sm:py-16">
          <p className="font-technical text-[11px] uppercase tracking-[0.2em] text-dim">Get started</p>
          <h2 className="font-display text-2xl text-paper">Connect your wallet on the dashboard.</h2>
          <button
            onClick={onOpenDashboard}
            className="border border-brass px-5 py-2.5 font-display text-sm text-brass hover:bg-brass hover:text-ink"
          >
            Open dashboard
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-paper/10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-8 font-technical text-[11px] text-dim sm:flex-row sm:px-6">
          <span>Meridian · non-custodial</span>
          <span>
            Built by{" "}
            <a href="https://x.com/olumi441" target="_blank" rel="noopener noreferrer" className="hover:text-paper">
              Abu Olumi
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
