"use client";

import Link from "next/link";
import { GetStarted } from "@/components/GetStarted";

// The one place on the whole site that connects a wallet or signs in — the
// landing page ("/") is a static preview only, no wallet interaction there.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-paper">Dashboard</h1>
        <Link href="/" className="font-technical text-xs uppercase tracking-widest text-dim underline underline-offset-4 hover:text-paper">
          Home
        </Link>
      </header>
      <p className="font-body text-sm text-dim">Connect your wallet, sign in, and register a wallet for Meridian to watch.</p>
      <GetStarted />
    </main>
  );
}
