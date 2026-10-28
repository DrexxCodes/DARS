"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  User,
} from "firebase/auth";
import { clientAuth, setAuthPersistence } from "@/lib/firebase-client";
import { clearSsoCookie, dismissSso, ensureSsoCookie } from "@/lib/sso/client";

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
  /** True once a birthday is on file. The date itself never reaches the browser. */
  birthdayProvided?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** True once the profile has been confirmed by the server this session (not just read from the local cache). */
  profileSynced: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  /** Signs in with a Firebase custom token from the other platform's session (see lib/sso). */
  loginWithSso: (customToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Merges fields into the in-memory profile and its cached copy (e.g. after saving a birthday). */
  patchProfile: (patch: Partial<UserProfile>) => void;
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
  const [profileSynced, setProfileSynced] = useState(false);

  const fetchProfile = useCallback(async (firebaseUser: User): Promise<UserProfile | null> => {
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/users/${firebaseUser.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setProfileSynced(true);
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

  const patchProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      writeCachedProfile(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      setProfileSynced(false);
      if (firebaseUser) {
        // Once the server confirms the profile, make sure the other app can see we're signed in here (no-op when it already can).
        const announce = (p: UserProfile | null) => {
          if (p && !p.banned) void ensureSsoCookie(() => firebaseUser.getIdToken());
        };
        const cached = readCachedProfile(firebaseUser.uid);
        if (cached && !cached.banned) {
          // Render immediately from the cached profile, then refresh it in the background.
          setProfile(cached);
          setLoading(false);
          void fetchProfile(firebaseUser).then(announce);
          return;
        }
        // No cache: keep "loading" true until the profile arrives, otherwise pages see
        // (loading=false, profile=null) and bounce the user back to /auth/login.
        setLoading(true);
        announce(await fetchProfile(firebaseUser));
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
    await finishSignIn(cred.user);
  };

  const loginWithSso = async (customToken: string) => {
    await setAuthPersistence(true);
    const cred = await signInWithCustomToken(clientAuth, customToken);
    await finishSignIn(cred.user);
  };

  const finishSignIn = async (firebaseUser: User) => {
    // Load the profile before resolving so the redirect lands on a ready session
    const p = await fetchProfile(firebaseUser);
    if (!p) {
      await signOut(clientAuth);
      throw Object.assign(new Error("Profile not found"), { code: "auth/profile-missing" });
    }
    if (p.banned) {
      clearCachedProfile(firebaseUser.uid);
      await signOut(clientAuth);
      throw Object.assign(new Error("Account banned"), { code: "auth/user-banned" });
    }
  };

  const logout = async () => {
    if (user) clearCachedProfile(user.uid);
    dismissSso(); // signing out on purpose: don't immediately offer to sign back in
    void clearSsoCookie();
    await signOut(clientAuth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileSynced, login, loginWithSso, logout, refreshProfile, patchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
