# Minimal Actions Modernization Design

## Goal

Silence the currently observed GitHub Actions Node 20 deprecation warning with the smallest safe workflow change, while also fixing the separate backend Linux dead-code regression that is still blocking green CI.

## Scope

This design intentionally stays narrow.

Included:
- Update `actions/checkout` wherever it appears in repo workflows.
- Fix `packages/desktop/src-tauri/src/path_safety.rs` so Linux builds no longer compile unused macOS-only helper code.
- Re-run the backend verification commands locally before pushing.

Excluded:
- Broad GitHub Actions dependency upgrades.
- Workflow logic changes.
- Release process changes.
- Refactors in Rust path-safety logic beyond the dead-code fix.

## Current State

The repository currently uses `actions/checkout@v4` in:
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/release-claude-acp.yml`

GitHub is warning that Node.js 20 actions are deprecated and specifically names `actions/checkout@v4`.

Separately, backend CI is failing on Linux with:
- `function trim_trailing_separators is never used`
- file: `packages/desktop/src-tauri/src/path_safety.rs`

That helper is only needed by macOS lexical path classification logic, but Linux test builds still compile it under the current cfg arrangement.

## Proposed Approach

### 1. Minimal GitHub Actions modernization

Update `actions/checkout` to the current Node-24-ready major version in all three workflow files listed above.

No other actions will be changed in this pass unless verification shows the warning simply shifts to a different already-present action and blocks the intended cleanup goal.

Rationale:
- It directly targets the warning the user asked about.
- It keeps workflow behavior stable.
- It avoids mixing modernization with unrelated CI restructuring.

### 2. Backend Linux dead-code fix

Narrow `trim_trailing_separators` in `packages/desktop/src-tauri/src/path_safety.rs` to macOS-only compilation.

The helper is consumed by macOS lexical safety checks and macOS-only tests, so compiling it on Linux creates dead-code failures without providing value.

Rationale:
- This matches the actual platform usage.
- It is smaller and clearer than adding allow/expect attributes.
- It preserves strict warnings as errors.

## Files To Change

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/release-claude-acp.yml`
- `packages/desktop/src-tauri/src/path_safety.rs`

## Risks

### Workflow upgrade risk

Changing `actions/checkout` across workflows could expose minor behavior differences, but this is the lowest-risk action upgrade because the action purpose stays identical and no workflow logic changes are planned.

### Backend fix risk

If `trim_trailing_separators` is unexpectedly used by non-macOS tests later, Linux compilation would fail again. That would indicate the helper should be shared more broadly. Current code inspection does not show that usage.

## Verification Plan

### Local backend verification

Run in `packages/desktop/src-tauri`:
- `cargo check --all-targets`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test -- --skip claude_history::export_types`

### Workflow verification

After push, confirm:
- backend CI no longer fails on `trim_trailing_separators`
- the Node 20 warning no longer names `actions/checkout@v4`

## Success Criteria

- `actions/checkout` no longer emits the Node 20 deprecation warning in repo workflows.
- Backend CI no longer fails on dead code in `packages/desktop/src-tauri/src/path_safety.rs`.
- No additional workflow behavior changes are introduced in this pass.
