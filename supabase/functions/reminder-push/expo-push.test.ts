import { assertEquals } from "jsr:@std/assert@1";
import { sendPushBatch, type ExpoPushMessage } from "./expo-push.ts";

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

function makeMessage(to = "ExponentPushToken[test]"): ExpoPushMessage {
  return {
    to,
    title: "Test Match",
    body: "2 hours left to submit your prediction.",
    data: { matchId: "match-001", screen: "match" },
  };
}

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
});

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
  },
);

Deno.test(
  "sendPushBatch: partial error response is counted correctly",
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

    const result = await sendPushBatch([
      makeMessage("ok-token"),
      makeMessage("bad-token"),
    ]);
    restore();

    assertEquals(result.successCount, 1);
    assertEquals(result.errorCount, 1);
    assertEquals(result.errors.length, 1);
    assertEquals(result.errors[0], "DeviceNotRegistered");
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
});
