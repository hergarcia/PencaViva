/**
 * expo-push.ts — Expo Push Notifications HTTP client.
 *
 * Sends push messages to Expo's push gateway in batches of up to 100.
 * No SDK dependency — raw fetch over the REST API.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = "https://exp.host/--/push/v2/send";
const BATCH_SIZE = 100;
const FETCH_TIMEOUT_MS = 10_000;

/** Valid Expo push token formats: ExponentPushToken[...] or bare FCM/APNs tokens. */
const EXPO_TOKEN_REGEX = /^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_-]{100,}$/;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  /** Parallel to the input `messages` array: true = successfully accepted by Expo. */
  successPerMessage: boolean[];
  successCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Returns true if the token looks like a valid Expo or native push token.
 * Filters out stale/invalid tokens before sending to avoid unnecessary API errors.
 */
export function isValidPushToken(token: string): boolean {
  return EXPO_TOKEN_REGEX.test(token);
}

/**
 * Sends an array of push messages to the Expo push gateway.
 * Messages are batched into groups of 100 (Expo's maximum per request).
 * Individual delivery errors are collected but do not stop processing.
 * `successPerMessage` mirrors the input array so callers can identify
 * exactly which recipients were accepted.
 * Invalid push tokens are skipped before sending (marked as failed).
 */
export async function sendPushBatch(
  messages: ExpoPushMessage[],
): Promise<PushResult> {
  if (messages.length === 0) {
    return {
      successPerMessage: [],
      successCount: 0,
      errorCount: 0,
      errors: [],
    };
  }

  const successPerMessage: boolean[] = new Array(messages.length).fill(false);
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Pre-filter: skip messages with invalid token formats
  const validMessages: Array<{ originalIdx: number; msg: ExpoPushMessage }> =
    [];
  for (let i = 0; i < messages.length; i++) {
    if (isValidPushToken(messages[i].to)) {
      validMessages.push({ originalIdx: i, msg: messages[i] });
    } else {
      errorCount++;
      errors.push(`invalid_token_format at index ${i}`);
      console.warn(
        `reminder-push expo-push: skipping invalid token format at index ${i}`,
      );
    }
  }

  // Chunk into BATCH_SIZE groups
  for (
    let batchStart = 0;
    batchStart < validMessages.length;
    batchStart += BATCH_SIZE
  ) {
    const batchEntries = validMessages.slice(
      batchStart,
      batchStart + BATCH_SIZE,
    );
    const batch = batchEntries.map((e) => e.msg);

    let responseData: Array<{
      status: string;
      message?: string;
      details?: unknown;
    }>;

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const text = await response.text();
        // Don't include response body in errors array (may contain sensitive data)
        const msg = `Expo API HTTP ${response.status}`;
        console.error("reminder-push expo-push:", msg, text.slice(0, 200));
        errors.push(msg);
        errorCount += batch.length;
        continue;
      }

      const json = (await response.json()) as { data: typeof responseData };
      responseData = json.data ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "fetch_error";
      console.error("reminder-push expo-push fetch error:", msg);
      errors.push(msg);
      errorCount += batch.length;
      continue;
    }

    // Tally per-ticket results; tickets are returned in the same order as messages
    for (let j = 0; j < responseData.length; j++) {
      const ticket = responseData[j];
      const { originalIdx } = batchEntries[j];
      if (ticket.status === "ok") {
        successPerMessage[originalIdx] = true;
        successCount++;
      } else {
        errorCount++;
        // Log only the status code, not the full detail (may include token)
        const detail = ticket.message ?? "push_error";
        errors.push(detail);
        console.error(
          `reminder-push expo-push ticket error at index ${originalIdx}:`,
          detail,
        );
      }
    }
  }

  return { successPerMessage, successCount, errorCount, errors };
}
