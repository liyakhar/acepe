//! Unified git-diff edit normalization.
//!
//! Some agents (notably certain Claude Code variants) emit edit tool
//! arguments as `{ "diff": "<unified-git-diff>", "fileName": "..." }` with
//! the full change encoded as a standard `diff --git` / `--- / +++` / `@@`
//! patch. This module normalizes those payloads into the canonical
//! `ToolArguments::Edit` shape.

use crate::acp::session_update::{EditEntry, ToolArguments};

use super::patch_text::parse_file_diff_section;

pub(crate) fn parse_git_diff_edit(raw_arguments: &serde_json::Value) -> Option<ToolArguments> {
    let diff_text = raw_arguments
        .get("diff")
        .and_then(|value| value.as_str())?
        .trim();

    if diff_text.is_empty() {
        return None;
    }

    // Must look like a unified diff.
    if !diff_text.contains("@@") && !diff_text.contains("--- ") {
        return None;
    }

    let fallback_path = raw_arguments
        .get("fileName")
        .or_else(|| raw_arguments.get("file_name"))
        .or_else(|| raw_arguments.get("filePath"))
        .or_else(|| raw_arguments.get("file_path"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let file_chunks = split_file_chunks(diff_text);
    let edits: Vec<EditEntry> = file_chunks
        .iter()
        .filter_map(|chunk| parse_file_chunk(chunk, fallback_path.as_deref()))
        .collect();

    if edits.is_empty() {
        return None;
    }

    Some(ToolArguments::Edit { edits })
}

fn split_file_chunks(diff_text: &str) -> Vec<String> {
    let mut chunks: Vec<String> = Vec::new();
    let mut current: Vec<&str> = Vec::new();

    for line in diff_text.lines() {
        if line.starts_with("diff --git ") && !current.is_empty() {
            chunks.push(current.join("\n"));
            current.clear();
        }
        current.push(line);
    }

    if !current.is_empty() {
        chunks.push(current.join("\n"));
    }

    if chunks.is_empty() {
        chunks.push(diff_text.to_string());
    }

    chunks
}

fn parse_file_chunk(chunk: &str, fallback_path: Option<&str>) -> Option<EditEntry> {
    let mut old_path_raw: Option<&str> = None;
    let mut new_path_raw: Option<&str> = None;
    let mut hunk_lines: Vec<&str> = Vec::new();
    let mut in_hunk = false;

    for line in chunk.lines() {
        if in_hunk {
            hunk_lines.push(line);
            continue;
        }
        if line.starts_with("@@") {
            in_hunk = true;
            hunk_lines.push(line);
            continue;
        }
        if let Some(rest) = line.strip_prefix("--- ") {
            old_path_raw = Some(rest);
            continue;
        }
        if let Some(rest) = line.strip_prefix("+++ ") {
            new_path_raw = Some(rest);
            continue;
        }
        // Other header lines (diff --git, index, mode, similarity, rename,
        // new file mode, deleted file mode, create file mode) are ignored.
    }

    let is_create = matches!(normalize_path_raw(old_path_raw), Some(ref p) if p == "/dev/null");
    let is_delete = matches!(normalize_path_raw(new_path_raw), Some(ref p) if p == "/dev/null");

    let new_file_path = resolve_path(new_path_raw);
    let old_file_path = resolve_path(old_path_raw);

    let file_path = new_file_path
        .or(old_file_path)
        .or_else(|| fallback_path.map(str::to_string));

    if hunk_lines.is_empty() && file_path.is_none() {
        return None;
    }

    let hunk_text = hunk_lines.join("\n");
    let mut entry = parse_file_diff_section(file_path.as_deref().unwrap_or(""), &hunk_text);
    entry.file_path = file_path;

    if is_create {
        entry.old_string = None;
    }
    if is_delete {
        entry.new_string = None;
        entry.content = None;
    }

    Some(entry)
}

fn normalize_path_raw(raw: Option<&str>) -> Option<String> {
    let raw = raw?;
    // Git diffs may append a tab-separated timestamp to the path.
    let without_tab = raw.split('\t').next().unwrap_or(raw).trim();
    if without_tab.is_empty() {
        return None;
    }
    Some(without_tab.to_string())
}

fn resolve_path(raw: Option<&str>) -> Option<String> {
    let normalized = normalize_path_raw(raw)?;
    if normalized == "/dev/null" {
        return None;
    }
    let stripped = normalized
        .strip_prefix("a/")
        .or_else(|| normalized.strip_prefix("b/"))
        .map(str::to_string)
        .unwrap_or(normalized);
    Some(stripped)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_claude_code_create_file_diff_payload() {
        // Shape observed in the wild from Claude Code edit permission payloads
        // (session 2db3b7c7-ba3b-4e4d-b757-abff325987b6).
        let diff = "\ndiff --git a/Users/alex/Documents/sandbox/fib-c/test_fib.c b/Users/alex/Documents/sandbox/fib-c/test_fib.c\ncreate file mode 100644\nindex 0000000..0000000\n--- a/dev/null\n+++ b/Users/alex/Documents/sandbox/fib-c/test_fib.c\n@@ -1,0 +1,3 @@\n+#include <stdio.h>\n+int main(void) { return 0; }\n+\n";

        let raw = serde_json::json!({
            "diff": diff,
            "fileName": "/Users/alex/Documents/sandbox/fib-c/test_fib.c",
        });

        let result = parse_git_diff_edit(&raw).expect("should parse git diff edit payload");

        match result {
            ToolArguments::Edit { edits } => {
                assert_eq!(edits.len(), 1);
                assert_eq!(
                    edits[0].file_path.as_deref(),
                    Some("Users/alex/Documents/sandbox/fib-c/test_fib.c")
                );
                assert_eq!(edits[0].old_string, None, "create file has no old content");
                assert_eq!(
                    edits[0].new_string.as_deref(),
                    Some("#include <stdio.h>\nint main(void) { return 0; }\n")
                );
                assert_eq!(
                    edits[0].content.as_deref(),
                    Some("#include <stdio.h>\nint main(void) { return 0; }\n")
                );
            }
            other => panic!("Expected Edit, got {other:?}"),
        }
    }

    #[test]
    fn parses_update_diff_with_old_and_new_lines() {
        let diff = "diff --git a/src/foo.ts b/src/foo.ts\nindex 1111111..2222222 100644\n--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1,3 +1,3 @@\n export const a = 1;\n-export const b = 2;\n+export const b = 3;\n export const c = 4;\n";

        let raw = serde_json::json!({ "diff": diff });
        let result = parse_git_diff_edit(&raw).expect("should parse update diff");

        match result {
            ToolArguments::Edit { edits } => {
                assert_eq!(edits.len(), 1);
                assert_eq!(edits[0].file_path.as_deref(), Some("src/foo.ts"));
                assert_eq!(
                    edits[0].old_string.as_deref(),
                    Some("export const a = 1;\nexport const b = 2;\nexport const c = 4;")
                );
                assert_eq!(
                    edits[0].new_string.as_deref(),
                    Some("export const a = 1;\nexport const b = 3;\nexport const c = 4;")
                );
            }
            other => panic!("Expected Edit, got {other:?}"),
        }
    }

    #[test]
    fn parses_delete_diff() {
        let diff = "diff --git a/src/old.ts b/src/old.ts\ndeleted file mode 100644\n--- a/src/old.ts\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-export const a = 1;\n-export const b = 2;\n";

        let raw = serde_json::json!({ "diff": diff });
        let result = parse_git_diff_edit(&raw).expect("should parse delete diff");

        match result {
            ToolArguments::Edit { edits } => {
                assert_eq!(edits.len(), 1);
                assert_eq!(edits[0].file_path.as_deref(), Some("src/old.ts"));
                assert_eq!(
                    edits[0].old_string.as_deref(),
                    Some("export const a = 1;\nexport const b = 2;")
                );
                assert_eq!(edits[0].new_string, None);
                assert_eq!(edits[0].content, None);
            }
            other => panic!("Expected Edit, got {other:?}"),
        }
    }

    #[test]
    fn parses_multi_file_git_diff() {
        let diff = "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old a\n+new a\ndiff --git a/src/b.ts b/src/b.ts\n--- a/src/b.ts\n+++ b/src/b.ts\n@@ -1 +1 @@\n-old b\n+new b\n";

        let raw = serde_json::json!({ "diff": diff });
        let result = parse_git_diff_edit(&raw).expect("should parse multi file git diff");

        match result {
            ToolArguments::Edit { edits } => {
                assert_eq!(edits.len(), 2);
                assert_eq!(edits[0].file_path.as_deref(), Some("src/a.ts"));
                assert_eq!(edits[0].old_string.as_deref(), Some("old a"));
                assert_eq!(edits[0].new_string.as_deref(), Some("new a"));
                assert_eq!(edits[1].file_path.as_deref(), Some("src/b.ts"));
                assert_eq!(edits[1].old_string.as_deref(), Some("old b"));
                assert_eq!(edits[1].new_string.as_deref(), Some("new b"));
            }
            other => panic!("Expected Edit, got {other:?}"),
        }
    }

    #[test]
    fn falls_back_to_file_name_when_headers_missing() {
        // Minimal unified diff with only `@@` and `+` lines, no `---`/`+++`.
        let diff = "@@ -1,0 +1,2 @@\n+hello\n+world\n";

        let raw = serde_json::json!({
            "diff": diff,
            "fileName": "/tmp/foo.txt",
        });
        let result = parse_git_diff_edit(&raw).expect("should fall back to fileName");

        match result {
            ToolArguments::Edit { edits } => {
                assert_eq!(edits.len(), 1);
                assert_eq!(edits[0].file_path.as_deref(), Some("/tmp/foo.txt"));
                assert_eq!(edits[0].new_string.as_deref(), Some("hello\nworld"));
            }
            other => panic!("Expected Edit, got {other:?}"),
        }
    }

    #[test]
    fn returns_none_when_diff_key_absent() {
        let raw = serde_json::json!({ "fileName": "/tmp/foo.txt" });
        assert!(parse_git_diff_edit(&raw).is_none());
    }

    #[test]
    fn returns_none_when_diff_is_not_unified_format() {
        let raw = serde_json::json!({ "diff": "just a plain string, no hunk markers" });
        assert!(parse_git_diff_edit(&raw).is_none());
    }

    #[test]
    fn returns_none_when_diff_is_empty_string() {
        let raw = serde_json::json!({ "diff": "" });
        assert!(parse_git_diff_edit(&raw).is_none());
    }
}
