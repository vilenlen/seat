# Design Template

## What this template provides

- Multi-page build pipeline by scanning `src/pages/*.page.tsx`.
- Shared runtime contract through `window.App` in `src/core/app.ts`.
- Data/theme preload support from `src/data/*.json` with production inline optimization.
- Directory layout aligned:
  - `src/data/`
  - `src/components/`
  - `src/pages/`
  - `src/stores/`
  - `src/snapshots/`
  - `src/utils/`

## Runtime contract

Use the global runtime object:

- `window.App.store`
- `window.App.theme`
- `window.App.transitionTo(pageId, params?)`
- `window.App.goBack()`

Navigation page ids must be lowercase and match `[page]` in `src/pages/[page].page.tsx`.

## Store update bridge

When a page uses `zustand` from this template, store changes are broadcast to the host
through `window.parent.postMessage`.

- message type: `update`
- payload shape:

```ts
{
  type: 'update',
  name: 'state',
  data: {
    state: unknown,
    ts: number
  }
}
```

Notes:

- broadcasts run in browser context when `window.parent` is available
- the state payload is cloned before sending
- function fields (store actions) are excluded from payload
- `Map`/`Set`/`Date` and circular references are preserved
- symbol keys and function values are removed from payload

Host listener example:

```ts
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'update') return;

  const { state, ts } = event.data.data || {};
  console.log('store updated at', ts, state);
});
```

## Quick start

```bash
pnpm install
pnpm run dev
```

## Validation commands

```bash
pnpm run typecheck
pnpm run build
pnpm run theme:classes
```

## E2B template build (v2, no local Docker required)

E2B build scripts were moved to the repository root. The E2B Dockerfile now
targets the repository `workspace` directory as the sandbox workspace content, so `/workspace` contains:

- `prototype/`
- `components/`
- `business/`
- `specs/`
- `supabase/`
- `lib/`

Set your API key before building (SDK uses `E2B_API_KEY`):

```bash
export E2B_API_KEY=e2b_***
```

```bash
pnpm run e2b:workspace:build:dev
pnpm run e2b:workspace:build:prod
```

Output template ids:

- dev: `design-dev`
- prod: `design-v5`

## Notes

- `src/core/` is runtime kernel; treat it as template internals.
- `src/data/`, `src/components/`, `src/pages/`, `src/stores/`, `src/snapshots/`, and `src/utils/` are intentionally empty and use `.gitkeep` placeholders.
- To run `build`, add at least one page file using `src/pages/[page].page.tsx`.
- Theme tokens come from `src/data/theme.json` and map to Tailwind `theme.extend`.
- In new page/component code, prefer Tailwind utility classes (`bg-*`, `text-*`, `border-*`) over direct `var(--color-*)` references.
- Keep CSS variable compatibility for existing pages that already depend on token variables.
- Generated Supabase APIs should be imported directly from `@workspace/api-client-react`.
