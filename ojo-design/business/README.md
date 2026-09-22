# Business Domain

Production-facing application area.

## Intended source layout

- `src/pages/`
- `src/features/`
- `src/data/`

## Supabase Rule

- Platform-native Supabase usage belongs in `/workspace/lib/integrations/supabase`.
- Prefer generating functions with the Supabase CLI.
- Pages and features should consume generated API clients or hooks instead of calling `supabase.functions.invoke(...)` directly.
- If the project wants automatic OpenAPI generation, prefer a route-first solution such as `Hono + @hono/zod-openapi` over a custom inference script.
- Migrations should be created with the Supabase CLI under `/workspace/supabase/migrations`.
- Generated frontend API code should live under `/workspace/lib/api-client-react`.
- Shared request helpers and Supabase runtime integrations should live under `/workspace/lib/integrations`.

## Frontend Usage

- Import generated clients from `@workspace/api-client-react`.
- The template app shell already configures `configureGeneratedApi({ client })` once during bootstrap in `prototype/src/core/app.ts`.
- Business/features/pages should usually assume bootstrap is already done and focus on consuming the generated client or generated hooks.
- `GET` contracts without request bodies expose query hooks such as `useFooQuery()`.
- Contracts with request bodies expose mutation hooks such as `useCreateFooMutation()`.
- If a concrete hook export is not present yet for the current generated package, consume `generatedApi` or a boundary helper and regenerate after the contract changes.

```ts
import { generatedApi, useCreateFooMutation } from '@workspace/api-client-react'

await generatedApi.createFoo({ name: 'demo' })

const mutation = useCreateFooMutation()
```
