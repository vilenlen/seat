# API Client React

Generated frontend client for Supabase Edge Functions.

## Source of truth

- Contracts live in `/workspace/supabase/functions/*/contract.ts`
- Refresh generated artifacts from `/workspace` with `pnpm gen:supabase-api`

## Import rules

- Frontend packages should import from `@workspace/api-client-react`
- Prefer creating one shared Supabase client with `createSupabaseClient(...)`
- Configure the generated client once at app startup with `configureGeneratedApi({ client })`
- In the template workspace, prototype bootstrap already does this once in `prototype/src/core/app.ts`
- Business/features/pages should usually consume generated query/mutation hooks or generated plain functions, not re-run bootstrap in feature code
- Hook names depend on the currently generated contracts; if a concrete `useXxxQuery` / `useXxxMutation` export is not present yet, use `generatedApi` first and regenerate after contracts are updated

## Example

```ts
import {
  generatedApi,
  useCreateFooMutation,
} from '@workspace/api-client-react'

await generatedApi.createFoo({ name: 'demo' })

const mutation = useCreateFooMutation()
```

If a project cannot pass a Supabase client, `configureGeneratedApi({ baseUrl, getAuthToken })` remains available as a fallback runtime mode.

## Generated outputs

- `src/generated/endpoints.ts`
- `src/generated/types.ts`
- `src/generated/api.ts`
- `src/generated/spec/route-manifest.json`
- `src/generated/spec/edge-functions.openapi.json`
