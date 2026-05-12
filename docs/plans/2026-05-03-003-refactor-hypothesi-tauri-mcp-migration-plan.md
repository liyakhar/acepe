---
title: refactor: align Tauri MCP bridge with Hypothesi server
type: refactor
status: active
date: 2026-05-03
deepened: 2026-05-03
---

# refactor: align Tauri MCP bridge with Hypothesi server

## Overview

Acepe already points editor and agent MCP clients at `@hypothesi/tauri-mcp-server`, but the desktop app still embeds an older `tauri-plugin-mcp-bridge = "0.9"` debug-only plugin registration. This work aligns the app-side bridge with the Hypothesi server's supported setup, keeps the bridge debug-only, and verifies that live Tauri automation still connects cleanly after the upgrade.

## Problem Frame

Acepe is in a half-migrated state. Repo-level MCP configs (`.mcp.json`, `.vscode/mcp.json`, `opencode.json`) already launch the Hypothesi server, while the app-side Rust dependency and startup wiring still reflect an older bridge version. That mismatch increases the chance of silent incompatibilities in live Tauri automation, especially in the exact workflows we now rely on for streaming QA and UI debugging.

The migration is not a ground-up replacement of the in-app integration. Hypothesi's MCP server still depends on the `tauri-plugin-mcp-bridge` plugin, so the work is to bring Acepe's app-side bridge wiring up to the server's expected version and configuration, then prove the debug runtime still exposes the automation surface correctly.

## Requirements Trace

- R1. Acepe's app-side Tauri bridge must match the Hypothesi MCP server's documented compatibility expectations.
- R2. Debug builds must continue exposing the bridge cleanly to live Tauri automation sessions.
- R3. Release builds must not accidentally widen the automation surface or regress startup behavior.
- R4. Repo-level MCP config and app-side bridge assumptions must be internally consistent after the migration.

## Scope Boundaries

- Do not replace Tauri automation with WebDriver or CrabNebula tooling in this change.
- Do not ship the bridge in release builds unless the migration reveals a hard requirement to do so.
- Do not redesign repo-wide MCP client config beyond consistency changes needed for the Hypothesi migration.
- Do not broaden Tauri window capabilities unless the upgraded bridge explicitly requires it.

## Context & Research

### Relevant Code and Patterns

- `packages/desktop/src-tauri/Cargo.toml` currently depends on `tauri-plugin-mcp-bridge = "0.9"`.
- `packages/desktop/src-tauri/src/lib.rs` registers the bridge under `#[cfg(debug_assertions)]` immediately after the standard plugin chain and before `.setup(...)`.
- `packages/desktop/src-tauri/tauri.conf.json` already has `"app": { "withGlobalTauri": true }`, which Hypothesi documents as required.
- `packages/desktop/src-tauri/capabilities/default.json` does not currently grant the documented required `mcp-bridge:default` permission.
- `packages/desktop/src-tauri/.gitignore` ignores `/gen/schemas`, so regenerated Tauri schema artifacts are local review inputs rather than committed source files.
- Root MCP configs already target Hypothesi:
  - `.mcp.json`
  - `.vscode/mcp.json`
  - `opencode.json`

### Institutional Learnings

- `docs/solutions/best-practices/telemetry-integration-tauri-svelte-privacy-first-2026-04-14.md`
  - Startup wiring that spans the Tauri backend and frontend should be treated as a coordinated runtime contract, not as a one-sided config tweak. `src-tauri/src/lib.rs` is the right place to make that integration explicit.
- `docs/solutions/test-failures/bun-module-mock-cache-leakage-2026-04-25.md`
  - Avoid brittle mid-layer mocking for tooling migrations; prefer low-level seams or live smoke validation when the risk is integration wiring.
- `docs/solutions/architectural/final-god-architecture-2026-04-25.md`
  - Live Tauri smoke validation remains necessary when startup or automation connectivity is part of the behavior being changed.

### External References

