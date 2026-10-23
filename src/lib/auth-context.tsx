"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { clientAuth, setAuthPersistence } from "@/lib/firebase-client";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  regNumber?: string;
  admin: boolean;
  scope?: "super" | "defined";
  assignedCourses?: string[];
  /** Admins only: leave this admin's own attendance records out of PDF exports. */
  excludeFromExports?: boolean;
  banned: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Last known profile per user, so reopening the app renders instantly instead of waiting on a server round trip.
// Display only: every API route re-checks the real permissions on the server, and the profile is refreshed right after.
const PROFILE_CACHE_PREFIX = "dars:profile:";

function readCachedProfile(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_PREFIX + uid);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_PREFIX + profile.uid, JSON.stringify(profile));
  } catch {}
}

function clearCachedProfile(uid: string) {
  try {
    localStorage.removeItem(PROFILE_CACHE_PREFIX + uid);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (firebaseUser: User): Promise<UserProfile | null> => {
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/users/${firebaseUser.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        writeCachedProfile(data.user as UserProfile);
        return data.user as UserProfile;
      }
      // The server answered and says there is no usable profile: drop any cached copy.
      clearCachedProfile(firebaseUser.uid);
      setProfile(null);
      return null;
    } catch {
      // Network failure: keep showing the cached profile if there is one instead of signing the student out of the UI.
      const cached = readCachedProfile(firebaseUser.uid);
      if (!cached) setProfile(null);
      return cached;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user);
  }, [user, fetchProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const cached = readCachedProfile(firebaseUser.uid);
        if (cached && !cached.banned) {
          // Render immediately from the cached profile, then refresh it in the background.
          setProfile(cached);
          setLoading(false);
          void fetchProfile(firebaseUser);
          return;
        }
        // No cache: keep "loading" true until the profile arrives, otherwise pages see
        // (loading=false, profile=null) and bounce the user back to /auth/login.
        setLoading(true);
        await fetchProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [fetchProfile]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    await setAuthPersistence(rememberMe);
    const cred = await signInWithEmailAndPassword(clientAuth, email, password);
    // Load the profile before resolving so the redirect lands on a ready session
    const p = await fetchProfile(cred.user);
    if (!p) {
      await signOut(clientAuth);
      throw Object.assign(new Error("Profile not found"), { code: "auth/profile-missing" });
    }
    if (p.banned) {
      clearCachedProfile(cred.user.uid);
      await signOut(clientAuth);
      throw Object.assign(new Error("Account banned"), { code: "auth/user-banned" });
    }
  };

  const logout = async () => {
    if (user) clearCachedProfile(user.uid);
    await signOut(clientAuth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
