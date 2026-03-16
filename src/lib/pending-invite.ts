import { getStorageItem, setStorageItem, deleteStorageItem } from "./storage";

const PENDING_INVITE_KEY = "pending_invite_code";

export async function savePendingInviteCode(code: string): Promise<void> {
  await setStorageItem(PENDING_INVITE_KEY, code);
}

export async function getPendingInviteCode(): Promise<string | null> {
  return getStorageItem(PENDING_INVITE_KEY);
}

export async function clearPendingInviteCode(): Promise<void> {
  await deleteStorageItem(PENDING_INVITE_KEY);
}