- Tauri test documentation: `https://v2.tauri.app/develop/tests/`
- Tauri WebDriver documentation: `https://v2.tauri.app/develop/tests/webdriver/`
- Hypothesi MCP Server for Tauri docs: `https://hypothesi.github.io/mcp-server-tauri/`
- Hypothesi project overview: `https://hypothesi.dev/projects/mcp-server-tauri/`
- Hypothesi server registry metadata: `@hypothesi/tauri-mcp-server@0.11.1`

## Key Technical Decisions

- Preserve debug-only bridge registration.
  - Rationale: Acepe already treats automation and deep diagnostics as debug-only tooling. Hypothesi's own quick-start shows the bridge under `#[cfg(debug_assertions)]`, so keeping that boundary avoids widening the release surface without losing local QA utility.
- Treat this as an app-side compatibility alignment, not an architecture rewrite.
  - Rationale: Hypothesi still relies on `tauri-plugin-mcp-bridge`; the migration should stay minimal and focus on version/config compatibility, startup hygiene, and verification.
- Keep `withGlobalTauri` enabled for Acepe, but treat it as an explicit trusted-renderer decision that must remain paired with Acepe's local-app runtime assumptions and null CSP posture.
  - Rationale: Hypothesi requires `withGlobalTauri`, and Acepe already enables it. The migration should preserve that behavior while explicitly re-checking that we are not broadening the automation surface beyond the existing trusted local desktop model.
- Define renderer-safety acceptance criteria for the app-wide `withGlobalTauri` posture.
  - Rationale: keeping `withGlobalTauri` app-wide is only acceptable if Acepe continues to render trusted local content only. The migration should explicitly require that remote navigation and untrusted content injection are not part of the renderer model this automation surface is attached to.
- Do not introduce a separate debug-only Tauri config override for `withGlobalTauri` or capabilities in this migration.
  - Rationale: Tauri treats `withGlobalTauri` as an app-wide config value, not a build-profile toggle. A debug-only split would require separate config files or `--config` override plumbing that Acepe does not currently use. That added config complexity is larger than this compatibility migration and is unnecessary as long as the bridge itself remains debug-only.
- Add the documented `mcp-bridge:default` capability grant and review all generated ACL/schema diffs under a least-privilege lens.
  - Rationale: Hypothesi's getting-started guide explicitly requires `mcp-bridge:default`. Treating the permission as optional would leave Acepe in a still-broken half-state. Tauri capabilities can be scoped by window/webview/platform but not by debug vs release, so the permission remains in the tracked capability file while the bridge plugin itself stays debug-only.
- Scope the `mcp-bridge:default` grant to Acepe's existing main desktop window surface only, and treat any broader window/webview/platform expansion as a blocker.
  - Rationale: the bridge permission should follow the minimum surface Acepe actually automates today. A wider grant would be a new security decision, not incidental migration fallout.
- Pin the repo's Hypothesi MCP server entrypoints to a concrete compatible version during the migration.
  - Rationale: a compatibility migration cannot be verified against `npx -y latest` because the target can drift after merge. The migration should validate against a stable server version, currently `0.11.1`.
- Treat the pinned Hypothesi server as an explicitly trusted third-party dev tool with bounded use.
  - Rationale: pinning solves drift, but the package is still executable third-party tooling. The migration should record that live verification assumes a reviewed/pinned package version and uses it only for local development automation against the running Acepe app.
- Treat regenerated `src-tauri/gen/schemas/*` artifacts as local validation output, not committed deliverables.
  - Rationale: Acepe explicitly ignores `/gen/schemas` in `packages/desktop/src-tauri/.gitignore`. The implementation should regenerate and inspect those files locally when capabilities or bridge dependencies change, but commit only tracked source/config changes.
- Verify with both automated startup coverage and a live bridge smoke pass.
  - Rationale: the failure mode here is not pure compile breakage. The most important regressions are "the app builds but the MCP server cannot actually connect" and "debug-only behavior leaks or breaks release startup."

## Open Questions

### Resolved During Planning

- Does Hypothesi require a different in-app plugin than Acepe currently uses?
  - No. Hypothesi's MCP server still expects `tauri-plugin-mcp-bridge`; the migration is an app-side alignment to the supported bridge version and setup.
- Is `withGlobalTauri` already configured?
  - Yes. `packages/desktop/src-tauri/tauri.conf.json` already sets `app.withGlobalTauri` to `true`.
