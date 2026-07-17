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

// A connected pipeline, not a card grid — Horizon feeds Oracle feeds Keel.
export function HowItWorks() {
  return (
    <div className="flex flex-col divide-y divide-paper/10 md:flex-row md:divide-x md:divide-y-0">
      {STEPS.map((step) => (
        <div key={step.n} className="flex flex-1 flex-col gap-3 py-6 first:pt-0 last:pb-0 md:px-8 md:py-0 md:first:pl-0 md:last:pr-0">
          <span className="font-display text-2xl italic text-brass">{step.n}</span>
          <h3 className="font-display text-2xl text-paper">{step.title}</h3>
          <p className="max-w-xs font-body text-sm leading-relaxed text-dim">{step.body}</p>
        </div>
      ))}
    </div>
  );
}
