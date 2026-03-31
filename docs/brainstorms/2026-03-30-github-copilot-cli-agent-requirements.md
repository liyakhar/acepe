---
date: 2026-03-30
topic: github-copilot-cli-agent
---

# GitHub Copilot CLI Agent Integration

## Problem Frame
Acepe already treats Claude Code, Cursor, OpenCode, and Codex as first-class agents. We want GitHub Copilot CLI to sit in the same product surface: selectable in the agent UI, installable by Acepe, resumable from history, and usable through the existing ACP client flow.

Copilot CLI is a good architectural fit because it exposes an ACP server through `copilot --acp --stdio`. Local investigation also showed an important constraint: visible files under `~/.copilot/session-state/*` contain lightweight metadata such as `workspace.yaml` and `checkpoints/index.md`, but no obvious raw transcript files. The Copilot runtime bundle also knows about `.copilot/session-store.db`, but that file is not guaranteed to exist on disk. Because of that, Acepe should define “history and resume” around Copilot’s ACP session APIs first, not around reverse-engineering undocumented storage.

## Requirements

**Agent Identity**
- R1. GitHub Copilot CLI must be added as a built-in Acepe agent with canonical ID `copilot`.
- R2. The user-facing display name must be `GitHub Copilot`.
- R3. The new agent must participate in the same registry, picker, panel, and thread-list flows as the existing built-in agents.

**Installation and Provisioning**
- R4. Acepe must install Copilot itself by downloading official GitHub Copilot CLI release assets; the user must not need npm, Homebrew, or a manual binary install for the supported path.
- R5. Installation must use Acepe’s cache-managed binary flow so install, upgrade, uninstall, and install-progress behavior matches the other installable agents.
- R6. Acepe must verify the downloaded Copilot archive against the official release checksum before activating the install.
- R7. Acepe may keep environment-variable or PATH-based launch overrides for development and diagnostics, but the product path must be the Acepe-managed cached binary.

**Runtime State and Storage**
- R8. Acepe must use the user’s shared `~/.copilot` home and must not create a second Copilot state directory.
- R9. Acepe must not copy, migrate, or rewrite Copilot session data into a private Acepe-owned transcript format as part of this feature.

**Live Session Execution**
- R10. Copilot sessions must be started through the existing ACP client flow using `copilot --acp --stdio`.
- R11. Copilot mode, model, and config-option data must flow through the same ACP initialize/new/resume handling used for other ACP-backed agents.
- R12. Missing authentication or missing Copilot entitlement must surface as an actionable runtime error in Acepe.
- R13. For this feature, auth UX must match the current agents: Acepe does not own the full login flow yet, and the error state must tell the user to run `copilot login`.

**History and Resume**
- R14. Copilot sessions must appear in Acepe history alongside the other agents.
- R15. The primary source of Copilot session history metadata must be Copilot’s ACP `session/list` API, not undocumented transcript scraping.
- R16. Opening a Copilot history item must reconstruct session entries by loading or resuming that session through Copilot ACP so prior events replay into Acepe.
- R17. Acepe must support Copilot resume even when raw transcript files are not visible on disk.
- R18. Acepe may read documented or clearly observed files under `~/.copilot/session-state` only as a supplemental metadata source or fallback, but the feature must not depend on private storage formats that are not stable or discoverable.
- R19. If a Copilot history item cannot be loaded because the binary is missing, the user is logged out, or the session no longer exists, Acepe must keep the history record and show a clear failure state instead of silently removing it.

**Project and Worktree Context**
- R20. Copilot history records must preserve the session working directory so Acepe can map history items back to the correct project.
- R21. When Copilot metadata exposes repo or worktree context, Acepe should preserve it so worktree-aware history loading remains correct.

**UI and Branding**
- R22. Copilot must appear in the welcome screen, install card, agent picker, tab icons, queue rows, and thread list with Copilot branding.
- R23. Copilot install state must behave like the other installable agents: install button before install, progress during download, and normal selection after install.
- R24. A missing-login error must not look like a missing-install error.

## Success Criteria
- A user can install GitHub Copilot from Acepe and launch a new Copilot-backed ACP session without leaving the app.
- A previously created Copilot session appears in Acepe history and can be reopened.
- Reopening a Copilot history item replays the prior conversation into Acepe through ACP rather than depending on local transcript parsing.
- If the user is not logged into Copilot, Acepe shows a clear error that points them to `copilot login`.
- Copilot state remains shared with the user’s existing `~/.copilot` setup.

## Scope Boundaries
- No in-app OAuth or device-flow login orchestration in this feature.
- No reverse-engineered transcript parser for hidden or undocumented Copilot databases.
- No migration of Copilot-managed state into Acepe-managed history files.
- No separate “system-installed Copilot” UX track beyond developer fallback behavior.

## Key Decisions
- Canonical built-in ID: `copilot`
- Display name: `GitHub Copilot`
- Install model: Acepe-managed download from official GitHub Releases
- State model: shared `~/.copilot`
- History model: ACP-first (`session/list`, `session/load`, `session/resume`)
- Auth model for now: same as current agents, with actionable error guidance instead of in-app login

## Dependencies / Assumptions
- Copilot CLI continues to support ACP server mode via `copilot --acp --stdio`.
- Copilot ACP continues to expose `session/list` and `session/load` or `session/resume` for prior sessions.
- Official release assets remain directly downloadable per platform.
- Official release checksums remain published in a machine-readable `SHA256SUMS.txt` asset.

## Outstanding Questions

### Deferred to Planning
- [Affects R15][Technical] How Acepe should cache ACP `session/list` results so startup remains fast without creating stale history.
- [Affects R16][Technical] What the cleanest backend path is for replaying Copilot history into `ConvertedSession` without over-coupling history loading to the live panel client loop.
- [Affects R18][Technical] Whether `workspace.yaml` should be parsed only for project/worktree enrichment or also used as a fallback discovery source when ACP list support is unavailable.
- [Affects R6][Technical] Whether checksum verification should be implemented as a Copilot-specific install path or as a generic improvement for all GitHub-release-backed agents.

## Next Steps
- Write the implementation plan with exact ACP, history, installer, and frontend file changes.