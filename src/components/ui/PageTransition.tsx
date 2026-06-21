"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Preloader from "@/components/ui/Preloader";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showPreloader, setShowPreloader] = useState(true);
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevPathname = useRef<string | null>(null);

  // On first load
  useEffect(() => {
    prevPathname.current = pathname;
  }, []);

  // On route change
  useEffect(() => {
    if (prevPathname.current !== null && prevPathname.current !== pathname) {
      setShowPreloader(true);
    }
    prevPathname.current = pathname;
    setDisplayChildren(children);
  }, [pathname, children]);

  return (
    <>
      {showPreloader && (
        <Preloader onComplete={() => setShowPreloader(false)} />
      )}
      <div
        style={{
          opacity: showPreloader ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        {displayChildren}
      </div>
    </>
  );
}
