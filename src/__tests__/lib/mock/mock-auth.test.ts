import { createMockAuth } from "@lib/mock/mock-auth";
import { MOCK_USER_ID } from "@lib/mock/fixtures";

describe("MockAuth", () => {
  it("fires onAuthStateChange with INITIAL_SESSION on subscribe", () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    auth.onAuthStateChange(callback);
    expect(callback).toHaveBeenCalledWith(
      "INITIAL_SESSION",
      expect.objectContaining({
        user: expect.objectContaining({ id: MOCK_USER_ID }),
      }),
    );
  });

  it("signInWithIdToken sets session and fires SIGNED_IN", async () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    auth.onAuthStateChange(callback);
    callback.mockClear();

    const result = await auth.signInWithIdToken({
      provider: "google",
      token: "fake",
    });
    expect(result.error).toBeNull();
    expect(result.data.session).toBeDefined();
    expect(callback).toHaveBeenCalledWith("SIGNED_IN", expect.anything());
  });

  it("signOut clears session and fires SIGNED_OUT", async () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    auth.onAuthStateChange(callback);

    await auth.signOut();
    expect(callback).toHaveBeenCalledWith("SIGNED_OUT", null);
  });

  it("getUser returns the mock user", async () => {
    const auth = createMockAuth();
    const { data } = await auth.getUser();
    expect(data.user?.id).toBe(MOCK_USER_ID);
  });

  it("getSession returns the current session", async () => {
    const auth = createMockAuth();
    const { data } = await auth.getSession();
    expect(data.session).toBeDefined();
    expect(data.session?.user.id).toBe(MOCK_USER_ID);
  });

  it("startAutoRefresh and stopAutoRefresh are no-ops", () => {
    const auth = createMockAuth();
    expect(() => auth.startAutoRefresh()).not.toThrow();
    expect(() => auth.stopAutoRefresh()).not.toThrow();
  });

  it("unsubscribe removes the callback", async () => {
    const auth = createMockAuth();
    const callback = jest.fn();
    const {
      data: { subscription },
    } = auth.onAuthStateChange(callback);
    callback.mockClear();

    subscription.unsubscribe();
    await auth.signOut();
    expect(callback).not.toHaveBeenCalled();
  });
});
