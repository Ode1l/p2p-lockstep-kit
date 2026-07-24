import {
  DEFAULT_DISPLAY_NAME,
  DISPLAY_NAME_MAX_LENGTH,
} from "../config.js";

const DISPLAY_NAME_STORAGE_KEY = "p2p-lockstep-kit-multiui.display-name.v1";

interface DisplayNameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const normalizeDisplayName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= DISPLAY_NAME_MAX_LENGTH
    ? normalized
    : null;
};

export const readStoredDisplayName = (
  storage?: DisplayNameStorage,
): string | null => {
  try {
    return normalizeDisplayName(
      (storage ?? globalThis.localStorage).getItem(DISPLAY_NAME_STORAGE_KEY),
    );
  } catch {
    return null;
  }
};

export const storeDisplayName = (
  value: unknown,
  storage?: DisplayNameStorage,
): boolean => {
  const normalized = normalizeDisplayName(value);
  if (!normalized) return false;
  try {
    (storage ?? globalThis.localStorage).setItem(
      DISPLAY_NAME_STORAGE_KEY,
      normalized,
    );
    return true;
  } catch {
    return false;
  }
};

export { DEFAULT_DISPLAY_NAME, DISPLAY_NAME_MAX_LENGTH };
