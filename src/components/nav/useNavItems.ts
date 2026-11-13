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
  RotateCcw,
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

  const mark: NavItem = { href: "/mark", label: "Mark Attendance", shortLabel: "Mark", icon: UserCheck };
  const home: NavItem = profile
    ? { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard }
    : { href: "/auth/login", label: "Login", shortLabel: "Login", icon: LogIn };
  const classes: NavItem = { href: "/admin/create", label: "Classes", shortLabel: "Classes", icon: BookOpen };
  const students: NavItem = { href: "/admin/students", label: "Students", shortLabel: "Students", icon: Users };
  // Viewing admins and editing their roles & scopes
  const roles: NavItem = { href: "/admin", label: "Admin Roles & Scopes", shortLabel: "Roles", icon: ShieldCheck };
  // Every admin can open Tags; what they can do there depends on their tags.* scopes
  const tags: NavItem = { href: "/admin/tags", label: "Location Tags", shortLabel: "Tags", icon: MapPin };
  const grant: NavItem = { href: "/admin/add", label: "Grant Admin & Bulk Upload", shortLabel: "Grant", icon: UserCog };
  const reset: NavItem = { href: "/admin/reset", label: "Admin Reset", shortLabel: "Reset", icon: RotateCcw };

  // The phone's bottom bar only fits four items before "More". Super admins get Roles in that first row (it used to sit
  // inside "More" under the vague label "Admin"), with Dashboard moved into More.
  const items: NavItem[] = isSuper
    ? [mark, classes, students, roles, home, tags, grant, reset]
    : isAdmin
      ? [mark, home, classes, students, tags]
      : [mark, home];

  items.push({ href: "#credits", label: "Credits", shortLabel: "Credits", icon: Heart, action: "credits" });
  return items;
}
