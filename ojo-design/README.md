# Workspace Guide (Model-Facing)

This README is written for AI/codegen workflows.  
When generating or modifying code, follow the directory responsibilities and boundaries below first.

## Directory Layout

```text
<workspace-root>/
  prototype/   # rapid prototyping
  business/    # production-facing business implementation
  components/  # shared UI components
  specs/       # specification and conventions documents
  supabase/ # Supabase backend assets
  lib/         # generated clients, integrations, and build scripts
```

## Supabase Convention

- Supabase backend source of truth lives under `supabase/functions/*`.
- `contract.ts` beside each function is the source of truth for generated API artifacts.
- Run `pnpm gen:supabase-api` from `/workspace` to refresh:
  - `lib/api-client-react/src/generated/spec/route-manifest.json`
  - `lib/api-client-react/src/generated/spec/edge-functions.openapi.json`
  - `lib/api-client-react/src/generated/*`
- Frontend packages should import generated clients from `@workspace/api-client-react`.
- Prefer one shared Supabase client configured with `createSupabaseClient({ url, anonKey })`.
- Configure the generated client once with `configureGeneratedApi({ client })` before calling generated APIs.
- `configureGeneratedApi({ baseUrl, getAuthToken })` remains available only as a fallback for callers that cannot use the Supabase SDK directly.
- `GET` contracts without request bodies generate `use*Query` helpers; contracts with request bodies generate `use*Mutation` helpers.

## Directory Responsibilities

- `prototype`
  - Fast experiments, page/layout drafts, interaction validation.
  - Can be less strict if it speeds up exploration.
  - Runtime frontend root is `/workspace/prototype`; concrete source files live under `/workspace/prototype/src`.
  - Prototype-local helpers should live in `prototype/src/utils`.
  - Reusable UI pieces should be extracted to `components`.
  - Import generated API clients directly from `@workspace/api-client-react`.

- `business`
  - Production-facing code with stronger stability expectations.
  - Prefer predictable structure and explicit behavior.
  - Can consume shared code from `components` and `@workspace/api-client-react`.
  - Import generated API clients directly from `@workspace/api-client-react`.

- `components`
  - Put **cross-domain reusable UI pieces** here.
  - Keep components focused on presentation + local UI state.
  - Do not couple shared components to one specific business flow.

- `specs`
  - Store project specifications, conventions, and implementation rules.
  - Model/codegen should read and follow `specs` documents before editing code.
  - If `specs` conflicts with README examples, treat `specs` as higher priority.

## Shared Code Rules (`components`)

- Keep `components` public surface small and stable.
- If code is only used by one domain and not expected to be shared, keep it inside that domain.
- Promote to `components` only when reuse is clear or intentionally planned.

## Dependency Boundary (Recommended)

- `prototype` -> `components`
- `business` -> `components`
- `components` -> (avoid importing domain-private code)

## How To Decide Where New Code Goes

- New **UI widget used by multiple domains** -> `components`.
- New **prototype-local data/format/validation helper** -> `prototype/src/utils`.
- Prototype-only page logic -> `prototype`.
- Production business-specific flow -> `business`.
- Never describe the frontend root as `/workspace/src`; use `/workspace/prototype` and `/workspace/prototype/src`.

If uncertain, start in domain code (`prototype` or `business`), then extract to shared directories after reuse appears.

## How To Use `components`

- Import shared UI from `@components/...`.
- Avoid hidden cross-domain coupling (for example, shared modules importing domain-private modules).
- Keep shared modules small, composable, and well-named.

## Root Scripts

- `pnpm run dev:prototype`
- `pnpm run dev:business`
- `pnpm run dev:all`
- `pnpm run build:prototype`
- `pnpm run build:business`
- `pnpm run build:all`
- `pnpm run typecheck`
- `pnpm run gen:supabase-api`
- `pnpm run test:supabase-api`

Current root scripts are scaffold-level; each domain can wire its own concrete build pipeline.

## Infra Boundary

- `workspace` is the user-facing workspace payload (packaged as `v5.zip`).
- E2B sandbox infrastructure tools (including transfer/restore tooling) live under `e2b` at the repository root.
- For Supabase-backed delivery, authoring alone is not enough: carry the plan through migration/apply, function serve or deploy as applicable, generated-client refresh, frontend wiring, and verification.
