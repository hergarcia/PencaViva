import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  configureGoogleSignIn,
  signInWithGoogle,
  signOutFromGoogle,
} from "@lib/google-auth";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("configureGoogleSignIn", () => {
  it("calls GoogleSignin.configure with client IDs from env", () => {
    configureGoogleSignIn();
    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  });
});

describe("signInWithGoogle", () => {
  it("returns success with idToken on successful sign-in", async () => {
    const result = await signInWithGoogle();
    expect(result).toEqual({
      success: true,
      data: { idToken: "mock-google-id-token" },
    });
  });

  it("returns cancelled when response is not success", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: "cancelled",
    });
    const result = await signInWithGoogle();
    expect(result).toEqual({
      success: false,
      error: {
        code: "SIGN_IN_CANCELLED",
        message: "Sign in was cancelled",
      },
    });
  });

  it("returns cancelled when error has SIGN_IN_CANCELLED status code", async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.SIGN_IN_CANCELLED,
      message: "Cancelled",
    });
    const result = await signInWithGoogle();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SIGN_IN_CANCELLED");
    }
  });

  it("returns IN_PROGRESS when sign-in is already in progress", async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.IN_PROGRESS,
      message: "In progress",
    });
    const result = await signInWithGoogle();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("IN_PROGRESS");
    }
  });

  it("returns PLAY_SERVICES_NOT_AVAILABLE when play services unavailable", async () => {
    (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
      message: "Play services not available",
    });
    const result = await signInWithGoogle();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PLAY_SERVICES_NOT_AVAILABLE");
    }
  });

  it("returns UNKNOWN for unexpected errors", async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );
    const result = await signInWithGoogle();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message).toBe("Network error");
    }
  });

  it("returns UNKNOWN when idToken is null", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: "success",
      data: { idToken: null, user: {} },
    });
    const result = await signInWithGoogle();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message).toBe("No ID token received from Google");
    }
  });
});

describe("signOutFromGoogle", () => {
  it("calls GoogleSignin.signOut", async () => {
    await signOutFromGoogle();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });

  it("does not throw when sign-out fails", async () => {
    (GoogleSignin.signOut as jest.Mock).mockRejectedValueOnce(
      new Error("Sign out failed"),
    );
    await expect(signOutFromGoogle()).resolves.toBeUndefined();
  });
});
