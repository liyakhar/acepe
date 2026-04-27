use crate::commands::observability::{unexpected_command_result, CommandResult};
use std::cmp::Reverse;
use std::path::Path;

use super::*;

fn indexed_source_path(file_path: String) -> Option<String> {
    SessionMetadataRepository::normalized_source_path(&file_path)
}

fn derive_title_from_converted_session(
    session: &crate::acp::session_thread_snapshot::SessionThreadSnapshot,
) -> Option<String> {
    for entry in &session.entries {
        if let crate::session_jsonl::types::StoredEntry::User { message, .. } = entry {
            let text = message
                .chunks
                .iter()
                .filter(|block| block.block_type == "text")
                .filter_map(|block| block.text.as_deref())
                .collect::<Vec<_>>()
                .join("\n");
            if !text.is_empty() {
                return crate::history::title_utils::derive_session_title(&text, 100);
            }
        }
    }

    None
}

fn resolve_indexed_session_title(
    session_id: &str,
    display: &str,
    title_overridden: bool,
    session: Option<&crate::acp::session_thread_snapshot::SessionThreadSnapshot>,
) -> String {
    if title_overridden {
        return display.to_string();
    }

    if let Some(session) = session {
        if let Some(title) = derive_title_from_converted_session(session) {
            return title;
        }
        if !session.title.trim().is_empty() {
            return session.title.clone();
        }
    }

    crate::history::title_utils::derive_session_title(display, 100)
        .unwrap_or_else(|| session_id[..8.min(session_id.len())].to_string())
}

fn derive_indexed_session_title(session_id: &str, display: &str, title_overridden: bool) -> String {
    resolve_indexed_session_title(session_id, display, title_overridden, None)
}

fn copilot_session_to_history_entry(
    session: crate::copilot_history::CopilotListedSession,
) -> HistoryEntry {
    HistoryEntry {
        id: session.session_id.clone(),
        display: session.title,
        timestamp: session.updated_at_ms,
        project: session.project_path,
        session_id: session.session_id.clone(),
        pasted_contents: serde_json::json!({}),
        agent_id: CanonicalAgentId::Copilot,
        updated_at: session.updated_at_ms,
        source_path: Some(crate::copilot_history::missing_transcript_marker(
            &session.session_id,
        )),
        parent_id: None,
        worktree_path: session.worktree_path,
        pr_number: None,
        pr_link_mode: None,
        worktree_deleted: None,
        session_lifecycle_state: Some(SessionLifecycleState::Persisted),
        sequence_id: None,
    }
}

fn filter_hidden_external_file_scan_entries(
    mut entries: Vec<HistoryEntry>,
    external_hidden_paths: &std::collections::HashSet<String>,
) -> Vec<HistoryEntry> {
    if external_hidden_paths.is_empty() {
        return entries;
    }

    entries.retain(|entry| !external_hidden_paths.contains(&entry.project));
    entries
}

