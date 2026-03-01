export const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({
    type: "success",
    data: { idToken: "mock-google-id-token", user: {} },
  }),
  signOut: jest.fn().mockResolvedValue(null),
};

export function isSuccessResponse(
  response: unknown,
): response is { type: "success"; data: { idToken: string } } {
  return (
    typeof response === "object" &&
    response !== null &&
    "type" in response &&
    (response as { type: string }).type === "success"
  );
}

export function isErrorWithCode(
  error: unknown,
): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

export const statusCodes = {
  SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  IN_PROGRESS: "IN_PROGRESS",
  PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
};
