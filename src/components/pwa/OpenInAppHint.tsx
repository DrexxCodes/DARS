"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { INSTALLED_KEY, detectPlatform, isStandalone, readStore, writeStore, type Platform } from "@/lib/pwa";

const DISMISS_KEY = "dars:open-in-app-dismissed"; // sessionStorage: hidden for this tab session only
const SHOW_DELAY_MS = 1500;

const MESSAGES: Record<Platform, string> = {
  android: "DARS is installed on this phone. Open it from your home screen or app drawer for a smoother, full-screen experience.",
  ios: "DARS is on your Home Screen. Open it from there for a smoother, full-screen experience.",
  windows: "DARS is installed on this PC. Open it from the Start menu or your desktop for its own window.",
  mac: "DARS is installed on this Mac. Open it from the Dock or Launchpad for its own window.",
  other: "DARS is installed on this device. Open the app for a smoother, full-screen experience.",
};

async function isInstalledRelatedApp() {
  try {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    return ((await nav.getInstalledRelatedApps?.()) ?? []).length > 0;
  } catch {
    return false;
  }
}

/** In a normal browser tab, nudges people who already installed DARS to use the installed app. */
export default function OpenInAppHint() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Inside the installed app: remember that, so browser tabs on this device can hint to use it.
    if (isStandalone()) {
      writeStore(INSTALLED_KEY, "1");
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {}

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const show = () => {
      if (cancelled) return;
      setPlatform(detectPlatform());
      timer = setTimeout(() => !cancelled && setVisible(true), SHOW_DELAY_MS);
    };

    // Chromium only fires this when DARS is NOT installed (e.g. it was uninstalled): drop the stale flag.
    const onBIP = () => {
      writeStore(INSTALLED_KEY, "0");
      cancelled = true;
      clearTimeout(timer);
      setVisible(false);
    };
    const onInstalled = () => {
      writeStore(INSTALLED_KEY, "1");
      cancelled = false;
      show();
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    if (readStore(INSTALLED_KEY) === "1") show();
    else isInstalledRelatedApp().then((yes) => yes && show());

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  if (!visible || !platform) return null;

  return (
    <div
      role="status"
      className="fixed z-[60] inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm animate-sheet-up"
    >
      <div className="relative flex items-start gap-3 rounded-2xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 p-4 pr-10">
        <Image src="/icon.png" alt="" width={40} height={40} className="w-10 h-10 rounded-xl shrink-0" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Use the DARS app</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{MESSAGES[platform]}</p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