- Do repo-level MCP client configs already target Hypothesi?
  - Yes. `.mcp.json`, `.vscode/mcp.json`, and `opencode.json` already launch `@hypothesi/tauri-mcp-server`.

### Deferred to Implementation

- Does the bridge crate version bump regenerate Tauri schema metadata or capability manifests in a way that should be committed?
- No. `packages/desktop/src-tauri/.gitignore` ignores `/gen/schemas`, and those files are not tracked in this repo. Regenerate them locally for review when needed, but do not commit them.
- Can `withGlobalTauri` be scoped to debug-only config in Acepe's current Tauri setup without creating config sprawl or runtime divergence?
  - Not cleanly within the current Acepe setup. Tauri supports config overrides, but Acepe currently ships a single `tauri.conf.json` and a single `bun run tauri` flow. This migration will keep `withGlobalTauri` app-wide and rely on debug-only plugin registration plus explicit live negative-path validation instead of introducing parallel config files.

## Implementation Units

- [ ] **Unit 1: Align the app-side bridge dependency with Hypothesi's supported setup**

**Goal:** Bring the Rust-side Tauri bridge dependency and registration path into line with the Hypothesi server's expected app-side setup without widening the release surface.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `packages/desktop/src-tauri/Cargo.toml`
- Modify: `packages/desktop/src-tauri/src/lib.rs`
- Create: `packages/desktop/src-tauri/src/mcp_bridge.rs`
- Test: `packages/desktop/src-tauri/tests/mcp_bridge_startup.rs`

**Approach:**
- Upgrade `tauri-plugin-mcp-bridge` from the current `0.9` dependency to the `0.11` line that matches Hypothesi's documented setup and `@hypothesi/tauri-mcp-server@0.11.1` compatibility target.
- Extract the bridge-registration logic into a small dedicated helper module so the debug-only registration seam is testable without forcing tests to re-execute the entire `run()` startup body.
- Keep bridge registration in the existing startup phase and preserve `#[cfg(debug_assertions)]`, but make the helper explicit enough that a test can prove the debug path compiles and the release path excludes the bridge.
- Register the new test target explicitly in `Cargo.toml`, because Acepe disables test auto-discovery with `autotests = false`.

**Execution note:** Start with the smallest failing startup/compile smoke that proves the old bridge setup is no longer the desired contract, then make the minimal Rust changes to satisfy it.

**Patterns to follow:**
- Existing debug-only plugin gating in `packages/desktop/src-tauri/src/lib.rs`
- Existing startup-wiring discipline from `docs/solutions/best-practices/telemetry-integration-tauri-svelte-privacy-first-2026-04-14.md`

**Test scenarios:**
- Happy path: a debug-path startup smoke can call the extracted bridge-registration seam and construct the builder with the upgraded plugin registered.
- Error path: the test fails if the bridge init API or registration signature drifts during the version bump.
- Integration: release-path compilation or equivalent non-debug startup coverage proves the bridge does not leak into release-only builder behavior.

**Verification:**
- Acepe compiles with the upgraded bridge dependency.
- The new startup smoke passes.
- The debug builder path still registers the bridge cleanly before `.setup(...)`.

- [ ] **Unit 2: Reconcile config and generated Tauri metadata with the upgraded bridge**

**Goal:** Ensure Acepe's Tauri config, capabilities, and generated schema/manifests are consistent with the upgraded bridge setup and do not carry stale assumptions.

**Requirements:** R1, R4

**Dependencies:** Unit 1

**Files:**
- Verify / modify if needed: `packages/desktop/src-tauri/tauri.conf.json`
- Modify: `packages/desktop/src-tauri/capabilities/default.json`
- Verify / regenerate locally only: `packages/desktop/src-tauri/gen/schemas/desktop-schema.json`
- Verify / regenerate locally only: `packages/desktop/src-tauri/gen/schemas/macOS-schema.json`
- Verify / regenerate locally only: `packages/desktop/src-tauri/gen/schemas/acl-manifests.json`
- Modify: `.mcp.json`
- Modify: `.vscode/mcp.json`
- Modify: `opencode.json`
- Test: `packages/desktop/src-tauri/tests/mcp_bridge_startup.rs`

