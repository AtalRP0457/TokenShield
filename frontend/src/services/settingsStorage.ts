import type { ProtectionSettingKey, ProtectionSettings } from '../types/settings';

const STORAGE_KEY = 'tokenshield.protection-settings.v1';

export const DEFAULT_SETTINGS: ProtectionSettings = {
  maxTokensPerTask: 200_000,
  maxCostPerTaskUsd: 2,
  maxConsecutiveFailures: 5,
  maxRepeatedToolCalls: 3,
  maxTaskDurationMinutes: 15,
};

/**
 * Which limits the BACKEND actually enforces. The API list has no settings
 * endpoint yet, so this is empty and the UI labels every limit as
 * "saved in this browser only". Add a key here once your teammate's backend
 * enforces it (and add the matching endpoint to the API layer).
 */
export const BACKEND_ENFORCED_SETTINGS: ReadonlySet<ProtectionSettingKey> = new Set<ProtectionSettingKey>();

export function loadSettings(): ProtectionSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ProtectionSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Returns false if the browser refused to store (private mode, quota, …). */
export function saveSettings(settings: ProtectionSettings): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function hasStoredSettings(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
