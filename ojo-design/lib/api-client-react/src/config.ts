export {
  ApiError,
  setAuthTokenGetter as setGeneratedApiAuthTokenGetter,
  setBaseUrl as setGeneratedApiBaseUrl,
  type AuthTokenGetter,
  type CustomFetchOptions,
  type ErrorType,
} from '../../integrations/custom-fetch';
export {
  createSupabaseClient,
  type WorkspaceSupabaseClient,
} from '../../integrations/supabase/client';
export { getSupabaseAccessToken, getSupabaseSession } from '../../integrations/supabase/auth';
export { invokeSupabaseFunction, type SupabaseFunctionInvokeOptions } from '../../integrations/supabase/functions';

import {
  setAuthTokenGetter as setGeneratedApiAuthTokenGetter,
  setBaseUrl as setGeneratedApiBaseUrl,
  type AuthTokenGetter,
} from '../../integrations/custom-fetch';
import { setGeneratedSupabaseClient, type GeneratedFunctionInvokeInit } from './generated/runtime';

export interface GeneratedApiConfig {
  baseUrl?: string | null;
  getAuthToken?: AuthTokenGetter | null;
  client?: import('../../integrations/supabase/client').WorkspaceSupabaseClient | null;
}

export function configureGeneratedApi(config: GeneratedApiConfig): void {
  setGeneratedApiBaseUrl(config.baseUrl ?? null);
  setGeneratedApiAuthTokenGetter(config.getAuthToken ?? null);
  setGeneratedSupabaseClient(config.client ?? null);
}

export { invokeGeneratedFunction, setGeneratedSupabaseClient as setGeneratedApiSupabaseClient } from './generated/runtime';
export type { GeneratedFunctionInvokeInit };