#[tauri::command]
#[specta::specta]
pub async fn scan_project_sessions(
    app: AppHandle,
    project_paths: Vec<String>,
) -> CommandResult<Vec<HistoryEntry>> {
    unexpected_command_result(
        "scan_project_sessions",
        "Failed to scan project sessions",
        async {
            let db = app.try_state::<DbConn>().map(|s| s.inner().clone());
            let mut sorted = project_paths.clone();
            sorted.sort();
            let key = format!("scan:{}", sorted.join("|"));

            SCAN_CACHE
                .get_or_fetch(key, || async {
                    scan_project_sessions_inner(project_paths, db).await
                })
                .await
        }
        .await,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn get_startup_sessions(
    app: AppHandle,
    session_ids: Vec<String>,
) -> CommandResult<crate::session_jsonl::types::StartupSessionsResponse> {
    unexpected_command_result(
        "get_startup_sessions",
        "Failed to get startup sessions",
        async {
            let db = app
                .try_state::<DbConn>()
                .map(|state| state.inner().clone())
                .ok_or_else(|| "No DbConn available".to_string())?;

            let mut indexed = SessionMetadataRepository::get_for_session_ids(&db, &session_ids)
                .await
                .map_err(|error| format!("Failed to load startup session metadata: {error}"))?;

            // Build the ordering map keyed by requested session ID -> original position.
            let startup_order: std::collections::HashMap<String, usize> = session_ids
                .into_iter()
                .enumerate()
                .map(|(index, session_id)| (session_id, index))
                .collect();

            indexed.sort_by_key(|row| startup_order.get(&row.id).copied().unwrap_or(usize::MAX));

            let alias_remaps = std::collections::HashMap::new();

            let mut entries: Vec<HistoryEntry> = Vec::with_capacity(indexed.len());
            for session in indexed {
                let session_lifecycle_state = session.lifecycle_state();
                let worktree_deleted = session
                    .worktree_path
                    .as_ref()
                    .map(|path| !Path::new(path).exists());
                entries.push(HistoryEntry {
                    id: session.id.clone(),
                    display: session.display,
                    timestamp: session.timestamp,
                    project: session.project_path,
                    session_id: session.id,
                    pasted_contents: serde_json::json!({}),
                    agent_id: CanonicalAgentId::parse(&session.agent_id),
                    updated_at: session.timestamp,
                    source_path: indexed_source_path(session.file_path),
                    parent_id: None,
                    worktree_path: session.worktree_path,
                    worktree_deleted,
                    pr_number: session.pr_number.map(|number| number as i64),
                    pr_link_mode: session.pr_link_mode,
                    session_lifecycle_state: Some(session_lifecycle_state),
                    sequence_id: session.sequence_id,
                });
            }

            Ok(crate::session_jsonl::types::StartupSessionsResponse {
                entries,
                alias_remaps,
            })
        }
        .await,
    )
}

fn merge_history_entries_by_id(
    mut primary: Vec<HistoryEntry>,
    secondary: Vec<HistoryEntry>,
) -> Vec<HistoryEntry> {
    let mut seen = primary
        .iter()
        .map(|entry| entry.id.clone())
        .collect::<std::collections::HashSet<_>>();
    for entry in secondary {
        if seen.insert(entry.id.clone()) {
            primary.push(entry);
        }
    }
    primary
}

async fn scan_copilot_history_entries(
    project_paths: &[String],
) -> Result<Vec<HistoryEntry>, String> {
    crate::copilot_history::list_workspace_sessions(project_paths)
        .await
        .map(|sessions| {
            sessions
                .into_iter()
                .map(copilot_session_to_history_entry)
                .collect()
        })
}

async fn scan_project_sessions_inner(
    project_paths: Vec<String>,
    db: Option<DbConn>,
) -> Result<Vec<HistoryEntry>, String> {
    let scan_start = Instant::now();
    let external_hidden_paths = match &db {
        Some(db) => {
            crate::history::visibility::load_external_hidden_paths_or_empty(
                db,
                &project_paths,
                "scan_project_sessions",
            )
            .await
        }
        None => std::collections::HashSet::new(),
    };

    // Try SQLite index for ALL agents (fast path: ~10-50ms)
    let from_index = match &db {
        Some(db) => {
            let idx_start = Instant::now();
            let result = SessionMetadataRepository::get_for_projects(
                db,
                &project_paths,
                &external_hidden_paths,
            )
            .await;
            let idx_ms = idx_start.elapsed().as_millis();
            match &result {
                Ok(lookup) => tracing::info!(
                    elapsed_ms = idx_ms,
                    count = lookup.entries.len(),
                    db_row_count = lookup.db_row_count,
                    "SQLite index query completed"
                ),
                Err(e) => tracing::warn!(
                    elapsed_ms = idx_ms,
                    error = %e,
                    "SQLite index query failed"
                ),
            }
            match result.ok() {
                Some(lookup) if lookup.db_row_count > 0 => Some(lookup.entries),
                _ => None,
            }
        }
        None => {
            tracing::warn!("No DbConn available — skipping index fast path");
            None
        }
    };

    if let Some(indexed) = from_index {
        let count = indexed.len();
        // DB already returns ORDER BY timestamp DESC — no sort needed
        let mut entries: Vec<HistoryEntry> = Vec::with_capacity(count);
        for s in indexed {
            let session_lifecycle_state = s.lifecycle_state();
            let display = derive_indexed_session_title(&s.id, &s.display, s.title_overridden);
            let worktree_deleted = s
                .worktree_path
                .as_ref()
                .map(|path| !Path::new(path).exists());
            entries.push(HistoryEntry {
                id: s.id.clone(),
                display,
                timestamp: s.timestamp,
                project: s.project_path,
                session_id: s.id,
                pasted_contents: serde_json::json!({}),
                agent_id: CanonicalAgentId::parse(&s.agent_id),
                updated_at: s.timestamp,
                source_path: indexed_source_path(s.file_path),
                parent_id: None,
                worktree_path: s.worktree_path,
                worktree_deleted,
                pr_number: s.pr_number.map(|n| n as i64),
                pr_link_mode: s.pr_link_mode,
                session_lifecycle_state: Some(session_lifecycle_state),
                sequence_id: s.sequence_id,
            });
        }
        match scan_copilot_history_entries(&project_paths).await {
            Ok(copilot_entries) => {
                entries = merge_history_entries_by_id(entries, copilot_entries);
            }
            Err(error) => {
                tracing::warn!(error = %error, "Copilot scanner failed while supplementing index");
            }
        }
        entries.sort_by_key(|entry| std::cmp::Reverse(entry.timestamp));
        tracing::info!(
            total_entries = entries.len(),
            index_entries = count,
            total_ms = scan_start.elapsed().as_millis(),
            source = "index",
            "Session scan complete (from index)"
        );
        return Ok(entries);
    }

    // Index empty — full scan all agents in parallel
    tracing::info!("SQLite index empty, falling back to file scan");
    let file_scan_start = Instant::now();

    // tokio::join! polls on the same task (no Send required), so we share the slice
    let (claude_result, cursor_result, opencode_result, codex_result, copilot_result) = tokio::join!(
        session_jsonl_parser::scan_projects(&project_paths),
        cursor_parser::discover_all_chats(&project_paths),
        opencode_parser::scan_sessions(&project_paths),
        codex_scanner::scan_sessions(&project_paths),
        scan_copilot_history_entries(&project_paths),
    );

    let file_scan_ms = file_scan_start.elapsed().as_millis();
    let mut entries = Vec::new();

    let claude_count = match claude_result {
        Ok(claude_entries) => {
            let count = claude_entries.len();
            entries.extend(claude_entries);
            count
        }
        Err(e) => {
            tracing::warn!(error = %e, "Claude scanner failed");
            0
        }
    };

    let cursor_count = match cursor_result {
        Ok(cursor_entries) => {
            let count = cursor_entries.len();
            entries.extend(cursor_entries.iter().map(cursor_parser::to_history_entry));
            count
        }
        Err(e) => {
            tracing::warn!(error = %e, "Cursor scanner failed");
            0
        }
    };

    let opencode_count = match opencode_result {
        Ok(opencode_entries) => {
            let count = opencode_entries.len();
            entries.extend(opencode_entries);
            count
        }
        Err(e) => {
            tracing::warn!(error = %e, "OpenCode scanner failed");
            0
        }
    };

    let codex_count = match codex_result {
        Ok(codex_entries) => {
            let count = codex_entries.len();
            entries.extend(codex_entries);
            count
        }
        Err(e) => {
            tracing::warn!(error = %e, "Codex scanner failed");
            0
        }
    };

    let copilot_count = match copilot_result {
        Ok(copilot_entries) => {
            let count = copilot_entries.len();
            entries.extend(copilot_entries);
            count
        }
        Err(e) => {
            tracing::warn!(error = %e, "Copilot scanner failed");
            0
        }
    };

    entries = filter_hidden_external_file_scan_entries(entries, &external_hidden_paths);

    tracing::info!(
        claude_count,
        cursor_count,
        opencode_count,
        codex_count,
        copilot_count,
        total_entries = entries.len(),
        file_scan_ms,
        total_ms = scan_start.elapsed().as_millis(),
        source = "files",
        "Session scan complete (from file scan)"
    );

    entries.sort_by_key(|entry| std::cmp::Reverse(entry.timestamp));

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::{
        copilot_session_to_history_entry, derive_indexed_session_title,
        derive_title_from_converted_session, filter_hidden_external_file_scan_entries,
        indexed_source_path, merge_history_entries_by_id, resolve_indexed_session_title,
    };
    use crate::acp::session_thread_snapshot::SessionThreadSnapshot;
    use crate::acp::types::CanonicalAgentId;
    use crate::copilot_history::CopilotListedSession;
    use crate::db::repository::{SessionLifecycleState, SessionMetadataRow};
    use crate::session_jsonl::types::HistoryEntry;
    use crate::session_jsonl::types::{StoredContentBlock, StoredEntry, StoredUserMessage};

    fn make_session(title: &str, user_text: &str) -> SessionThreadSnapshot {
        let content = StoredContentBlock {
            block_type: "text".to_string(),
            text: Some(user_text.to_string()),
        };

        SessionThreadSnapshot {
            entries: vec![StoredEntry::User {
                id: "entry-1".to_string(),
                message: StoredUserMessage {
                    id: None,
                    content: content.clone(),
                    chunks: vec![content],
                    sent_at: None,
                },
                timestamp: Some("2026-04-06T00:00:00Z".to_string()),
            }],
            title: title.to_string(),
            created_at: "2026-04-06T00:00:00Z".to_string(),
            current_mode_id: None,
        }
    }

    fn make_history_entry(id: &str, project: &str, agent_id: &str) -> HistoryEntry {
        HistoryEntry {
            id: id.to_string(),
            display: id.to_string(),
            timestamp: 0,
            project: project.to_string(),
            session_id: id.to_string(),
            pasted_contents: serde_json::json!({}),
            agent_id: CanonicalAgentId::parse(agent_id),
            updated_at: 0,
            source_path: Some(format!("/tmp/{id}.jsonl")),
            parent_id: None,
            worktree_path: None,
            pr_number: None,
            pr_link_mode: None,
            worktree_deleted: None,
            session_lifecycle_state: Some(SessionLifecycleState::Persisted),
            sequence_id: None,
        }
    }

    #[test]
    fn test_indexed_source_path_hides_worktree_sentinel() {
        assert_eq!(
            indexed_source_path("__worktree__/ses_legacy".to_string()),
            None
        );
    }

    #[test]
    fn converted_session_title_derivation_works() {
        let converted = make_session("Fallback", "Original transcript title");
        assert_eq!(
            derive_title_from_converted_session(&converted),
            Some("Original transcript title".to_string())
        );
    }

    #[test]
    fn title_override_should_short_circuit_indexed_derivation() {
        let row = SessionMetadataRow {
            id: "session-1".to_string(),
            display: "Design changes".to_string(),
            title_overridden: true,
            timestamp: 0,
            project_path: "/repo".to_string(),
            agent_id: "claude-code".to_string(),
            file_path: "file.jsonl".to_string(),
            file_mtime: 0,
            file_size: 0,
            worktree_path: None,
            pr_number: None,
            pr_link_mode: None,
            is_acepe_managed: false,
            sequence_id: Some(2),
        };

        let converted = make_session("Original transcript title", "Original transcript title");

        assert_eq!(
            resolve_indexed_session_title(
                &row.id,
                &row.display,
                row.title_overridden,
                Some(&converted)
            ),
            "Design changes"
        );
    }

    #[test]
    fn indexed_derivation_prefers_cached_display_without_loading_history() {
        assert_eq!(
            derive_indexed_session_title("session-1", "Ship sidebar instantly", false),
            "Ship sidebar instantly"
        );
    }

    #[test]
    fn file_scan_visibility_hides_external_entries_for_hidden_projects() {
        let entries = vec![
            make_history_entry("cursor-hidden", "/hidden", "cursor"),
            make_history_entry("codex-hidden", "/hidden", "codex"),
            make_history_entry("claude-visible", "/visible", "claude-code"),
        ];
        let hidden_projects = std::collections::HashSet::from([String::from("/hidden")]);

        let filtered = filter_hidden_external_file_scan_entries(entries, &hidden_projects);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, "claude-visible");
        assert_eq!(filtered[0].project, "/visible");
    }

    #[test]
    fn copilot_sessions_convert_to_visible_history_entries() {
        let session = CopilotListedSession {
            session_id: "copilot-session-1".to_string(),
            title: "Review Acepe".to_string(),
            updated_at_ms: 1_777_000_000_000,
            project_path: "/Users/alex/Documents/acepe".to_string(),
            worktree_path: None,
            cwd: "/Users/alex/Documents/acepe".to_string(),
        };

        let entry = copilot_session_to_history_entry(session);

        assert_eq!(entry.id, "copilot-session-1");
        assert_eq!(entry.project, "/Users/alex/Documents/acepe");
        assert_eq!(entry.agent_id, CanonicalAgentId::Copilot);
        assert_eq!(entry.display, "Review Acepe");
        assert_eq!(
            entry.session_lifecycle_state,
            Some(SessionLifecycleState::Persisted)
        );
    }

    #[test]
    fn indexed_entries_can_be_supplemented_with_copilot_file_entries() {
        let indexed = vec![make_history_entry("claude-1", "/repo", "claude-code")];
        let copilot = vec![
            make_history_entry("copilot-1", "/repo", "copilot"),
            make_history_entry("claude-1", "/repo", "copilot"),
        ];

        let merged = merge_history_entries_by_id(indexed, copilot);

        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].id, "claude-1");
        assert_eq!(merged[1].id, "copilot-1");
        assert_eq!(merged[1].agent_id, CanonicalAgentId::Copilot);
    }
}

