# Step 1: Explicitly register multiui in production

> Status: COMPLETED
> Created: 2026-07-22

## Goal
Replace the removable side-effect import with an explicit multiui registration call and prove the clean production page renders.

## Prerequisites
- The production blank page is reproduced from a clean npm installation.
- Files to modify: `src/main.ts` and this task's workflow records only.
- Existing public API: `defineP2PLockstepMultiUi()` from `p2p-lockstep-kit-multiui`.

## Deliverables
- `src/main.ts` explicitly registers `<p2p-lockstep-multi-app>` before waiting for it.
- After this step: clean install, typecheck, 17 tests, build, bundle audit, production preview, and browser error check all pass.

## Plan
- [x] `read` `src/main.ts` and `rg` multiui registration usages — re-confirm the exact bootstrap boundary and existing API.
- [x] `edit` `src/main.ts` — import and call `defineP2PLockstepMultiUi()` before `start()`.
- [x] `bash` `pnpm typecheck`, `pnpm test`, and `pnpm build` — verify source correctness and existing behavior.
- [x] `bash` temporary clean checkout/install/build and bundle search — verify npm dependency resolution and retained `customElements.define()`.
- [x] `browser` production preview — verify visible landing UI and zero console errors.

## Quality Checklist
- [x] Evidence-before-edit: `src/main.ts`, installed package manifest/output, and clean production bundle inspected; validation commands identified from `package.json`.
- [x] Existing pattern / reuse checked: reuse exported `defineP2PLockstepMultiUi()`; no helper or dependency added.
- [x] Contract understood: register the Web Component synchronously before `whenDefined()`; all later session/network behavior remains unchanged.
- [x] Risk reviewed: frontend production bootstrap/tree-shaking only.
- [x] Mitigation recorded: clean npm install, bundle symbol audit, visible browser render, console error check, and full existing test suite.

## Validation Checklist
- [x] `pnpm typecheck` exits 0.
- [x] `pnpm build` exits 0.
- [x] Clean deployment build contains both registration and application bootstrap.
- [x] Production preview visibly renders the Mahjong landing screen with zero errors.

## Test Checklist
- [x] `pnpm test` — all 17 tests pass.

## Implementation Notes
Imported the existing `defineP2PLockstepMultiUi()` value alongside the element type and called it immediately before `start()`. The production bundle now retains one `customElements.define()` and one `customElements.whenDefined()` call. A clean npm install reached the real lobby through the signaling service with online `1/4`, invitation UI, and no browser errors. Development mode also served the document and `src/main.ts` successfully.

## Files Changed
- `src/main.ts`
- `plans/2026-07-22-fix-production-bootstrap/plan.md`
- `plans/2026-07-22-fix-production-bootstrap/steps/step-1.md`
