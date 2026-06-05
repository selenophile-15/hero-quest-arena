import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Profile {
  user_id: string;
  nickname: string;
  google_sub: string | null;
  email: string | null;
  agreed_at: string;
  last_seen_at: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  needsOnboarding: boolean;
  pendingGoogleSub: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingGoogleSub, setPendingGoogleSub] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) {
      console.error("loadProfile error", error);
      return null;
    }
    return data as Profile | null;
  }, []);

  const handleSession = useCallback(async (sess: Session | null) => {
    setSession(sess);
    setUser(sess?.user ?? null);
    if (!sess?.user) {
      setProfile(null);
      setNeedsOnboarding(false);
      setPendingGoogleSub(null);
      setLoading(false);
      return;
    }

    const googleSub = sess.user.identities?.find((identity) => identity.provider === "google")?.id
      ?? (sess.user.user_metadata?.sub as string | undefined)
      ?? null;
    setPendingGoogleSub(googleSub);

    const p = await loadProfile(sess.user.id);
    if (p) {
      setProfile(p);
      setNeedsOnboarding(false);
      // touch last_seen_at (fire-and-forget)
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("user_id", sess.user.id).then();
    } else {
      setProfile(null);
      setNeedsOnboarding(true);
    }
    setLoading(false);
  }, [loadProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      // Defer async work to avoid deadlocks
      setTimeout(() => { handleSession(sess); }, 0);
    });
    supabase.auth.getSession().then(({ data: { session } }) => { handleSession(session); });
    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      toast({ title: "로그인 실패", description: error.message, variant: "destructive" });
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await loadProfile(user.id);
    setProfile(p);
    setNeedsOnboarding(!p);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, needsOnboarding, pendingGoogleSub,
      signInWithGoogle, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
