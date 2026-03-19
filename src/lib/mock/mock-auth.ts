import { MOCK_USER_ID, mockProfiles } from "./fixtures";

type AuthChangeEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT";

// Minimal Session/User shapes matching what auth-store.ts consumes
type MockUser = {
  id: string;
  email: string;
  user_metadata: { full_name: string; avatar_url: string };
  app_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
};

type MockSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: MockUser;
};

type AuthCallback = (
  event: AuthChangeEvent,
  session: MockSession | null,
) => void;

function createMockUser(): MockUser {
  const profile = mockProfiles[0]; // The main mock user
  return {
    id: MOCK_USER_ID,
    email: "hernan@example.com",
    user_metadata: {
      full_name: profile.display_name,
      avatar_url: profile.avatar_url ?? "",
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: profile.created_at,
  };
}

function createMockSession(): MockSession {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: createMockUser(),
  };
}

export function createMockAuth() {
  const callbacks = new Set<AuthCallback>();
  let currentSession: MockSession | null = createMockSession();

  function notify(event: AuthChangeEvent, session: MockSession | null) {
    for (const cb of callbacks) {
      cb(event, session);
    }
  }

  return {
    onAuthStateChange(callback: AuthCallback) {
      callbacks.add(callback);
      // Fire initial session synchronously (sufficient for mock)
      callback("INITIAL_SESSION", currentSession);
      return {
        data: {
          subscription: {
            unsubscribe: () => callbacks.delete(callback),
          },
        },
      };
    },

    async signInWithIdToken(_opts: { provider: string; token: string }) {
      currentSession = createMockSession();
      notify("SIGNED_IN", currentSession);
      return {
        data: { session: currentSession, user: currentSession.user },
        error: null,
      };
    },

    async signOut() {
      currentSession = null;
      notify("SIGNED_OUT", null);
      return { error: null };
    },

    async getUser() {
      return {
        data: { user: currentSession ? createMockUser() : null },
        error: null,
      };
    },

    async getSession() {
      return {
        data: { session: currentSession },
        error: null,
      };
    },

    startAutoRefresh() {},
    stopAutoRefresh() {},
  };
}
