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

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/users/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.uid);
  }, [user, fetchProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [fetchProfile]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    await setAuthPersistence(rememberMe);
    await signInWithEmailAndPassword(clientAuth, email, password);
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
