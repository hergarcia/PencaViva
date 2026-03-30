import { assertEquals } from "jsr:@std/assert@1";
import {
  isValidPushToken,
  sendPushBatch,
  type ExpoPushMessage,
} from "./expo-push.ts";

// ── Helpers ────────────────────────────────────────────────────────────

/** Stubs globalThis.fetch with a response factory for each consecutive call. */
function mockFetch(
  responses: Array<{ ok: boolean; status?: number; body: unknown }>,
): () => void {
  let callIndex = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (
    _url: string | URL | Request,
    _init?: RequestInit,
  ): Promise<Response> => {
    const entry = responses[callIndex++];
    if (!entry)
      throw new Error("Unexpected fetch call: no more stub responses");

    return {
      ok: entry.ok,
      status: entry.status ?? (entry.ok ? 200 : 500),
      text: async () => JSON.stringify(entry.body),
      json: async () => entry.body,
    } as Response;
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/** Valid Expo token for use in tests. */
const VALID_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

function makeMessage(to = VALID_TOKEN): ExpoPushMessage {
  return {
    to,
    title: "Test Match",
    body: "2 hours left to submit your prediction.",
    data: { matchId: "match-001", screen: "match" },
  };
}

// ── isValidPushToken ───────────────────────────────────────────────────

Deno.test("isValidPushToken: accepts valid ExponentPushToken format", () => {
  assertEquals(isValidPushToken("ExponentPushToken[abc123]"), true);
  assertEquals(
    isValidPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"),
    true,
  );
});

Deno.test("isValidPushToken: rejects short/plain strings", () => {
  assertEquals(isValidPushToken("short"), false);
  assertEquals(isValidPushToken("ok-token"), false);
  assertEquals(isValidPushToken("bad-token"), false);
  assertEquals(isValidPushToken(""), false);
});

// ── sendPushBatch ──────────────────────────────────────────────────────

Deno.test("sendPushBatch: empty input makes no fetch call", async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return {} as Response;
  };

  const result = await sendPushBatch([]);

  globalThis.fetch = originalFetch;
  assertEquals(fetchCalled, false);
  assertEquals(result.successCount, 0);
  assertEquals(result.errorCount, 0);
  assertEquals(result.errors, []);
  assertEquals(result.successPerMessage, []);
});

Deno.test(
  "sendPushBatch: invalid token is skipped without fetch call",
  async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return {} as Response;
    };

    const result = await sendPushBatch([makeMessage("not-a-valid-token")]);

    globalThis.fetch = originalFetch;
    assertEquals(fetchCalled, false);
    assertEquals(result.successCount, 0);
    assertEquals(result.errorCount, 1);
    assertEquals(result.successPerMessage, [false]);
  },
);

Deno.test("sendPushBatch: single message succeeds", async () => {
  const restore = mockFetch([
    {
      ok: true,
      body: { data: [{ status: "ok" }] },
    },
  ]);

  const result = await sendPushBatch([makeMessage()]);
  restore();

  assertEquals(result.successCount, 1);
  assertEquals(result.errorCount, 0);
  assertEquals(result.errors, []);
  assertEquals(result.successPerMessage, [true]);
});

Deno.test(
  "sendPushBatch: 101 messages are chunked into 2 requests",
  async () => {
    const tickets = Array.from({ length: 100 }, () => ({ status: "ok" }));
    const restore = mockFetch([
      { ok: true, body: { data: tickets } }, // batch 1 (100 messages)
      { ok: true, body: { data: [{ status: "ok" }] } }, // batch 2 (1 message)
    ]);

    const messages = Array.from({ length: 101 }, (_, i) =>
      makeMessage(`ExponentPushToken[test${i}]`),
    );
    const result = await sendPushBatch(messages);
    restore();

    assertEquals(result.successCount, 101);
    assertEquals(result.errorCount, 0);
    assertEquals(result.successPerMessage.length, 101);
    assertEquals(
      result.successPerMessage.every((v) => v === true),
      true,
    );
  },
);

Deno.test(
  "sendPushBatch: partial error response sets correct successPerMessage",
  async () => {
    const restore = mockFetch([
      {
        ok: true,
        body: {
          data: [
            { status: "ok" },
            { status: "error", message: "DeviceNotRegistered", details: {} },
          ],
        },
      },
    ]);

    // Both tokens must pass format validation to reach Expo
    const result = await sendPushBatch([
      makeMessage("ExponentPushToken[ok-token-aaa]"),
      makeMessage("ExponentPushToken[bad-token-bbb]"),
    ]);
    restore();

    assertEquals(result.successCount, 1);
    assertEquals(result.errorCount, 1);
    assertEquals(result.errors.length, 1);
    assertEquals(result.errors[0], "DeviceNotRegistered");
    // First message ok, second failed
    assertEquals(result.successPerMessage, [true, false]);
  },
);

Deno.test(
  "sendPushBatch: HTTP error from Expo is handled gracefully",
  async () => {
    const restore = mockFetch([
      { ok: false, status: 500, body: "Internal Server Error" },
    ]);

    const result = await sendPushBatch([makeMessage()]);
    restore();

    assertEquals(result.successCount, 0);
    assertEquals(result.errorCount, 1);
    assertEquals(result.errors.length, 1);
    assertEquals(result.successPerMessage, [false]);
  },
);

Deno.test("sendPushBatch: network error is handled gracefully", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network failure");
  };

  const result = await sendPushBatch([makeMessage()]);
  globalThis.fetch = originalFetch;

  assertEquals(result.successCount, 0);
  assertEquals(result.errorCount, 1);
  assertEquals(result.errors[0], "network failure");
  assertEquals(result.successPerMessage, [false]);
});
