"use client";

import { useEffect } from "react";

/**
 * Stops pinch-zoom on iOS, which ignores `user-scalable=no`.
 * Safari fires proprietary `gesture*` events for pinches; cancelling them
 * blocks the zoom. The multi-touch `touchmove` guard covers other browsers.
 */
export default function ViewportLock() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const blockPinch = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    };

    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    document.addEventListener("gestureend", block);
    document.addEventListener("touchmove", blockPinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
      document.removeEventListener("touchmove", blockPinch);
    };
  }, []);

  return null;
}
