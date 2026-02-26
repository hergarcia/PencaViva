/* eslint-disable @typescript-eslint/no-require-imports */
import { AppState, AppStateStatus } from "react-native";

describe("supabase client", () => {
  const ORIGINAL_ENV = process.env;
  let appStateCallback: ((state: AppStateStatus) => void) | undefined;
  let addEventListenerSpy: jest.SpyInstance;
  let mockStartAutoRefresh: jest.Mock;
  let mockStopAutoRefresh: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      EXPO_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };

    appStateCallback = undefined;
    addEventListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        appStateCallback = listener as (state: AppStateStatus) => void;
        return { remove: jest.fn() };
      });

    mockStartAutoRefresh = jest.fn();
    mockStopAutoRefresh = jest.fn();

    jest.doMock("@supabase/supabase-js", () => ({
      createClient: jest.fn().mockReturnValue({
        auth: {
          startAutoRefresh: mockStartAutoRefresh,
          stopAutoRefresh: mockStopAutoRefresh,
        },
      }),
    }));

    jest.doMock("@lib/secure-store-adapter", () => ({
      secureStoreAdapter: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    }));
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("calls createClient with correct URL, key, and auth config", () => {
    require("@lib/supabase");
    const { createClient } = require("@supabase/supabase-js");

    expect(createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }),
      }),
    );
  });

  it("registers an AppState listener on module load", () => {
    require("@lib/supabase");
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("calls startAutoRefresh when app becomes active", () => {
    require("@lib/supabase");
    expect(appStateCallback).toBeDefined();
    appStateCallback!("active");
    expect(mockStartAutoRefresh).toHaveBeenCalled();
  });

  it("calls stopAutoRefresh when app goes to background", () => {
    require("@lib/supabase");
    expect(appStateCallback).toBeDefined();
    appStateCallback!("background");
    expect(mockStopAutoRefresh).toHaveBeenCalled();
  });

  it("throws when env vars are missing", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "";
    expect(() => require("@lib/supabase")).toThrow(
      "Missing Supabase environment variables",
    );
  });
});
