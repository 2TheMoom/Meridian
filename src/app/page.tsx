import { ConnectButton } from "@rainbow-me/rainbowkit";
import { GetStarted } from "@/components/GetStarted";
import { HeroPanel } from "@/components/HeroPanel";
import { HowItWorks } from "@/components/HowItWorks";
import { RulesShowcase } from "@/components/RulesShowcase";

export default function Home() {
  return (
    <main className="min-h-screen bg-ink">
      <header className="border-b border-paper/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
          <span className="font-display text-lg italic text-paper sm:text-xl">Meridian</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden items-center gap-6 font-technical text-[11px] uppercase tracking-widest text-dim md:flex">
              <a href="#how-it-works" className="hover:text-paper">
                How it works
              </a>
              <a href="#rules" className="hover:text-paper">
                Rules
              </a>
            </nav>
            <ConnectButton showBalance={false} />
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
              <a
                href="#get-started"
                className="border border-brass px-5 py-2.5 font-display text-sm text-brass hover:bg-brass hover:text-ink"
              >
                Get started
              </a>
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

      {/* Get started */}
      <section id="get-started" className="border-t border-paper/10 bg-ink-raised">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="font-technical text-[11px] uppercase tracking-[0.2em] text-dim">Get started</p>
          <h2 className="mt-2 font-display text-2xl text-paper">Three steps in.</h2>
          <div className="mt-8 max-w-md sm:mt-10">
            <GetStarted />
          </div>
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
