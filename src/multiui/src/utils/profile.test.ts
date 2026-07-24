import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY_NAME,
  normalizeDisplayName,
  readStoredDisplayName,
  storeDisplayName,
} from "./profile.js";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("local display-name profile", () => {
  it("provides a non-blocking default", () => {
    expect(DEFAULT_DISPLAY_NAME).toBe("牌友");
    expect(readStoredDisplayName(memoryStorage()) ?? DEFAULT_DISPLAY_NAME).toBe(
      "牌友",
    );
  });

  it("normalizes and persists a valid name", () => {
    const storage = memoryStorage();
    expect(normalizeDisplayName("  东风客  ")).toBe("东风客");
    expect(storeDisplayName("  南山  ", storage)).toBe(true);
    expect(readStoredDisplayName(storage)).toBe("南山");
  });

  it("rejects empty and overlong values", () => {
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("牌".repeat(21))).toBeNull();
  });
});
