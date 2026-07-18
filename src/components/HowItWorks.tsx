import { Panel } from "@/components/ui/Panel";

const STEPS = [
  {
    n: "I",
    title: "Horizon watches",
    body: "Tracks every approval, transfer, and balance change on your registered wallet, windowed into periodic snapshots.",
  },
  {
    n: "II",
    title: "Oracle scores",
    body: "Six deterministic rules score what it sees. Claude narrates the result afterward — it never computes or sees the score.",
  },
  {
    n: "III",
    title: "Keel protects",
    body: "An email that explains what happened, a one-tap on-chain revoke, or a spend-cap vault, in increasing commitment.",
  },
];

// Guard is deliberately not "step 0" of the same pipeline — it doesn't feed
// into Horizon/Oracle/Keel, it's a separate, standalone check that runs
// before any of that starts. Showing it as a distinct callout says that
// honestly instead of implying a single connected chain that isn't one.
export function HowItWorks() {
  return (
    <div className="flex flex-col gap-10">
      <Panel accent="brass" className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
        <span className="font-display text-2xl italic text-brass">0</span>
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-2xl text-paper">Guard checks first</h3>
          <p className="max-w-xl font-body text-sm leading-relaxed text-dim">
            Before any of the pipeline below runs, paste a contract or spender address into Guard and get a verdict —
            no wallet connection, no registration. This is the one part that can actually stop a bad signature from
            happening, not just respond fast once it has.
          </p>
        </div>
      </Panel>

      <div className="flex flex-col divide-y divide-paper/10 md:flex-row md:divide-x md:divide-y-0">
        {STEPS.map((step) => (
          <div key={step.n} className="flex flex-1 flex-col gap-3 py-6 first:pt-0 last:pb-0 md:px-8 md:py-0 md:first:pl-0 md:last:pr-0">
            <span className="font-display text-2xl italic text-brass">{step.n}</span>
            <h3 className="font-display text-2xl text-paper">{step.title}</h3>
            <p className="max-w-xs font-body text-sm leading-relaxed text-dim">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
