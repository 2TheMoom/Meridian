type Wallet = { id: string; address: string; label: string | null };

// Shared by Timeline and Guardrails — both had this exact dropdown
// hand-duplicated before. Renders nothing for a single wallet, since there's
// nothing to select between.
export function WalletSelect({
  wallets,
  selectedWalletId,
  onChange,
}: {
  wallets: Wallet[];
  selectedWalletId: string | null;
  onChange: (id: string) => void;
}) {
  if (wallets.length <= 1) return null;

  return (
    <select
      value={selectedWalletId ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-fit border border-paper/15 bg-ink-raised px-3 py-2 font-technical text-sm text-paper"
    >
      {wallets.map((w) => (
        <option key={w.id} value={w.id}>
          {w.label ?? w.address}
        </option>
      ))}
    </select>
  );
}
