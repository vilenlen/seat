import type { Session } from '@supabase/supabase-js';
import type { WorkspaceSupabaseClient } from './client';

export async function getSupabaseSession(client: WorkspaceSupabaseClient): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function getSupabaseAccessToken(
  client: WorkspaceSupabaseClient
): Promise<string | null> {
  const session = await getSupabaseSession(client);
  return session?.access_token ?? null;
}
