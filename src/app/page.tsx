"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/Landing";

type View = "landing" | "dashboard";

const STORAGE_KEY = "meridian_view";

// One workspace, one route. Landing and Dashboard are a client-side view
// switch, not separate pages — so a refresh on the dashboard stays on the
// dashboard instead of bouncing back to the marketing page.
export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) as View | null;
    if (saved === "dashboard") setView("dashboard");
    setHydrated(true);
  }, []);

  function goToDashboard() {
    setView("dashboard");
    sessionStorage.setItem(STORAGE_KEY, "dashboard");
  }

  function goToLanding() {
    setView("landing");
    sessionStorage.setItem(STORAGE_KEY, "landing");
  }

  // Avoid a flash of the wrong view before sessionStorage has been read.
  if (!hydrated) return null;

  return view === "dashboard" ? (
    <Dashboard onGoLanding={goToLanding} />
  ) : (
    <Landing onOpenDashboard={goToDashboard} />
  );
}
