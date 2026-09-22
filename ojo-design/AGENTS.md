# Workspace Agent Contract

This file is the execution contract for coding agents in the runtime workspace layout.

## Mission

- `prototype`: interaction and visual prototype surface.
- `business`: production-facing implementation surface.
- `components`: shared UI building blocks.

Primary objective: convert validated prototype behavior into maintainable business code without copying prototype-only coupling.

## Runtime Path Model

Use runtime paths in task prompts and command examples:

- `/workspace/prototype`
- `/workspace/prototype/src`
- `/workspace/business`
- `/workspace/components`
- `/workspace/specs`
- `/workspace/supabase`
- `/workspace/lib`

Path mapping note:

- This contract follows runtime paths under `/workspace/**`.
- Keep all migration prompts and acceptance checks expressed with `/workspace` paths.

## Directory Boundaries

- Read scope: all of `/workspace/**` is readable.
- Default write scope: `/workspace/business/**`.
- Write to `/workspace/prototype/**` only when the task explicitly asks to fix prototype-side issues.
- Shared extraction target: `/workspace/components/**` only for clear multi-domain reuse.
- Do not restate the frontend root as `/workspace/src`; in this runtime the frontend app root is always `/workspace/prototype`, with source files under `/workspace/prototype/src`.

## Translation Contract (prototype -> business)

For each migration task, define:

- **Input**
  - Prototype page/module source path(s).
  - Target business path(s).
  - Acceptance intent (what behavior must stay equivalent).
- **Output**
  - Business code implementing the same user-visible behavior.
  - Short migration note including assumptions, gaps, and risk items.

## Invariants (Must Keep)

- User-visible interaction semantics.
- State semantics (state meaning and transitions).
- Theme token meaning and naming expectations.

Implementation structure can change, but behavior parity is required.

## Styling Policy (New Code)

- Prefer Tailwind semantic utility classes in feature/page code:
  - `bg-*`, `text-*`, `border-*`, `ring-*`
- Avoid introducing direct `var(--color-*)` usage in new business/page code unless there is no practical utility alternative.
- Keep legacy token compatibility intact for existing pages that already rely on CSS variables.
- If direct CSS variable usage is necessary (e.g. complex gradients, third-party overrides), keep it localized and documented in the module.

## Do Not Copy Into business

- Prototype host bridge logic tied to iframe parent messaging (`postMessage`) unless explicitly required by business runtime.
- Prototype-only state hydration hacks from URL/search params unless approved as business behavior.
- Build-time shortcuts meant for prototype packaging only.

## Technical Constraints to Respect

- Workspace scripts are orchestrated from `/workspace/package.json`.
- Supabase function source of truth is `/workspace/supabase/functions/*/contract.ts`.
- Refresh generated API artifacts with `pnpm gen:supabase-api`.
- Generated frontend API output lives under `/workspace/lib/api-client-react/src/generated`.
- Shared request/runtime helpers live under `/workspace/lib/integrations`.
- Prototype build and entry constraints are centralized in `/workspace/prototype/rspack.config.ts`.
- Theme token generation behavior is defined by `/workspace/prototype/tailwind.config.ts` and `/workspace/prototype/src/data/theme.json`.
- State wrapper behavior (URL hydration + update bridge) is defined in `/workspace/prototype/src/core/zustand-wrapper.ts`.

## Quality Gates Before Completion

At minimum, run relevant checks for changed scope:

1. `pnpm run typecheck` (workspace-level when cross-package changes exist).
2. Package-local build/typecheck scripts for touched package(s).
3. Any available tests for changed modules.
4. For server-backed work, include explicit apply/serve/deploy/refresh/verify follow-through in the completion note instead of stopping at file authoring.

If tests do not exist yet, explicitly call that out in the migration note.

## Execution Style

- Work in small batches (one page or one feature slice per task).
- Keep diffs reviewable and scoped.
- Add concise comments only when logic is non-obvious.
- Prefer deterministic code paths over implicit magic.

## Escalation Rules

Stop and ask for confirmation when:

- Required behavior is ambiguous.
- A change would alter shared API contracts.
- A migration would require changing prototype runtime assumptions in a way that may break existing preview flow.
