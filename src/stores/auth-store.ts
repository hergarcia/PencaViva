import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle, signOutFromGoogle } from "@/lib/google-auth";

// ── Types ──────────────────────────────────────────────────────────

export type AuthState = {
  session: Session | null;
  user: User | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
};

export type AuthActions = {
  initialize: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  clearError: () => void;
};

export type AuthStore = AuthState & AuthActions;

// ── Store ──────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // State
  session: null,
  user: null,
  isInitialized: false,
  isLoading: false,
  error: null,

  // Actions
  initialize: () => {
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isInitialized: true,
      });
    });
  },

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },

  signInWithGoogle: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });

    const googleResult = await signInWithGoogle();

    if (!googleResult.success) {
      // Don't show error for user-initiated cancellation
      if (googleResult.error.code === "SIGN_IN_CANCELLED") {
        set({ isLoading: false });
        return;
      }

      set({ isLoading: false, error: googleResult.error.message });
      return;
    }

    const { error: supabaseError } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: googleResult.data.idToken,
    });

    if (supabaseError) {
      set({ isLoading: false, error: supabaseError.message });
      return;
    }

    // Session is set by onAuthStateChange listener
    set({ isLoading: false });
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    await signOutFromGoogle();
    const { error } = await supabase.auth.signOut();

    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    // Session cleared by onAuthStateChange listener
    set({ isLoading: false });
  },

  clearError: () => {
    set({ error: null });
  },
}));
