import { NextResponse } from "next/server";

/** One line of a streamed job (newline-delimited JSON). */
export type JobEvent<T = unknown> =
  | { type: "progress"; step: string; done?: number; total?: number }
  | { type: "done"; result: T }
  | { type: "error"; error: string };

export type Report = (p: { step: string; done?: number; total?: number }) => void;

export const NDJSON = "application/x-ndjson";

/**
 * Runs a long job and streams its progress as it goes, so the admin sees a live bar instead of a frozen button.
 * Validate and authorise BEFORE calling this (a normal JSON 4xx/403 is easier for the client to read); once streaming
 * starts the status is always 200 and failures arrive as a final `error` event.
 */
export function streamJob<T>(job: (report: Report) => Promise<T>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: JobEvent<T>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // client went away; the job keeps running to a consistent state
        }
      };
      try {
        const result = await job((p) => send({ type: "progress", ...p }));
        send({ type: "done", result });
      } catch (err) {
        console.error("Streamed job failed:", err);
        send({ type: "error", error: err instanceof Error && err.message ? err.message : "Something went wrong. Please try again." });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new NextResponse(stream, {
    headers: { "Content-Type": `${NDJSON}; charset=utf-8`, "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}

/** Wants a stream? Clients send `Accept: application/x-ndjson`. */
export const wantsStream = (req: Request) => (req.headers.get("accept") ?? "").includes(NDJSON);
