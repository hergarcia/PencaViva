/**
 * expo-push.ts — Expo Push Notifications HTTP client.
 *
 * Sends push messages to Expo's push gateway in batches of up to 100.
 * No SDK dependency — raw fetch over the REST API.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = "https://exp.host/--/push/v2/send";
const BATCH_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  successCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Sends an array of push messages to the Expo push gateway.
 * Messages are batched into groups of 100 (Expo's maximum per request).
 * Individual delivery errors are collected but do not stop processing.
 */
export async function sendPushBatch(
  messages: ExpoPushMessage[],
): Promise<PushResult> {
  if (messages.length === 0) {
    return { successCount: 0, errorCount: 0, errors: [] };
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Chunk into BATCH_SIZE groups
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

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
      });

      if (!response.ok) {
        const text = await response.text();
        const msg = `Expo API HTTP ${response.status}: ${text}`;
        console.error("reminder-push expo-push:", msg);
        errors.push(msg);
        errorCount += batch.length;
        continue;
      }

      const json = (await response.json()) as { data: typeof responseData };
      responseData = json.data ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("reminder-push expo-push fetch error:", msg);
      errors.push(msg);
      errorCount += batch.length;
      continue;
    }

    // Tally per-ticket results
    for (const ticket of responseData) {
      if (ticket.status === "ok") {
        successCount++;
      } else {
        errorCount++;
        const detail =
          ticket.message ?? JSON.stringify(ticket.details ?? ticket);
        errors.push(detail);
        console.error("reminder-push expo-push ticket error:", detail);
      }
    }
  }

  return { successCount, errorCount, errors };
}
