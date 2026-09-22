import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  options?: SupabaseClientOptions<any>;
}

export type WorkspaceSupabaseClient = SupabaseClient<any, 'public', any>;

function requireConfigValue(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Supabase client requires a non-empty ${label}.`);
  }
  return normalized;
}

export function createSupabaseClient(config: SupabaseClientConfig): WorkspaceSupabaseClient {
  return createClient(
    requireConfigValue(config.url, 'url'),
    requireConfigValue(config.anonKey, 'anonKey'),
    config.options
  );
}
