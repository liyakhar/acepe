//! Shared invocation enrichment helpers.
//!
//! These helpers recover extra tool-call context from provider payload hints
//! without overwriting explicit arguments already present in the canonical raw input.

use crate::acp::parsers::acp_fields;
use crate::acp::session_update::ToolKind;

fn parsed_cmd_entries(value: &serde_json::Value) -> Option<&Vec<serde_json::Value>> {
    value.get("parsed_cmd")?.as_array()
}

fn parsed_cmd_type_matches(entry: &serde_json::Value, allowed_types: &[&str]) -> bool {
    entry
        .get("type")
        .and_then(|value| value.as_str())
        .map(|value| value.to_ascii_lowercase())
        .is_some_and(|value| allowed_types.iter().any(|allowed| *allowed == value))
}

pub(crate) fn parse_parsed_cmd_path(
    value: &serde_json::Value,
    allowed_types: &[&str],
) -> Option<String> {
    let entries = parsed_cmd_entries(value)?;
    for entry in entries {
        if !parsed_cmd_type_matches(entry, allowed_types) {
            continue;
        }
        let path = entry
            .get("path")
            .or_else(|| entry.get("file_path"))
            .or_else(|| entry.get("filePath"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(path) = path {
            return Some(path.to_string());
        }
    }
    None
}

pub(crate) fn parse_parsed_cmd_query(
    value: &serde_json::Value,
    allowed_types: &[&str],
) -> Option<String> {
    let entries = parsed_cmd_entries(value)?;
    for entry in entries {
        if !parsed_cmd_type_matches(entry, allowed_types) {
            continue;
        }
        let query = entry
            .get("query")
            .or_else(|| entry.get("pattern"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(query) = query {
            return Some(query.to_string());
        }
    }
    None
}

pub(crate) fn parse_parsed_cmd_move(
    value: &serde_json::Value,
) -> Option<(Option<String>, Option<String>)> {
    let entries = parsed_cmd_entries(value)?;
    for entry in entries {
        if !parsed_cmd_type_matches(entry, &["move", "mv", "rename"]) {
            continue;
        }
        let from = entry
            .get("from")
            .or_else(|| entry.get("source"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);
        let to = entry
            .get("to")
            .or_else(|| entry.get("destination"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);
        return Some((from, to));
    }
    None
}

pub(crate) fn inject_path_hint(
    raw_arguments: &mut serde_json::Value,
    kind: ToolKind,
    path_hint: &str,
) {
    if acp_fields::FILE_PATH_KEYS.iter().any(|key| {
        raw_arguments
            .get(key)
            .and_then(|value| value.as_str())
            .is_some_and(|value| !value.trim().is_empty())
    }) {
        return;
    }

    let Some(arguments) = raw_arguments.as_object_mut() else {
        return;
    };

    match kind {
        ToolKind::Read | ToolKind::Edit | ToolKind::Delete | ToolKind::Search => {
            arguments.insert(
                "file_path".to_string(),
                serde_json::Value::String(path_hint.to_string()),
            );
        }
        ToolKind::Glob => {
            arguments.insert(
                "path".to_string(),
                serde_json::Value::String(path_hint.to_string()),
            );
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn inject_path_hint_preserves_explicit_file_path() {
        let mut raw_arguments = json!({
            "file_path": "/tmp/explicit.ts"
        });

        inject_path_hint(&mut raw_arguments, ToolKind::Edit, "/tmp/from-hint.ts");

        assert_eq!(raw_arguments["file_path"], "/tmp/explicit.ts");
    }

    #[test]
    fn inject_path_hint_uses_glob_path_key() {
        let mut raw_arguments = json!({
            "pattern": "**/*"
        });

        inject_path_hint(&mut raw_arguments, ToolKind::Glob, "/tmp/project");

        assert_eq!(raw_arguments["path"], "/tmp/project");
    }
}
