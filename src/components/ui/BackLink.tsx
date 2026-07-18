"use client";

import Link from "next/link";

type BackLinkProps = { label: string; showArrow?: boolean } & (
  | { href: string; onClick?: never }
  | { href?: never; onClick: () => void }
);

const CLASSES =
  "group inline-flex items-center gap-2 rounded-full border border-paper/15 bg-ink-raised px-4 py-2 font-technical text-xs text-paper shadow-sm transition-colors duration-150 hover:border-brass hover:text-brass";

// A pill-style link, not a plain underlined text link — the same treatment
// Salvage uses on its finder-facing pages, so moving between screens feels
// like a deliberate, designed part of the app instead of an afterthought
// text link. showArrow defaults on for the common "back to X" case; turn it
// off for forward/lateral links (e.g. GetStarted's post-registration "View
// Timeline") where a back-arrow would point the wrong way.
export function BackLink({ href, onClick, label, showArrow = true }: BackLinkProps) {
  const content = (
    <>
      {showArrow && (
        <span className="inline-block transition-transform duration-150 group-hover:-translate-x-0.5">←</span>
      )}
      {label}
    </>
  );

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
