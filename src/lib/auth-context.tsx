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
        return data.user as UserProfile;
      }
      setProfile(null);
      return null;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user);
  }, [user, fetchProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Keep "loading" true until the profile arrives, otherwise pages see
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
      await signOut(clientAuth);
      throw Object.assign(new Error("Account banned"), { code: "auth/user-banned" });
    }
  };

  const logout = async () => {
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
