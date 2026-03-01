import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Initialize auth state listener. Call once in the root layout.
 * Subscribes to supabase.auth.onAuthStateChange and keeps the
 * Zustand auth store in sync.
 */
export function useAuthInit(): void {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);
}

/**
 * Hook that returns auth state for consumption by any component.
 * Does NOT initialize — useAuthInit must be called first in root layout.
 */
export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signOut = useAuthStore((s) => s.signOut);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    session,
    user,
    isAuthenticated: !!session,
    isInitialized,
    isLoading,
    error,
    signInWithGoogle,
    signOut,
    clearError,
  };
}
