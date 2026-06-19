import { randomBytes } from "crypto";
import "server-only";

/**
 * Slug suitable for /pay/<slug> and /i/<slug> URLs. URL-safe, ~14 chars,
 * collision-resistant enough for hand-typing but not guessable.
 */
export function generateSlug(length = 12) {
  return randomBytes(length).toString("base64url");
}
