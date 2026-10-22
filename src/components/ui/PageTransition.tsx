"use client";

import { useEffect, useState } from "react";
import Preloader from "@/components/ui/Preloader";

const SEEN_KEY = "dars:preloader-seen";

/**
 * The splash plays once per app session (first load), not on every page change. Previously each navigation hid the
 * page behind a ~1.7 s animation, which made every tap in the app feel slow.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) {
        setShowPreloader(false);
        return;
      }
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked: just play it once for this load
    }
  }, []);

  return (
    <>
      {showPreloader && <Preloader onComplete={() => setShowPreloader(false)} />}
      <div
        style={{
          opacity: showPreloader ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
