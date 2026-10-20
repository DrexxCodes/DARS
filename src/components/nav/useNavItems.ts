"use client";

import {
  UserCheck,
  LayoutDashboard,
  LogIn,
  BookOpen,
  Users,
  ShieldCheck,
  MapPin,
  UserCog,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** When set, the item opens a dialog instead of navigating. */
  action?: "credits";
}

export function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin"; // don't light up for /admin/create etc.
  return pathname === href || pathname.startsWith(href + "/");
}

export function useNavItems(): NavItem[] {
  const { profile } = useAuth();
  const isAdmin = profile?.admin === true;
  const isSuper = isAdmin && profile?.scope === "super";

  const items: NavItem[] = [
    { href: "/mark", label: "Mark Attendance", shortLabel: "Mark", icon: UserCheck },
  ];

  if (!profile) items.push({ href: "/auth/login", label: "Login", shortLabel: "Login", icon: LogIn });
  else items.push({ href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard });

  if (isAdmin) {
    items.push({ href: "/admin/create", label: "Classes", shortLabel: "Classes", icon: BookOpen });
    items.push({ href: "/admin/students", label: "Students", shortLabel: "Students", icon: Users });
  }
  if (isSuper) {
    items.push({ href: "/admin", label: "Admin", shortLabel: "Admin", icon: ShieldCheck });
    items.push({ href: "/admin/tags", label: "Location Tags", shortLabel: "Tags", icon: MapPin });
    items.push({ href: "/admin/add", label: "Manage Admins", shortLabel: "Admins", icon: UserCog });
  }
  items.push({ href: "#credits", label: "Credits", shortLabel: "Credits", icon: Heart, action: "credits" });
  return items;
}
