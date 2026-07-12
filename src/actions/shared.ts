import "server-only";
import { cookies } from "next/headers";
import { verifySession, sessionCookieName } from "@/lib/auth";

/** Standard action result the forms render. */
export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
}

export const okResult = (message?: string): ActionResult => ({ ok: true, message });
export const errResult = (errors: Record<string, string>, message?: string): ActionResult => ({
  ok: false,
  errors,
  message,
});

/**
 * Server Actions are reachable via direct POST, so every mutation re-checks auth
 * (Next 16 docs: verify auth inside every Server Function).
 */
export async function requireAuth(): Promise<void> {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  if (!(await verifySession(token))) {
    throw new Error("Unauthorized");
  }
}
