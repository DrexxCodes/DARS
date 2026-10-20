"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ChevronsLeft, ChevronsRight, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useNavItems, isActivePath } from "./useNavItems";
import CreditsDialog from "./CreditsDialog";

const STORAGE_KEY = "dars:sidebar-collapsed";

/** Desktop / tablet sidebar (md and up). Collapses to an icon rail. */
export default function Sidebar() {
  const pathname = usePathname();
  const items = useNavItems();
  const { profile, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
    setMounted(true);
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });

  const dark = mounted && resolvedTheme === "dark";
  const isAdmin = profile?.admin === true;

  const rowBase =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full";
  const rowLayout = collapsed ? "justify-center px-0" : "";

  return (
    <>
    <aside
      className={cn(
        "hidden md:flex sticky top-0 h-screen shrink-0 flex-col z-40",
        "border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
        "pt-[env(safe-area-inset-top)] transition-[width] duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Brand */}
      <Link
        href="/"
        className={cn("flex items-center gap-3 h-16 shrink-0 px-4", collapsed && "justify-center px-0")}
        title="DARS"
      >
        <Image
          src="/icon.png"
          alt="DARS"
          width={36}
          height={36}
          className="w-9 h-9 rounded-xl object-cover shadow-sm shrink-0"
          priority
        />
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">DARS</span>
        )}
      </Link>

      {/* Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1" aria-label="Main">
        {items.map(({ href, label, icon: Icon, action }) => {
          if (action === "credits") {
            return (
              <button
                key={href}
                onClick={() => setCreditsOpen(true)}
                title={collapsed ? label : undefined}
                className={cn(
                  rowBase,
                  rowLayout,
                  "text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
              </button>
            );
          }
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                rowBase,
                rowLayout,
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="px-3 py-3 space-y-1 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setTheme(dark ? "light" : "dark")}
          title={collapsed ? "Toggle theme" : undefined}
          className={cn(rowBase, rowLayout, "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")}
        >
          {dark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
          <span className={cn("truncate", collapsed && "sr-only")}>{dark ? "Light mode" : "Dark mode"}</span>
        </button>

        {isAdmin && (
          <button
            onClick={logout}
            title={collapsed ? "Logout" : undefined}
            className={cn(rowBase, rowLayout, "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950")}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={cn("truncate", collapsed && "sr-only")}>Logout</span>
          </button>
        )}

        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
          className={cn(rowBase, rowLayout, "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}
        >
          {collapsed ? (
            <ChevronsRight className="w-5 h-5 shrink-0" />
          ) : (
            <ChevronsLeft className="w-5 h-5 shrink-0" />
          )}
          <span className={cn("truncate", collapsed && "sr-only")}>Collapse</span>
        </button>
      </div>
    </aside>
    <CreditsDialog open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </>
  );
}
