"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Ellipsis, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useNavItems, isActivePath } from "./useNavItems";
import CreditsDialog from "./CreditsDialog";

const MAX_SLOTS = 5;

/** Mobile bottom tab bar. With more than 5 items, the extras go into a "More" sheet. */
export default function BottomNav() {
  const pathname = usePathname();
  const items = useNavItems();
  const { profile, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  const overflow = items.length > MAX_SLOTS;
  const primary = overflow ? items.slice(0, MAX_SLOTS - 1) : items;
  const more = overflow ? items.slice(MAX_SLOTS - 1) : [];
  const moreActive = more.some((i) => isActivePath(pathname, i.href));

  const tab = (active: boolean) =>
    cn(
      "flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition-colors",
      active ? "text-brand-700 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
    );
  const pill = (active: boolean) =>
    cn(
      "flex items-center justify-center w-14 h-7 rounded-full transition-colors",
      active ? "bg-brand-100 dark:bg-brand-950" : "bg-transparent"
    );

  return (
    <>
      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        {primary.map(({ href, shortLabel, icon: Icon, action }) => {
          if (action === "credits") {
            return (
              <button key={href} onClick={() => setCreditsOpen(true)} className={tab(creditsOpen)}>
                <span className={pill(creditsOpen)}>
                  <Icon className="w-5 h-5" />
                </span>
                {shortLabel}
              </button>
            );
          }
          const active = isActivePath(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={tab(active)}>
              <span className={pill(active)}>
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              {shortLabel}
            </Link>
          );
        })}
        {overflow && (
          <button onClick={() => setMoreOpen(true)} className={tab(moreActive || moreOpen)} aria-label="More">
            <span className={pill(moreActive || moreOpen)}>
              <Ellipsis className="w-5 h-5" />
            </span>
            More
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="More">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white dark:bg-slate-900 shadow-2xl animate-sheet-up px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="grid grid-cols-3 gap-3">
              {more.map(({ href, label, icon: Icon, action }) => {
                const cardCls = "flex flex-col items-center gap-2 rounded-2xl p-3 text-center text-xs font-medium";
                if (action === "credits") {
                  return (
                    <button
                      key={href}
                      onClick={() => {
                        setMoreOpen(false);
                        setCreditsOpen(true);
                      }}
                      className={cn(cardCls, "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200")}
                    >
                      <Icon className="w-6 h-6" />
                      {label}
                    </button>
                  );
                }
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      cardCls,
                      active
                        ? "bg-brand-600 text-white"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    )}
                  >
                    <Icon className="w-6 h-6" />
                    {label}
                  </Link>
                );
              })}
            </div>
            {profile?.admin && (
              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            )}
          </div>
        </div>
      )}
      <CreditsDialog open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </>
  );
}
