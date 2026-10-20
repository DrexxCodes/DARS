"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Download, Share, SquarePlus, X, MoreVertical } from "lucide-react";
import { INSTALLED_KEY, detectPlatform, isStandalone, readStore, writeStore, type Platform } from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SHOW_DELAY_MS = 2500; // let the splash/preloader finish first

function isMacSafari() {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS/.test(ua);
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [suppressed, setSuppressed] = useState(true);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // running as the installed app
    // Shown on every load/reload until installed. "Maybe later" only hides it for this page view.
    const installedFlag = readStore(INSTALLED_KEY) === "1";

    setPlatform(detectPlatform());
    if (!installedFlag) setSuppressed(false);

    const onBIP = (e: Event) => {
      e.preventDefault(); // keep the event so our button can trigger it
      setDeferred(e as BeforeInstallPromptEvent);
      // Chromium only fires this when the app is NOT installed (e.g. user uninstalled it), so clear the stale flag.
      if (installedFlag) {
        writeStore(INSTALLED_KEY, "0");
        setSuppressed(false);
      }
    };
    const onInstalled = () => {
      writeStore(INSTALLED_KEY, "1");
      setSuppressed(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => setSuppressed(true), []);

  useEffect(() => {
    if (suppressed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suppressed, dismiss]);

  const install = async () => {
    if (!deferred) {
      setHint(true); // browser hasn't offered the native prompt — show manual steps
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") {
      writeStore(INSTALLED_KEY, "1");
      setSuppressed(true);
    } else {
      dismiss();
    }
  };

  // Which devices get the sheet?
  const canShow =
    platform === "ios" ||
    platform === "android" ||
    !!deferred || // Chrome/Edge on desktop
    (platform === "mac" && isMacSafari());

  if (suppressed || !ready || !platform || !canShow) return null;

  const stepIcon = "inline-block w-5 h-5 align-text-bottom mx-0.5 text-brand-600 dark:text-brand-400";

  let body: React.ReactNode;
  let action: React.ReactNode;

  if (platform === "ios") {
    body = (
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Do you know you can put DARS on your iPhone in about 3 easy clicks?</p>
        <ol className="space-y-2.5">
          <li className="flex gap-3">
            <Step n={1} />
            <span>
              Click the share icon <Share className={stepIcon} aria-label="share icon" />
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <span>Scroll till you see <strong>Add to Home Screen</strong></span>
          </li>
          <li className="flex gap-3">
            <Step n={3} />
            <span>
              Click <strong>Add to Home Screen</strong> <SquarePlus className={stepIcon} />
            </span>
          </li>
        </ol>
        <p className="font-medium text-slate-800 dark:text-slate-100">That&apos;s literally it.</p>
      </div>
    );
    action = <PrimaryButton onClick={dismiss}>Got it</PrimaryButton>;
  } else if (platform === "android") {
    body = (
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Yo, do you know you can install DARS on this your android phone?</p>
        <p>
          You may have seen a sign like &quot;install app&quot; at the top of the page. If you haven&apos;t, click the
          button below to install it fast and easy.
        </p>
        {hint && (
          <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 p-3">
            Your browser didn&apos;t pop it up automatically. Tap the menu{" "}
            <MoreVertical className="inline w-4 h-4 align-text-bottom" /> at the top-right and choose{" "}
            <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
          </p>
        )}
      </div>
    );
    action = (
      <PrimaryButton onClick={install}>
        <Download className="w-5 h-5" /> Install DARS
      </PrimaryButton>
    );
  } else if (platform === "windows") {
    body = (
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Psst, DARS can live on your Windows PC like a proper app: its own window, a taskbar shortcut, and no more
          hunting through browser tabs on class day.
        </p>
        <p>
          Hit the button below, or click the install icon <Download className={stepIcon} /> on the right side of your
          address bar.
        </p>
      </div>
    );
    action = (
      <PrimaryButton onClick={install}>
        <Download className="w-5 h-5" /> Install DARS
      </PrimaryButton>
    );
  } else if (platform === "mac" && deferred) {
    body = (
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Did you know DARS can sit in your Mac&apos;s Dock like any other app? One click and it&apos;s in Launchpad
          too, no browser tab required.
        </p>
        <p>
          Hit the button below, or click the install icon <Download className={stepIcon} /> in the address bar.
        </p>
      </div>
    );
    action = (
      <PrimaryButton onClick={install}>
        <Download className="w-5 h-5" /> Install DARS
      </PrimaryButton>
    );
  } else {
    // Mac Safari
    body = (
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Did you know DARS can sit in your Mac&apos;s Dock like any other app?</p>
        <ol className="space-y-2.5">
          <li className="flex gap-3">
            <Step n={1} />
            <span>
              Click <strong>File</strong> in the menu bar (or the share icon <Share className={stepIcon} />)
            </span>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <span>
              Choose <strong>Add to Dock…</strong>
            </span>
          </li>
        </ol>
        <p className="font-medium text-slate-800 dark:text-slate-100">Done. Easy, right?</p>
      </div>
    );
    action = <PrimaryButton onClick={dismiss}>Got it</PrimaryButton>;
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={dismiss} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white dark:bg-slate-900 shadow-2xl animate-sheet-up px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <Image src="/icon.png" alt="" width={48} height={48} className="w-12 h-12 rounded-2xl shadow-sm" />
          <h2 id="install-title" className="text-xl font-bold text-slate-900 dark:text-white">
            Install DARS
          </h2>
        </div>

        {body}

        <div className="mt-6 space-y-2">
          {action}
          <button onClick={dismiss} className="w-full py-2 text-sm text-slate-500 dark:text-slate-400">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="shrink-0 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 transition-colors"
    >
      {children}
    </button>
  );
}
