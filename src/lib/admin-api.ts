import { clientAuth } from "@/lib/firebase-client";
import { handleOutOfScope } from "@/lib/scope-events";
import { NDJSON, type JobEvent } from "@/lib/progress-stream";

export interface ApiResult<T = Record<string, any>> {
  ok: boolean;
  status: number;
  data: T;
  /** The server refused because of scopes; the "Out of Scope" sheet is already open, so don't toast again. */
  outOfScope: boolean;
  /** Ready-to-show message for a failure ("" on success or when the sheet was shown). */
  error: string;
}

const authHeaders = async (json = true): Promise<Record<string, string>> => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${await clientAuth.currentUser?.getIdToken()}`,
});

/** Signed fetch for admin endpoints. Opens the "Out of Scope" sheet on a scope refusal. Never throws. */
export async function adminFetch<T = Record<string, any>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: await authHeaders(init.body !== undefined),
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    const outOfScope = !res.ok && handleOutOfScope(res.status, data);
    return { ok: res.ok, status: res.status, data, outOfScope, error: res.ok || outOfScope ? "" : ((data as any)?.error ?? "Something went wrong.") };
  } catch {
    return { ok: false, status: 0, data: {} as T, outOfScope: false, error: "Network error. Please check your connection." };
  }
}

export interface JobProgress {
  step: string;
  done?: number;
  total?: number;
}

export type JobResult<T> = { ok: true; result: T } | { ok: false; error: string; outOfScope?: boolean };

/**
 * Calls an endpoint that streams progress (newline-delimited JSON) and reports each step as it arrives.
 * Plain JSON failures (auth, scope, validation) come back before any streaming starts and are handled the same way.
 */
export async function runJob<T = Record<string, any>>(
  url: string,
  init: { method: string; body?: unknown },
  onProgress: (p: JobProgress) => void
): Promise<JobResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: { ...(await authHeaders(init.body !== undefined)), Accept: NDJSON },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

    if (!(res.headers.get("content-type") ?? "").includes(NDJSON) || !res.body) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (handleOutOfScope(res.status, data)) return { ok: false, error: "", outOfScope: true };
        return { ok: false, error: (data as any)?.error ?? "Something went wrong." };
      }
      return { ok: true, result: data as T };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final: JobResult<T> | null = null;

    const handle = (line: string) => {
      if (!line.trim()) return;
      const e = JSON.parse(line) as JobEvent<T>;
      if (e.type === "progress") onProgress({ step: e.step, done: e.done, total: e.total });
      else if (e.type === "done") final = { ok: true, result: e.result };
      else final = { ok: false, error: e.error };
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(handle);
    }
    handle(buffer);
    return final ?? { ok: false, error: "The connection dropped before it finished. Check the list, then try again if needed." };
  } catch {
    return { ok: false, error: "Network error. Please check your connection." };
  }
}
