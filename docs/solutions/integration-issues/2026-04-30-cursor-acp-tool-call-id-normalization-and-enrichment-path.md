---
title: Normalize Cursor ACP tool-call IDs before canonical operation projection
date: 2026-04-30
category: integration-issues
module: acp/providers/cursor
problem_type: integration_issue
component: assistant
symptoms:
  - Cursor ACP tool calls rendered with orange degraded styling in the Agent Panel
  - Tool call labels showed sparse or raw text with no arguments
  - SessionStateGraph projected operations as degraded with invalid_provenance_key
  - Cursor tool-call enrichment never backfilled arguments from the persisted ACP store
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - tooling
tags:
  - cursor
  - acp
  - tool-call
  - id-normalization
  - provenance-key
  - enrichment
  - agent-panel
  - degraded-state
---

# Normalize Cursor ACP tool-call IDs before canonical operation projection

## Problem

Cursor ACP tool calls were reaching Acepe as structured tool updates, but the Agent Panel rendered them as sparse tool rows with orange degraded labels. The canonical graph correctly rejected the provider's raw operation provenance because Cursor emitted composite tool-call IDs containing a literal newline.

The same sessions also lacked rich tool details because Cursor enrichment did not load the ACP-session SQLite store where Cursor persisted the complete tool arguments.

## Symptoms

- Tool labels rendered orange through `ToolLabel`'s `status === "degraded"` path.
- `acp_get_session_state` showed operations with `operation_state: "degraded"` and `degradation_reason.code: "invalid_provenance_key"`.
- Live streaming logs had structured tool calls like `title: "Find"`, `kind: "search"`, and `rawInput: {}`, but their `toolCallId` values contained a literal newline: `call_...\nfc_...`.
- Persisted Cursor ACP store entries under `~/.cursor/acp-sessions/<session-id>/store.db` had the missing rich args, such as `glob_pattern` and `target_directory`.
- The copied/exported transcript still showed generic `## Tool: Find` / `## Tool: grep` rows because the live payloads lacked arguments to format.

## What Didn't Work

- Treating the orange UI as a design-system color bug. The color was a correct presentation of canonical `operation_state: degraded`.
- Adding UI fallbacks for tool details. That would have hidden a canonical provenance failure and violated the rule that provider quirks stop at the adapter/parser boundary.
- Looking only in `~/.cursor/chats/<project-hash>/<session-id>/store.db`. Acepe-launched Cursor ACP sessions persist under `~/.cursor/acp-sessions/<session-id>/store.db`.
- Indexing persisted tool uses by raw provider ID while live updates used canonical-safe IDs. Even after finding the right store, raw `call_...\nfc_...` and normalized `call_...%0Afc_...` keys would not match.

## Solution

Normalize provider tool-call IDs before they become canonical operation provenance, and make Cursor enrichment search the ACP-session store layout before the legacy chat layout.

`extract_tool_call_id` now applies one normalization function at the ACP field boundary:

```rust
pub fn extract_tool_call_id(data: &serde_json::Value) -> Result<String, ParseError> {
    data.get(TOOL_CALL_ID)
        .or_else(|| data.get(ID))
        .or_else(|| data.get(TOOL_USE_ID))
        .and_then(|v| v.as_str())
        .map(normalize_tool_call_id)
        .ok_or_else(|| ParseError::MissingField("toolCallId, id, or tool_use_id".to_string()))
}

pub fn normalize_tool_call_id(raw_id: &str) -> String {
    let mut normalized = String::with_capacity(raw_id.len());
    for character in raw_id.chars() {
        if character == '%' {
            normalized.push_str("%25");
            continue;
        }
        if character.is_control() {
            let mut buffer = [0_u8; 4];
            for byte in character.encode_utf8(&mut buffer).as_bytes() {
                normalized.push('%');
                normalized.push_str(&format!("{byte:02X}"));
            }
            continue;
        }
        normalized.push(character);
    }
    normalized
}
```

The persisted Cursor tool-use index uses the same normalization helper:

```rust
if let ContentBlock::ToolUse { id, name, input } = block {
    index.insert(
        normalize_tool_call_id(id),
        PersistedToolUse {
            name: name.clone(),
            input: input.clone(),
        },
    );
}
```

Cursor store lookup now prefers the ACP-session layout and falls back to interactive chat history:

```rust
pub(super) async fn find_cursor_store_db_for_session(
    chats_dir: &Path,
    acp_sessions_dir: &Path,
    session_id: &str,
) -> Result<Option<PathBuf>> {
    if let Some(store_db) =
        find_acp_sessions_store_db_for_session(acp_sessions_dir, session_id).await?
    {
        return Ok(Some(store_db));
    }

    find_sqlite_store_db_for_session(chats_dir, session_id).await
}
```

Regression coverage should prove all three contracts:

- Cursor `tool_call` and `tool_call_update` with `call_...\nfc_...` normalize to the same `%0A` key.
- Persisted Cursor tool-use IDs are indexed by the normalized ID, so live updates recover stored `Glob` arguments.
- `get_sqlite_store_db_path_for_session` prefers `~/.cursor/acp-sessions/<session-id>/store.db` over the legacy `~/.cursor/chats` layout.

## Why This Works

The bug was a two-part integration failure:

1. Cursor emitted a valid provider-local composite ID that was not valid canonical operation provenance because it contained a control character.
2. Acepe looked for enrichment data in the wrong Cursor storage layout, and even the correct store used the raw provider ID.

Normalizing at `extract_tool_call_id` keeps the canonical graph strict while making provider IDs printable and delimiter-safe before projection. Applying the same helper to persisted Cursor tool-use IDs makes live updates and stored arguments join on one deterministic key.

Searching `~/.cursor/acp-sessions` first restores the missing enrichment source for Acepe-launched Cursor ACP sessions. Once the store is found and IDs match, the Agent Panel receives rich typed arguments instead of empty `rawInput`, and the canonical operation no longer degrades because of an invalid provenance key.

## Prevention

- Normalize provider-owned IDs at the Rust parser/adapter boundary, before they enter `SessionStateGraph` or any canonical provenance key.
- Do not fix provider ID quirks in the TypeScript UI. Orange/degraded labels are a canonical signal, not a styling fallback to override.
- Keep one normalization function shared by live parse paths and persisted-history enrichment. Separate lookup-time normalizers will drift.
- Test provider storage layouts explicitly. Cursor ACP sessions use `~/.cursor/acp-sessions/<session-id>/store.db`; interactive Cursor chats use `~/.cursor/chats/<project-hash>/<session-id>/store.db`.
- When tool rows are sparse and degraded, inspect both sides of the join: whether the provider store was found and whether the live tool-call ID matches the persisted tool-use ID after normalization.

## Related Issues

- `docs/solutions/architectural/final-god-architecture-2026-04-25.md` - parent GOD rule: provider quirks stop at adapter edges; canonical operation provenance stays strict.
- `docs/solutions/best-practices/deterministic-tool-call-reconciler-2026-04-18.md` - related provider-boundary rule for tool classification and argument-shape enrichment.
- `docs/solutions/architectural/revisioned-session-graph-authority-2026-04-20.md` - canonical graph authority and per-provider provenance-key stability.
- `docs/solutions/logic-errors/operation-interaction-association-2026-04-07.md` - transport IDs are adapter metadata; do not fake transcript-operation joins by tool-call ID.
