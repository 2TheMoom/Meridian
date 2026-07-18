"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChainSwitcher } from "@/components/ChainSwitcher";
import { ConnectButton } from "@/components/ConnectButton";
import { LogoMark } from "@/components/LogoMark";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/timeline", label: "Timeline" },
  { href: "/guardrails", label: "Guardrails" },
] as const;

// Shared by every authenticated screen (Dashboard, Timeline, Guardrails) so
// connection status and chain are always visible and switchable — before
// this, only Dashboard had ChainSwitcher/ConnectButton at all, and Timeline/
// Guardrails gave no indication if the wallet had disconnected out from
// under them.
export function AppHeader({ onGoHome }: { onGoHome?: () => void }) {
  const pathname = usePathname();
  const logo = (
    <>
      <LogoMark size={24} />
      <span className="font-display text-lg italic text-paper">Meridian</span>
    </>
  );

  return (
    <header className="border-b border-paper/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          {onGoHome ? (
            <button onClick={onGoHome} className="flex items-center gap-2" aria-label="Meridian home">
              {logo}
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2" aria-label="Meridian home">
              {logo}
            </Link>
          )}
          <nav className="hidden items-center gap-5 font-technical text-[11px] uppercase tracking-widest sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? "text-brass" : "text-dim hover:text-paper"}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ChainSwitcher />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
