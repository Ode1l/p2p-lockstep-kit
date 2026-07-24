# Plan: Fix production bootstrap

> Status: COMPLETED
> Created: 2026-07-22
> Last Updated: 2026-07-22

## Goal
Make a clean npm-installed production build of Mahjong register its UI component explicitly and render the application instead of a blank page.

## Assumptions
- The deployment serves Vite's `dist` directory after running `pnpm build`.
- The deployment runtime supports Node `^20.19.0 || >=22.12.0`, as required by Vite 8's build dependencies.

## Open Questions
None.

## Spec-Lite

### Acceptance Criteria
- [x] A clean checkout installs both published `0.1.0` framework packages and builds successfully.
- [x] The production bundle retains the multiui custom-element registration code.
- [x] Production preview displays the Mahjong landing UI and reports no browser errors.
- [x] Existing typecheck and 17 tests continue to pass.

### Non-goals
- Republishing or changing `p2p-lockstep-kit-multiui`.
- Changing Mahjong rules, networking behavior, or visual design.
- Configuring a specific hosting provider without its deployment URL or configuration.

### Edge Cases
- Tree-shaking must not be able to remove registration when package side-effect metadata excludes JavaScript entry points.

## Design Decisions
None — no design-sensitive changes. The fix uses the existing exported `defineP2PLockstepMultiUi()` bootstrap API instead of relying on an import side effect.

## Steps Overview
| Step | File | Status | Goal |
|------|------|--------|------|
| Step 1 | `steps/step-1.md` | COMPLETED | Explicitly register multiui and verify a clean production deployment end to end. |

## Validation Commands

| Purpose | Command | Source | Required? |
|---|---|---|---|
| Typecheck | `pnpm typecheck` | `package.json` | yes |
| Lint | unavailable — no lint script configured | `package.json` | no |
| Test | `pnpm test` | `package.json` | yes |
| Build | `pnpm build` | `package.json` | yes |
| Clean dependency install | `git archive HEAD` into a temporary directory, then `pnpm install --no-frozen-lockfile` | deployment simulation | yes |
| Browser production smoke | `pnpm preview` plus browser render/log inspection | reproduced failure path | yes |

## Context & Learnings
### Key Decisions
- Use explicit component registration in the application bootstrap; this is robust regardless of package tree-shaking metadata and requires no new package release.

### Gotchas & Warnings
- The ignored local `pnpm-lock.yaml` points at sibling workspace links and is not representative of deployment dependency resolution.
- A successful Vite build alone did not catch the issue because the application waited forever on `customElements.whenDefined()`.

> Append only. Never delete or rewrite existing entries below — only add new rows/facts as steps complete.
### Working Set
| Path | Role in this task | Evidence |
|------|-------------------|----------|
| `src/main.ts` | Application bootstrap and current side-effect-only multiui import | `read` and production bundle inspection, 2026-07-22 |
| `package.json` | Dependency versions and validation commands | `read`, npm registry checks, and clean install, 2026-07-22 |
| `vite.config.ts` | Production asset-base and preview configuration | `read`; `base: "./"` already supports subpath hosting, 2026-07-22 |
| Published `p2p-lockstep-kit-multiui@0.1.0` | Defines and exports explicit registration API but marks only CSS as side-effectful | clean npm install plus package/bundle inspection, 2026-07-22 |

### Verified Facts
- Both framework dependencies resolve from npm at version `0.1.0` — verified by `npm view` and clean `pnpm install`, 2026-07-22.
- A clean checkout passes typecheck, all 17 tests, and Vite build, but its production preview is visually blank — verified in a temporary deployment simulation and Chrome, 2026-07-22.
- The blank build contains `customElements.whenDefined()` but zero `customElements.define()` calls — verified by production bundle search, 2026-07-22.
- The published multiui package exports `defineP2PLockstepMultiUi()` and calls it internally, but its `sideEffects` manifest includes only CSS, allowing the side-effect-only JS import to be removed — verified by installed package manifest/source inspection, 2026-07-22.

## Implementation Log
| Date | Step | Summary |
|------|------|---------|
| 2026-07-22 | Step 1 | Replaced the removable side-effect import with explicit component registration; local and clean npm builds, 17 tests, bundle audit, development server, production preview, real signaling registration, and browser error checks passed. |
