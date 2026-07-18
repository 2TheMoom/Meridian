"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type BackLinkProps = { label: string; showArrow?: boolean } & (
  | { href: string; onClick?: never; history?: never }
  | { href?: never; onClick: () => void; history?: never }
  | { href?: never; onClick?: never; history: true }
);

const CLASSES =
  "group inline-flex items-center gap-2 rounded-full border border-paper/15 bg-ink-raised px-4 py-2 font-technical text-xs text-paper shadow-sm transition-colors duration-150 hover:border-brass hover:text-brass";

// A pill-style link, not a plain underlined text link — the same treatment
// Salvage uses on its finder-facing pages, so moving between screens feels
// like a deliberate, designed part of the app instead of an afterthought
// text link. showArrow defaults on for the common "back to X" case; turn it
// off for forward/lateral links (e.g. GetStarted's post-registration "View
// Timeline") where a back-arrow would point the wrong way.
//
// `history` uses the browser's actual back navigation instead of a fixed
// href — Timeline/Guardrails used to hardcode "Dashboard" regardless of
// where the user actually came from (Dashboard, the other of the two, a
// direct link). router.back() with no prior page in this tab's history is
// a safe no-op, not a broken redirect, so there's no fallback needed.
export function BackLink({ href, onClick, history, label, showArrow = true }: BackLinkProps) {
  const router = useRouter();
  const content = (
    <>
      {showArrow && (
        <span className="inline-block transition-transform duration-150 group-hover:-translate-x-0.5">←</span>
      )}
      {label}
    </>
  );

  if (history) {
    return (
      <button onClick={() => router.back()} className={CLASSES}>
        {content}
      </button>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={CLASSES}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={CLASSES}>
      {content}
    </Link>
  );
}
