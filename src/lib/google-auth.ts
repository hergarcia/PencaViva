import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// ── Types ──────────────────────────────────────────────────────────

export type GoogleSignInSuccess = {
  idToken: string;
};

export type GoogleSignInError = {
  code:
    | "SIGN_IN_CANCELLED"
    | "IN_PROGRESS"
    | "PLAY_SERVICES_NOT_AVAILABLE"
    | "UNKNOWN";
  message: string;
};

export type GoogleSignInResult =
  | { success: true; data: GoogleSignInSuccess }
  | { success: false; error: GoogleSignInError };

// ── Configuration ──────────────────────────────────────────────────

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
}

// ── Sign In ────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return {
        success: false,
        error: {
          code: "SIGN_IN_CANCELLED",
          message: "Sign in was cancelled",
        },
      };
    }

    const idToken = response.data.idToken;

    if (!idToken) {
      return {
        success: false,
        error: {
          code: "UNKNOWN",
          message: "No ID token received from Google",
        },
      };
    }

    return {
      success: true,
      data: { idToken },
    };
  } catch (error: unknown) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return {
            success: false,
            error: {
              code: "SIGN_IN_CANCELLED",
              message: "Sign in was cancelled by user",
            },
          };
        case statusCodes.IN_PROGRESS:
          return {
            success: false,
            error: {
              code: "IN_PROGRESS",
              message: "Sign in is already in progress",
            },
          };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return {
            success: false,
            error: {
              code: "PLAY_SERVICES_NOT_AVAILABLE",
              message: "Google Play Services not available",
            },
          };
        default:
          return {
            success: false,
            error: {
              code: "UNKNOWN",
              message:
                "message" in error
                  ? String(error.message)
                  : "Unknown Google Sign-In error",
            },
          };
      }
    }

    return {
      success: false,
      error: {
        code: "UNKNOWN",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
    };
  }
}

// ── Sign Out ───────────────────────────────────────────────────────

export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Silently ignore sign-out errors from Google SDK.
    // Supabase session is the source of truth for auth state.
  }
}
