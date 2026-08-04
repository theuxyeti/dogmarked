/**
 * Map provider / DB errors to safe client-facing messages.
 * Never surface raw RLS / Postgres strings in the UI.
 */

export function publicApiError(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string,
): string {
  const msg = error?.message ?? "";
  const code = error?.code ?? "";

  if (
    /row-level security|violates row-level security|RLS/i.test(msg) ||
    code === "42501"
  ) {
    return "You don’t have permission for that action. Sign in and try again.";
  }

  if (
    /foreign key|violates foreign key/i.test(msg) ||
    code === "23503"
  ) {
    return "Something is missing on your account or place. Refresh and try again.";
  }

  if (/unique|duplicate key/i.test(msg) || code === "23505") {
    return "That already exists. Try a different name or refresh.";
  }

  if (/JWT|not authenticated|Auth session/i.test(msg)) {
    return "Sign in required.";
  }

  return fallback;
}

export function logServerError(scope: string, error: unknown): void {
  const detail =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  console.error(`[${scope}]`, detail);
}
