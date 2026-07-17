"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The dashboard lives at "/" now as a client-side view (see app/page.tsx) —
// this route only exists so old bookmarks and the cross-links from
// /timeline and /guardrails keep working.
export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    sessionStorage.setItem("meridian_view", "dashboard");
    router.replace("/");
  }, [router]);

  return null;
}
