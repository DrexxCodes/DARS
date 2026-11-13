import { OUT_OF_SCOPE_CODE, type OutOfScopeReason } from "@/constants/scopes";

export interface OutOfScopeDetail {
  scope: string;
  reason?: OutOfScopeReason;
  /** Server-provided wording, when it has more to say (e.g. the limit that was hit). */
  message?: string;
}

const EVENT = "dars:out-of-scope";

/** Opens the "Out of Scope" sheet from anywhere (the sheet is mounted once in the root layout). */
export function openOutOfScope(detail: OutOfScopeDetail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<OutOfScopeDetail>(EVENT, { detail }));
}

export function onOutOfScope(handler: (d: OutOfScopeDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<OutOfScopeDetail>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** If a failed API response is an out-of-scope refusal, opens the sheet and returns true (so callers skip their own error toast). */
export function handleOutOfScope(status: number, data: unknown): boolean {
  const d = data as { code?: string; scope?: string; reason?: OutOfScopeReason; error?: string } | null;
  if (status === 403 && d?.code === OUT_OF_SCOPE_CODE && d.scope) {
    openOutOfScope({ scope: d.scope, reason: d.reason, message: d.error });
    return true;
  }
  return false;
}
