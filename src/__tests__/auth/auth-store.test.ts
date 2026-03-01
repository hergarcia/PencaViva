import { useAuthStore } from "@stores/auth-store";
import { supabase } from "@lib/supabase";
import * as googleAuth from "@lib/google-auth";

// Mock supabase
jest.mock("@lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

// Mock google-auth
jest.mock("@lib/google-auth");

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    session: null,
    user: null,
    isInitialized: false,
    isLoading: false,
    error: null,
  });
});

describe("useAuthStore", () => {
  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isInitialized).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("initialize", () => {
    it("subscribes to onAuthStateChange", () => {
      useAuthStore.getState().initialize();
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("sets isInitialized when auth state callback fires", () => {
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (cb: (_event: string, session: null) => void) => {
          cb("INITIAL_SESSION", null);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      );

      useAuthStore.getState().initialize();
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  describe("signInWithGoogle", () => {
    it("sets isLoading during sign-in flow", async () => {
      (googleAuth.signInWithGoogle as jest.Mock).mockResolvedValue({
        success: true,
        data: { idToken: "test-token" },
      });
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
        data: { session: { user: {} } },
        error: null,
      });

      const promise = useAuthStore.getState().signInWithGoogle();
      expect(useAuthStore.getState().isLoading).toBe(true);

      await promise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("calls signInWithIdToken with the Google ID token", async () => {
      (googleAuth.signInWithGoogle as jest.Mock).mockResolvedValue({
        success: true,
        data: { idToken: "my-id-token" },
      });
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await useAuthStore.getState().signInWithGoogle();
      expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: "google",
        token: "my-id-token",
      });
    });

    it("silently handles user cancellation without setting error", async () => {
      (googleAuth.signInWithGoogle as jest.Mock).mockResolvedValue({
        success: false,
        error: { code: "SIGN_IN_CANCELLED", message: "Cancelled" },
      });

      await useAuthStore.getState().signInWithGoogle();
      expect(useAuthStore.getState().error).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("sets error on Google sign-in failure", async () => {
      (googleAuth.signInWithGoogle as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          code: "PLAY_SERVICES_NOT_AVAILABLE",
          message: "Play services not available",
        },
      });

      await useAuthStore.getState().signInWithGoogle();
      expect(useAuthStore.getState().error).toBe("Play services not available");
    });

    it("sets error on Supabase signInWithIdToken failure", async () => {
      (googleAuth.signInWithGoogle as jest.Mock).mockResolvedValue({
        success: true,
        data: { idToken: "test-token" },
      });
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: "Invalid token" },
      });

      await useAuthStore.getState().signInWithGoogle();
      expect(useAuthStore.getState().error).toBe("Invalid token");
    });

    it("prevents double sign-in when already loading", async () => {
      useAuthStore.setState({ isLoading: true });

      await useAuthStore.getState().signInWithGoogle();
      expect(googleAuth.signInWithGoogle).not.toHaveBeenCalled();
    });
  });

  describe("signOut", () => {
    it("calls signOutFromGoogle and supabase.auth.signOut", async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();
      expect(googleAuth.signOutFromGoogle).toHaveBeenCalled();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it("sets error when supabase sign-out fails", async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: { message: "Sign out failed" },
      });

      await useAuthStore.getState().signOut();
      expect(useAuthStore.getState().error).toBe("Sign out failed");
    });
  });

  describe("clearError", () => {
    it("clears error state", () => {
      useAuthStore.setState({ error: "Some error" });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
