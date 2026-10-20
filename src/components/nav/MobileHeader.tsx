"use client";

import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import ThemeToggle from "./ThemeToggle";

/** Slim green top bar for mobile (matches the status bar colour). */
export default function MobileHeader() {
  const { profile, logout } = useAuth();
  const isAdmin = profile?.admin === true;

  return (
    <header className="md:hidden sticky top-0 z-40 bg-brand-600 text-white pt-[env(safe-area-inset-top)] shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon.png" alt="DARS" width={30} height={30} className="w-[30px] h-[30px] rounded-lg object-cover bg-white" priority />
          <span className="font-bold text-lg tracking-tight">DARS</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle className="text-white/90 hover:bg-white/15" />
          {isAdmin && (
            <button onClick={logout} aria-label="Logout" className="p-2 rounded-lg text-white/90 hover:bg-white/15 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
