# Supabase Workspace Guide

This directory is the source of truth for Supabase backend assets in the workspace.

## Official References

- Edge Function examples:
  [supabase/examples/edge-functions/supabase/functions](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions)
- Edge Function prompt guidance:
  [supabase/examples/prompts/edge-functions.md](https://github.com/supabase/supabase/blob/master/examples/prompts/edge-functions.md)
- Edge Functions docs overview:
  [supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- Edge Functions quickstart:
  [supabase.com/docs/guides/functions/local-quickstart](https://supabase.com/docs/guides/functions/local-quickstart)
- Database migrations docs:
  [supabase.com/docs/guides/deployment/database-migrations](https://supabase.com/docs/guides/deployment/database-migrations)

Agents can use these references to learn the preferred file structure and runtime patterns before generating project-specific code.

Recommended database example:

- `select-from-table-with-auth-rls`:
  [supabase/examples/edge-functions/supabase/functions/select-from-table-with-auth-rls](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/select-from-table-with-auth-rls)
  This example shows the preferred pattern for database access inside an Edge Function: accept the caller `Authorization` header, create a Supabase client inside the function, and let RLS evaluate the user context.

## Learning Examples

Use these official examples as references when implementing real functions in this template:

- Function examples index (browse by scenario):
  [supabase/examples/edge-functions/supabase/functions](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions)
- Auth + RLS DB access:
  [select-from-table-with-auth-rls](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/select-from-table-with-auth-rls)
- Webhook signature validation:
  [stripe-webhooks](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/stripe-webhooks)
- Official docs example list:
  [supabase.com/docs/guides/functions#examples](https://supabase.com/docs/guides/functions#examples)

## Runtime

- Edge Functions use the Supabase Edge Runtime.
- Function code is written in TypeScript and executed with `Deno.serve(...)`.
- Shared helpers should live under `functions/_shared`.
- This template intentionally does **not** ship a built-in demo function. Create real functions with the CLI for the current project.

## Contract Structure

When a project chooses to keep explicit `contract.ts` files, use this shape:

```ts
export interface CreateFooRequest {
  name: string
}

export interface CreateFooResponse {
  id: string
  name: string
}

export const createFooContract = {
  name: 'create-foo',
  method: 'POST',
  path: '/functions/v1/create-foo',
  requestTypeName: 'CreateFooRequest',
  requestShape: {
    name: 'string',
  },
  responseTypeName: 'CreateFooResponse',
  responseShape: {
    id: 'string',
    name: 'string',
  },
} as const
```

## Contract Generation Note

- This template uses `supabase/functions/*/contract.ts` as the source of truth for generated API artifacts.
- Do not rely on `deno doc` to infer HTTP contracts in this template.

## Common CLI Commands

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions new <name>
supabase functions serve --env-file .env.local
supabase functions deploy <name>
supabase secrets list
supabase secrets set --env-file .env.functions
supabase migration new <name>
supabase db diff -f <name>
supabase db push
supabase db pull
supabase db reset
```

## Standard Workflows

Assume commands are run from `/workspace` (the directory that contains `supabase/`).

### 1) Create a new function

```bash
supabase functions new <function-name> --workdir /workspace
```

Expected output path:

- `supabase/functions/<function-name>/index.ts`

Recommended next steps:

1. Add function logic in `supabase/functions/<function-name>/index.ts`
2. Add `supabase/functions/<function-name>/contract.ts`
3. Refresh frontend generated client with `pnpm gen:supabase-api`

### 2) Deploy a function

```bash
supabase login
supabase link --project-ref <project-ref> --workdir /workspace
supabase functions deploy <function-name> --workdir /workspace
```

Optional:

- Deploy without local Docker bundling:
  `supabase functions deploy <function-name> --use-api --workdir /workspace`

### 3) Create a SQL migration

```bash
supabase migration new <migration-name> --workdir /workspace
```

This creates a new SQL file under:

- `supabase/migrations/<timestamp>_<migration-name>.sql`

### 4) Apply/deploy SQL migrations

For local development:

```bash
supabase start --workdir /workspace
supabase db push --workdir /workspace
```

For linked remote project:

```bash
supabase login
supabase link --project-ref <project-ref> --workdir /workspace
supabase db push --workdir /workspace
```

## API Generation Flow

1. Define or update Edge Functions in `supabase/functions/*`
2. Keep `contract.ts` beside each function when the project chooses contract-first generation
3. Run:

```bash
pnpm gen:supabase-api
```

Generated outputs:

- `../lib/api-client-react/src/generated/spec/route-manifest.json`
- `../lib/api-client-react/src/generated/spec/edge-functions.openapi.json`
- `../lib/api-client-react/src/generated/*`

Frontend consumption:

- Import from `@workspace/api-client-react`
- Prefer configuring generated APIs with a shared Supabase client via `configureGeneratedApi({ client })`
- If a project cannot use the Supabase SDK in the caller, the generated runtime still supports `baseUrl` plus `getAuthToken` as a fallback
- `GET` contracts without request bodies generate `use*Query` helpers
- Contracts with request bodies generate `use*Mutation` helpers
