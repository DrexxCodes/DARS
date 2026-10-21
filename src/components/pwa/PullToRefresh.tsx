"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

const THRESHOLD = 80; // px of (damped) pull needed to trigger a refresh
const MAX_PULL = 130;
const RING = 2 * Math.PI * 21;

function hasScrolledAncestor(el: EventTarget | null) {
  let node = el as HTMLElement | null;
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight && node.scrollTop > 0) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Pull-to-refresh for touch devices (installed app and mobile browser). Shows the DARS logo with a progress ring while dragging.
 */
export default function PullToRefresh() {
  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const active = useRef(false);
  const pullRef = useRef(0);
  const busy = useRef(false);
  const crossed = useRef(false);

  useEffect(() => {
    // Any touch device, in the installed app or a mobile browser tab.
    setEnabled("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1) return;
      if (document.body.style.overflow === "hidden") return;
      if (hasScrolledAncestor(e.target)) return;
      // Don't require scrollY === 0 here: a touch can land mid-momentum. The move handler re-baselines until the page is at the top.
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      active.current = false;
      crossed.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || busy.current) return;
      if (e.touches.length !== 1) {
        startY.current = null;
        return;
      }
      const y = e.touches[0].clientY;

      if (!active.current) {
        // Page still scrolled, or the finger is moving up: this isn't a pull yet, so restart the measurement from here.
        if (window.scrollY > 0 || y < startY.current) {
          startY.current = y;
          startX.current = e.touches[0].clientX;
          return;
        }
        const dy = y - startY.current;
        const dx = Math.abs(e.touches[0].clientX - startX.current);
        if (dy < 3) return;
        if (dx > dy) {
          startY.current = null; // horizontal gesture
          return;
        }
        active.current = true;
        setDragging(true);
      }

      // Claim the gesture from the first pixel so the browser can't rubber-band the page (or the header) underneath us.
      if (e.cancelable) e.preventDefault();
      const d = Math.max(0, Math.min(MAX_PULL, (y - startY.current) * 0.5));
      pullRef.current = d;
      setPull(d);

      // Tick once when the logo reaches the refresh point (and again if they drag back past it)
      if (d >= THRESHOLD && !crossed.current) {
        crossed.current = true;
        haptic(15);
      } else if (d < THRESHOLD - 10 && crossed.current) {
        crossed.current = false;
      }
    };

    const onEnd = () => {
      startY.current = null;
      crossed.current = false;
      if (!active.current) return;
      active.current = false;
      setDragging(false);

      if (pullRef.current >= THRESHOLD) {
        busy.current = true;
        haptic(25); // release is a real touch event, so iOS reliably allows this one
        setRefreshing(true);
        setPull(THRESHOLD * 0.85);
        setTimeout(() => window.location.reload(), 900);
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  if (!enabled) return null;

  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      aria-hidden
      className="fixed left-1/2 z-[70] pointer-events-none"
      style={{
        top: "env(safe-area-inset-top)",
        transform: `translate(-50%, ${pull - 60}px)`,
        opacity: refreshing ? 1 : Math.min(1, pull / 30),
        transition: dragging ? "none" : "transform 0.3s ease, opacity 0.3s ease",
      }}
    >
      <div className="relative w-14 h-14 rounded-full bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/5 flex items-center justify-center">
        <svg viewBox="0 0 48 48" className={cn("absolute inset-0 w-full h-full", refreshing && "animate-spin")}>
          <g transform="rotate(-90 24 24)">
            <circle cx="24" cy="24" r="21" fill="none" strokeWidth="3" className="stroke-slate-200 dark:stroke-slate-700" />
            <circle
              cx="24"
              cy="24"
              r="21"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              stroke="#16a34a"
              strokeDasharray={refreshing ? `${RING * 0.3} ${RING}` : RING}
              strokeDashoffset={refreshing ? 0 : RING * (1 - progress)}
            />
          </g>
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt=""
          className={cn("w-8 h-8 rounded-lg object-cover", refreshing && "animate-pulse")}
          style={{
            transform: refreshing ? undefined : `rotate(${pull * 4}deg) scale(${0.7 + progress * 0.3})`,
          }}
        />
      </div>
    </div>
  );
}
