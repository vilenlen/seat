import type { WorkspaceSupabaseClient } from './client';

export type SupabaseFunctionInvokeOptions = Parameters<
  WorkspaceSupabaseClient['functions']['invoke']
>[1];

export async function invokeSupabaseFunction<TResponse = unknown>(
  client: WorkspaceSupabaseClient,
  functionName: string,
  options?: SupabaseFunctionInvokeOptions
): Promise<TResponse> {
  const { data, error } = await client.functions.invoke<TResponse>(functionName, options);
  if (error) {
    throw error;
  }
  return data as TResponse;
}