**Approach:**
- Keep the existing single-config `withGlobalTauri: true` posture in `tauri.conf.json` and do not add a debug-only config split in this migration.
- Add `mcp-bridge:default` to `packages/desktop/src-tauri/capabilities/default.json` while keeping the permission scoped to Acepe's existing `main` window capability surface, then regenerate and review any schema/ACL artifact changes.
- Review every generated `mcp-bridge:*` permission or ACL diff for least privilege rather than accepting broad generated churn by default.
- Regenerate `gen/schemas/*` locally only to inspect the resulting permission surface and schema changes; do not commit those generated files because they are ignored repo artifacts.
- Pin `.mcp.json`, `.vscode/mcp.json`, and `opencode.json` to `@hypothesi/tauri-mcp-server@0.11.1` so the app-side migration and server-side compatibility target stay stable during verification.
- Record explicit renderer-safety acceptance criteria during verification: Acepe must remain a trusted local-renderer app with no untrusted remote navigation path relied upon by this MCP surface.

**Patterns to follow:**
- Minimal capability editing in `packages/desktop/src-tauri/capabilities/default.json`
- Existing root-level MCP config shape in `.mcp.json`, `.vscode/mcp.json`, and `opencode.json`

**Test scenarios:**
- Happy path: `mcp-bridge:default` is present and the regenerated schema/ACL metadata reflects the upgraded bridge version without unrelated churn.
- Edge case: no broader-than-needed bridge permission grant is introduced beyond the documented default capability requirement or beyond the existing `main` window scope.
- Error path: schema or ACL regeneration that introduces surprising `mcp-bridge:*` surface area is treated as a review blocker rather than auto-accepted.
- Integration: repo-level MCP config resolves to the pinned `@hypothesi/tauri-mcp-server@0.11.1` entrypoint after the app-side migration.

**Verification:**
- `tauri.conf.json` continues satisfying Hypothesi's documented requirements.
- `capabilities/default.json` contains the required `mcp-bridge:default` grant and no broader bridge grant or scope expansion beyond the intended main window surface.
- Generated metadata is either unchanged or reviewed locally in a narrowly explainable, least-privilege way.
- Repo MCP config and app-side bridge expectations are no longer in mismatch.

- [ ] **Unit 3: Prove live Hypothesi connectivity against the migrated debug app**

**Goal:** Validate that the upgraded app-side bridge can still be driven by the Hypothesi server in real Acepe debugging workflows.

**Requirements:** R2, R4

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify if documentation note is needed: `packages/desktop/README.md`
- Modify if documentation note is needed: `docs/solutions/` (follow-up only if the migration exposes a durable new pattern)
- Test: `packages/desktop/src-tauri/tests/mcp_bridge_startup.rs`

**Approach:**
- Run a live Tauri smoke pass with the migrated debug app and the pinned `@hypothesi/tauri-mcp-server@0.11.1` server.
- Validate at least one real repo-configured entrypoint, not just a manually launched ad hoc server process. The smoke should prove that Acepe's checked-in MCP client config can still launch and attach.
- Use a small capability matrix rather than a single happy-path action: confirm connection plus read/inspect state, screenshot capture, and one interaction/input action.
- Add a negative-path check: confirm that attaching to a non-debug or release-mode build fails clearly and diagnostically rather than as a vague handshake timeout.
- Explicitly verify the expected access boundary for the debug automation surface (local dev target, same-user/local-machine assumptions) and capture any gaps.
- Treat the pinned Hypothesi package as a reviewed third-party dev dependency for this workflow only; if the pinned package cannot be obtained or behaves unexpectedly, stop the migration rather than silently falling back to `latest`.
- Only add local documentation if the migration changes the operator workflow or required setup materially.

**Patterns to follow:**
- Live validation posture from `docs/solutions/architectural/final-god-architecture-2026-04-25.md`

