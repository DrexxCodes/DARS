"use client";

import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import { ReactNode, useEffect } from "react";

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm",
    secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost: "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
    outline: "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm", className)}>
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: "green" | "yellow" | "red" | "blue" | "slate";
}

export function Badge({ children, variant = "green" }: BadgeProps) {
  const variants = {
    green: "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("w-5 h-5 animate-spin text-brand-600", className)} />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg", className)} />
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full px-4 py-2.5 rounded-xl border text-sm transition-all duration-200 outline-none",
          "bg-white dark:bg-slate-800",
          "text-slate-900 dark:text-white placeholder:text-slate-400",
          error
            ? "border-red-400 focus:ring-2 focus:ring-red-300"
            : "border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900",
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "danger" | "warning" | "success";
}

export function Dialog({ open, onClose, title, children, icon, variant = "default" }: DialogProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const headerColors = {
    default: "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300",
    danger: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
    warning: "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300",
    success: "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl animate-slide-up overflow-hidden">
        <div className={cn("flex items-start gap-3 p-5 border-b border-slate-100 dark:border-slate-800", headerColors[variant])}>
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <h3 className="font-semibold text-base flex-1">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "w-full px-4 py-2.5 rounded-xl border text-sm transition-all duration-200 outline-none appearance-none",
          "bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
          error
            ? "border-red-400 focus:ring-2 focus:ring-red-300"
            : "border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900",
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
