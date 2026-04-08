//! Codex-specific edit normalization.
//!
//! Codex may emit edits in either:
//! - direct fields (`file_path`, `old_string`, `new_string`, `content`), or
//! - changes map (`changes[path] = { old_content/new_content/... }`).

use crate::acp::parsers::argument_enrichment::{inject_path_hint, parse_parsed_cmd_path};
use crate::acp::parsers::arguments::parse_generic_edit_arguments;
use crate::acp::parsers::edit_normalizers::parse_changes_map_edit;
use crate::acp::session_update::{ToolArguments, ToolKind};

pub(crate) fn parse_edit_arguments(raw_arguments: &serde_json::Value) -> ToolArguments {
    if let Some(arguments_from_changes) = parse_changes_map_edit(raw_arguments) {
        return arguments_from_changes;
    }

    let mut enriched_arguments = raw_arguments.clone();
    let parsed_cmd_path = parse_parsed_cmd_path(
        raw_arguments,
        &["edit", "write", "multi_edit", "multiedit", "apply_patch"],
    );
    if let Some(path_hint) = parsed_cmd_path.as_deref() {
        inject_path_hint(&mut enriched_arguments, ToolKind::Edit, path_hint);
    }

    parse_generic_edit_arguments(&enriched_arguments)
}
