/**
 * Token protection settings.
 *
 * There is no settings endpoint in the backend API list yet, so these are
 * stored in the browser (localStorage) and are NOT enforced by the backend.
 * `BACKEND_ENFORCED_SETTINGS` in services/settingsStorage.ts is the switch to
 * flip once the backend starts enforcing a given limit.
 */
export interface ProtectionSettings {
  maxTokensPerTask: number;
  maxCostPerTaskUsd: number;
  maxConsecutiveFailures: number;
  maxRepeatedToolCalls: number;
  maxTaskDurationMinutes: number;
}

export type ProtectionSettingKey = keyof ProtectionSettings;
