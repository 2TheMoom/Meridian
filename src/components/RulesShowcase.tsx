const RULES: { id: string; label: string; body: string }[] = [
  { id: "R1", label: "Risky Approval", body: "Unlimited approvals to unverified or freshly-deployed contracts." },
  { id: "R2", label: "Velocity Spike", body: "Outflow well above your typical spending pattern." },
  { id: "R3", label: "Recurring Payment", body: "A trending-upward recurring payment nobody has acknowledged." },
  { id: "R4", label: "New Contract", body: "First-touch interactions with a young, unverified contract." },
  { id: "R5", label: "Floor Breach", body: "Native balance drops below a floor you set." },
  { id: "R6", label: "NFT Approval Risk", body: "Collection-wide setApprovalForAll grants to unverified operators." },
];

// A rule table, not a feature grid — this is what Oracle actually evaluates,
// so it reads like a spec sheet rather than a marketing grid.
export function RulesShowcase() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col divide-y divide-paper/10">
        {RULES.map((rule) => (
          <div key={rule.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
            <span className="w-10 shrink-0 font-technical text-sm text-brass">{rule.id}</span>
            <span className="w-44 shrink-0 font-display text-lg text-paper">{rule.label}</span>
            <span className="font-body text-sm text-dim">{rule.body}</span>
          </div>
        ))}
      </div>

      <blockquote className="border-l border-brass/40 pl-5">
        <p className="font-technical text-[11px] uppercase tracking-widest text-dim">An honest note on protection</p>
        <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-paper/80">
          These six rules score a Moment after Horizon has already seen the activity — they inform Notify and
          Confirm, which respond fast but can&apos;t stop a transaction from landing. Guard is the one part that runs
          before you sign, but it&apos;s advisory: nothing stops you from ignoring its verdict. Hold tier (
          <span className="font-technical">MeridianKeel.sol</span>) is the only structural enforcement — a first
          draft, not yet audited, deployed to Monad testnet only.
        </p>
      </blockquote>
    </div>
  );
}
