"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";
import { toast } from "sonner";
import Link from "next/link";
import { CheckSquare, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = "Email is required";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password") {
        toast.error("Invalid email or password.");
      } else if (e.code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to your DARS account</p>
        </div>

        <Card className="p-6 space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-colors flex items-center justify-center">
                {rememberMe && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300">Remember me on this device</span>
          </label>

          <Button className="w-full" size="lg" onClick={handleLogin} loading={loading}>
            Sign In
          </Button>
        </Card>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
