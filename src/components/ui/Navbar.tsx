"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, X, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "next-themes";

export default function Navbar() {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = profile?.admin === true;

  const navLinks = [
    { href: "/mark", label: "Mark Attendance", always: true },
    { href: "/auth/login", label: "Login", show: !profile },
    { href: "/dashboard", label: "Dashboard", show: !!profile },
    { href: "/admin", label: "Admin", show: isAdmin },
    { href: "/admin/create", label: "Classes", show: isAdmin },
    { href: "/admin/tags", label: "Tags", show: isAdmin && profile?.scope === "super" },
    { href: "/admin/add", label: "Manage Admins", show: isAdmin && profile?.scope === "super" },
  ].filter((l) => l.always || l.show);

  const LinkItem = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        pathname === href
          ? "bg-brand-600 text-white shadow-sm"
          : "text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950"
      )}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/icon.png"
              alt="DARS"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-cover shadow-sm"
              priority
            />
            <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
              DARS
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <LinkItem key={l.href} href={l.href} label={l.label} />
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Logout — admins only */}
            {isAdmin && (
              <button
                onClick={logout}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1">
            {navLinks.map((l) => (
              <LinkItem key={l.href} href={l.href} label={l.label} />
            ))}
            {isAdmin && (
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}