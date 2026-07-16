import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Constant-time shared-secret check for internal, server-to-server routes
 * (worker -> Vercel, cron -> Vercel). Never client-callable.
 */
export function isAuthorizedBySecret(req: NextRequest, headerName: string, expected: string | undefined): boolean {
  const provided = req.headers.get(headerName);
  if (!provided || !expected) return false;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