/// Discover all projects with sessions from all agents.
///
/// Scans Claude Code, Cursor, OpenCode, Codex, and Copilot sources directly without requiring
/// projects to exist in the database first. This resolves the chicken-and-egg
/// problem where the "Open Project" dialog couldn't show sessions because no
/// projects were imported yet.
///
/// Results are cached for 5 seconds and concurrent identical requests coalesce.
///
/// # Returns
/// Vector of history entries sorted by timestamp (most recent first)
#[tauri::command]
#[specta::specta]
pub async fn discover_all_projects_with_sessions() -> CommandResult<Vec<HistoryEntry>> {
    unexpected_command_result(
        "discover_all_projects_with_sessions",
        "Failed to discover projects with sessions",
        async {
            SCAN_CACHE
                .get_or_fetch("discover".to_string(), || async {
                    discover_all_projects_with_sessions_inner().await
                })
                .await
        }
        .await,
    )
}

async fn discover_all_projects_with_sessions_inner() -> Result<Vec<HistoryEntry>, String> {
    // Scan all sources in parallel
    let (claude_result, cursor_result, opencode_result, codex_result, copilot_result) = tokio::join!(
        session_jsonl_parser::scan_all_threads(),
        cursor_parser::discover_all_chats(&[]),
        opencode_parser::scan_sessions(&[]),
        codex_scanner::scan_sessions(&[]),
        crate::copilot_history::list_workspace_sessions(&[]),
    );

    let mut entries = Vec::new();

    // Collect Claude entries
    match claude_result {
        Ok(claude_entries) => entries.extend(claude_entries),
        Err(e) => tracing::warn!(error = %e, "Claude discovery failed"),
    }

    // Collect Cursor entries (need to convert to HistoryEntry)
    match cursor_result {
        Ok(cursor_entries) => {
            entries.extend(cursor_entries.iter().map(cursor_parser::to_history_entry));
        }
        Err(e) => tracing::warn!(error = %e, "Cursor discovery failed"),
    }

    // Collect OpenCode entries
    match opencode_result {
        Ok(opencode_entries) => entries.extend(opencode_entries),
        Err(e) => tracing::warn!(error = %e, "OpenCode discovery failed"),
    }

    // Collect Codex entries
    match codex_result {
        Ok(codex_entries) => entries.extend(codex_entries),
        Err(e) => tracing::warn!(error = %e, "Codex discovery failed"),
    }

    match copilot_result {
        Ok(copilot_entries) => {
            entries.extend(
                copilot_entries
                    .into_iter()
                    .map(copilot_session_to_history_entry),
            );
        }
        Err(e) => tracing::warn!(error = %e, "Copilot discovery failed"),
    }

    // Sort by timestamp descending (most recent first)
    entries.sort_by_key(|entry| Reverse(entry.timestamp));

    Ok(entries)
}