**Test scenarios:**
- Happy path: the pinned Hypothesi server connects to the Acepe debug app through a real repo-configured MCP entrypoint and can inspect state, capture a screenshot, and perform one interaction.
- Error path: failed connection surfaces a concrete bridge mismatch rather than a silent startup success.
- Error path: attempting to attach to a release/non-debug target fails loudly with an intentional diagnostic.
- Error path: if the pinned Hypothesi package is unavailable or mismatched, the verification flow fails closed rather than silently swapping to an unpinned server.
- Integration: a real end-to-end smoke proves the app-side bridge, repo MCP config, and live server invocation work together.

**Verification:**
- A live Hypothesi session launched from a checked-in MCP config can connect to the running debug app.
- The capability matrix succeeds after connection.
- The release/non-debug failure mode is intentional and understandable.
- The verification notes confirm the trusted-renderer assumption still holds for Acepe's app content/navigation model.
- No release-only behavior or non-debug startup path regresses as a side effect.

## System-Wide Impact

- **Interaction graph:** This touches the Rust startup chain in `src-tauri/src/lib.rs`, the crate dependency surface in `Cargo.toml`, generated Tauri schemas, and the repo-level MCP client configs that launch Hypothesi.
- **Error propagation:** The most meaningful failures will show up as debug-app startup problems, bridge handshake failures, or MCP clients that launch successfully but cannot attach to the app.
- **State lifecycle risks:** Minimal user-data risk, but there is a packaging/startup risk if debug-only wiring accidentally bleeds into release behavior or if release-mode failure is too opaque for operators to diagnose.
- **API surface parity:** `.mcp.json`, `.vscode/mcp.json`, and `opencode.json` should continue describing the same server contract after the migration.
- **Integration coverage:** Rust compile/startup smoke plus a real live Hypothesi connection are both required; either one alone is insufficient.
- **Security boundary:** `withGlobalTauri`, bridge permissions, and the debug-only automation surface must be reviewed together as one trusted-renderer boundary, not as unrelated config toggles.
- **Build-shape constraint:** debug/release scoping for this migration comes from Rust plugin registration, not from Tauri capability files or per-build app config, because Acepe does not currently maintain parallel Tauri config overlays.
- **Third-party tooling boundary:** the pinned Hypothesi server is part of the trusted local-dev toolchain for this migration, not a floating runtime dependency.

## Risks & Dependencies

- The bridge crate upgrade may change generated permissions metadata and must not silently widen the granted automation surface beyond `mcp-bridge:default` without an explicit decision.
- A "successful" dependency bump can still fail at runtime if the live handshake between app and Hypothesi server drifted.
- This work depends on the pinned Hypothesi server version and bridge crate line remaining compatible; later upgrades should be treated as a fresh compatibility change, not as an automatic float-forward.
- Because `withGlobalTauri` remains app-wide in Acepe's single-config setup, the migration must rely on the existing trusted local-renderer model and on keeping the bridge plugin itself debug-only rather than on config-level build-profile separation.
- If Acepe ever introduces untrusted remote renderer content or broader window/webview surfaces, this plan's security posture becomes invalid and the automation boundary must be redesigned before keeping `withGlobalTauri` app-wide.

## Documentation / Operational Notes

- No user-facing product behavior should change.
- If the migration changes the local setup workflow materially, capture that in a concise developer-facing note rather than spreading ad hoc setup comments across configs.

## Sources & References

- Related code:
  - `packages/desktop/src-tauri/Cargo.toml`
  - `packages/desktop/src-tauri/src/lib.rs`
  - `packages/desktop/src-tauri/tauri.conf.json`
  - `packages/desktop/src-tauri/capabilities/default.json`
  - `.mcp.json`
  - `.vscode/mcp.json`
  - `opencode.json`
- Institutional references:
  - `docs/solutions/best-practices/telemetry-integration-tauri-svelte-privacy-first-2026-04-14.md`
  - `docs/solutions/test-failures/bun-module-mock-cache-leakage-2026-04-25.md`
  - `docs/solutions/architectural/final-god-architecture-2026-04-25.md`
- External docs:
  - `https://hypothesi.github.io/mcp-server-tauri/`
  - `https://hypothesi.dev/projects/mcp-server-tauri/`
  - `https://v2.tauri.app/develop/tests/`
  - `https://v2.tauri.app/develop/tests/webdriver/`
