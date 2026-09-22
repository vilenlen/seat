import assert from 'node:assert/strict';
import test from 'node:test';

import { configureGeneratedApi } from '../config.ts';
import { invokeGeneratedFunction, setGeneratedSupabaseClient } from './runtime.ts';

test('invokeGeneratedFunction prefers configured Supabase client', async () => {
  let lastCall = null;
  const client = {
    functions: {
      async invoke(functionName, options) {
        lastCall = { functionName, options };
        return { data: { ok: true }, error: null };
      },
    },
  };

  setGeneratedSupabaseClient(client);
  const data = await invokeGeneratedFunction({
    functionName: 'hello-world',
    path: '/functions/v1/hello-world',
    method: 'POST',
    body: { name: 'Functions' },
  });

  assert.deepEqual(data, { ok: true });
  assert.deepEqual(lastCall, {
    functionName: 'hello-world',
    options: {
      body: { name: 'Functions' },
      method: 'POST',
    },
  });
});

test('configureGeneratedApi wires the Supabase client for generated APIs', async () => {
  let invokeCount = 0;
  const client = {
    functions: {
      async invoke() {
        invokeCount += 1;
        return { data: { ready: true }, error: null };
      },
    },
  };

  configureGeneratedApi({
    client,
    baseUrl: null,
  });

  const data = await invokeGeneratedFunction({
    functionName: 'get-status',
    path: '/functions/v1/get-status',
    method: 'GET',
  });

  assert.equal(invokeCount, 1);
  assert.deepEqual(data, { ready: true });
});
