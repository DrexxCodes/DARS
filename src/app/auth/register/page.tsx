"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";
import { toast } from "sonner";
import Link from "next/link";
import { CheckSquare, Eye, EyeOff } from "lucide-react";
import { validateRegNumber, normalizeRegNumber } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", regNumber: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email) e.email = "Email is required";
    if (!form.regNumber) e.regNumber = "Registration number is required";
    else if (!validateRegNumber(normalizeRegNumber(form.regNumber))) {
      e.regNumber = "Invalid format. Must be e.g. 2023133001 or 2022134005";
    }
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email,
          regNumber: normalizeRegNumber(form.regNumber),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }
      toast.success("Account created! Please log in.");
      router.push("/auth/login");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Register for DARS attendance tracking
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. John Doe"
            value={form.name}
            onChange={set("name")}
            error={errors.name}
            autoComplete="name"
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            autoComplete="email"
          />
          <Input
            label="Registration Number"
            placeholder="e.g. 2023133001"
            value={form.regNumber}
            onChange={set("regNumber")}
            error={errors.regNumber}
            hint="Format: 20YY133XXX (full-time) or 20YY134XXX (part-time)"
            className="font-mono tracking-widest"
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={set("password")}
              error={errors.password}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Re-enter password"
            value={form.confirm}
            onChange={set("confirm")}
            error={errors.confirm}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            autoComplete="new-password"
          />
          <Button className="w-full" size="lg" onClick={handleRegister} loading={loading}>
            Create Account
          </Button>
        </Card>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
