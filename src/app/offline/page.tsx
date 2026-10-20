"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "idle" | "checking" | "failed" | "online";

const CHECKING_MESSAGES = [
  "Sniffing around for Wi-Fi… 🐕",
  "Politely knocking on the router's door…",
  "Chasing signal bars up a tree…",
  "Waking up the hamsters that power the internet…",
  "Asking the cell tower nicely…",
];

const FAILED_MESSAGES = [
  "Still nothing. The internet is playing hide and seek 🙈",
  "No signal yet. Even the router is on break ☕",
  "Nope! The Wi-Fi has left the chat. Try again in a bit.",
];

export default function OfflinePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [msgIdx, setMsgIdx] = useState(0);
  const [failIdx, setFailIdx] = useState(0);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus("checking");
    setMsgIdx(0);

    const started = Date.now();
    let ok = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      // HEAD bypasses the service worker's GET caching, so this reflects real connectivity.
      const res = await fetch("/api/ping", { method: "HEAD", cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      ok = res.ok;
    } catch {
      ok = false;
    }

    // Keep the "checking" state on screen long enough to read the message
    await new Promise((r) => setTimeout(r, Math.max(0, 2200 - (Date.now() - started))));
    busy.current = false;

    if (ok) {
      setStatus("online");
      setTimeout(() => {
        if (window.location.pathname === "/offline") window.location.replace("/mark");
        else window.location.reload();
      }, 900);
    } else {
      setFailIdx((i) => (i + 1) % FAILED_MESSAGES.length);
      setStatus("failed");
    }
  }, []);

  // Rotate the "checking" jokes
  useEffect(() => {
    if (status !== "checking") return;
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % CHECKING_MESSAGES.length), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Recheck automatically the moment the browser says we're back
  useEffect(() => {
    window.addEventListener("online", check);
    return () => window.removeEventListener("online", check);
  }, [check]);

  const message =
    status === "checking"
      ? CHECKING_MESSAGES[msgIdx]
      : status === "failed"
      ? FAILED_MESSAGES[failIdx]
      : status === "online"
      ? "We're back, baby! 🎉 Taking you in…"
      : "Looks like your internet wandered off to find itself. Come back online and we'll keep your seat warm. 🪑";

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
      <div className="w-full max-w-sm space-y-7">
        <div className="relative mx-auto w-28 h-28">
          <div className="absolute inset-0 rounded-[2rem] bg-brand-500/20 animate-pulse-green" />
          <Image
            src="/icon.png"
            alt="DARS"
            width={112}
            height={112}
            priority
            className="relative w-28 h-28 rounded-[2rem] shadow-xl animate-float"
          />
          <span
            className={cn(
              "absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-slate-50 dark:ring-slate-950 transition-colors",
              status === "online" ? "bg-brand-600" : "bg-slate-700 dark:bg-slate-600"
            )}
          >
            {status === "online" ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {status === "online" ? "Connection found!" : "You've gone off the grid"}
          </h1>
          <p key={`${status}-${msgIdx}-${failIdx}`} className="text-sm text-slate-500 dark:text-slate-400 min-h-[3.5rem] animate-fade-in">
            {message}
          </p>
        </div>

        <button
          onClick={check}
          disabled={status === "checking" || status === "online"}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-80 text-white font-semibold py-3.5 transition-colors"
        >
          <RefreshCw className={cn("w-5 h-5", status === "checking" && "animate-spin")} />
          {status === "checking" ? "Checking…" : "Check connection"}
        </button>

        <p className="text-xs text-slate-400">Drexx Technologies · DARS</p>
      </div>
    </div>
  );
}
