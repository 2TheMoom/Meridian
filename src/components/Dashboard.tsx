"use client";

import { AppHeader } from "@/components/AppHeader";
import { GetStarted } from "@/components/GetStarted";
import { Guard } from "@/components/Guard";

// The one place on the whole site that connects a wallet or signs in.
// Returning to the landing view is a client-side switch (see app/page.tsx),
// not a route change.
export function Dashboard({ onGoLanding }: { onGoLanding: () => void }) {
  return (
    <div className="min-h-screen bg-ink">
      <AppHeader onGoHome={onGoLanding} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
        <Guard />
        <GetStarted />
      </main>
    </div>
  );
}
