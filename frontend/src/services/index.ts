import type { TokenShieldApi } from './apiClient';
import { config } from './config';
import { mockApi } from './mock/mockApi';
import { realApi } from './realApi';

/**
 * The app-wide API instance. Switch with VITE_USE_MOCK in .env.
 * Everything else imports `api` from here and never from realApi/mockApi directly.
 */
export const api: TokenShieldApi = config.useMock ? mockApi : realApi;

export { ApiError } from './http';
export { config } from './config';
