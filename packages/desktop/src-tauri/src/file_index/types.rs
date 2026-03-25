//! Types for the file index system.

use serde::{Deserialize, Serialize};

/// Git status for a single file.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileGitStatus {
    /// Relative path from project root.
    pub path: String,
    /// Status code: M=Modified, A=Added, D=Deleted, ?=Untracked, R=Renamed.
    pub status: String,
    /// Lines added (for modified/added files).
    pub insertions: u64,
    /// Lines deleted (for modified/deleted files).
    pub deletions: u64,
}

/// Lightweight git overview for project cards and other summary UIs.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitOverview {
    /// Current branch name, if available.
    pub branch: Option<String>,
    /// Summary git status entries (may omit expensive/untracked paths in safe mode).
    pub git_status: Vec<FileGitStatus>,
}

/// Information about a single indexed file.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IndexedFile {
    /// Relative path from project root.
    pub path: String,
    /// File extension without dot, empty for no extension.
    pub extension: String,
    /// Number of lines in the file.
    pub line_count: u64,
    /// Git status info if file is modified/added/deleted, or None.
    pub git_status: Option<FileGitStatus>,
}

/// Complete project index result.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIndex {
    /// Project root path.
    pub project_path: String,
    /// All indexed files.
    pub files: Vec<IndexedFile>,
    /// Git-tracked modified files with status.
    pub git_status: Vec<FileGitStatus>,
    /// Total file count.
    pub total_files: u64,
    /// Total line count across all files.
    pub total_lines: u64,
}

/// Search request for the file explorer modal.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileExplorerSearchRequest {
    /// Absolute path to the project root.
    pub project_path: String,
    /// Search query string (empty returns all files ranked by modification / path).
    pub query: String,
    /// Maximum number of rows to return. Clamped to [1, 200].
    pub limit: u32,
    /// Row offset for pagination. Clamped to [0, 10000].
    pub offset: u32,
    /// Optional owning panel id for analytics/logging.
    pub owner_panel_id: Option<String>,
}

/// What kind of preview the frontend should render for a result row.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum PreviewKind {
    /// Changed text file — Pierre diff is safe to render.
    Diff,
    /// Unchanged text file — Pierre read-view is safe to render.
    Text,
    /// Detected as binary content.
    Binary,
    /// File exceeds safe preview size.
    Large,
    /// File has been deleted from the working tree.
    Deleted,
    /// Unsupported content type for preview.
    Unsupported,
}

/// A single row in the file explorer results list.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileExplorerRow {
    /// Absolute path to the owning project root.
    pub project_path: String,
    /// Relative path from project root.
    pub path: String,
    /// Basename of the file.
    pub file_name: String,
    /// File extension without dot, empty for no extension.
    pub extension: String,
    /// Path split into segments for breadcrumb display.
    pub path_segments: Vec<String>,
    /// Git status if the file has been modified/added/deleted/etc.
    pub git_status: Option<FileGitStatus>,
    /// Whether the file is tracked by git.
    pub is_tracked: bool,
    /// Whether the file appears to be binary content.
    pub is_binary: bool,
    /// File last-modified time in milliseconds since Unix epoch, if available.
    pub last_modified_ms: Option<i64>,
    /// File size in bytes, if available.
    pub size_bytes: Option<u64>,
    /// Classification hint for the preview pane.
    pub preview_kind: PreviewKind,
}

/// Response from the explorer search command.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileExplorerSearchResponse {
    /// Project path echoed back.
    pub project_path: String,
    /// Query echoed back.
    pub query: String,
    /// Total number of matching rows before limiting/offsetting.
    pub total: u64,
    /// Ranked result rows for this page.
    pub rows: Vec<FileExplorerRow>,
}

/// Request for a file preview payload.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileExplorerPreviewRequest {
    /// Absolute path to the project root.
    pub project_path: String,
    /// Relative path to the file within the project.
    pub file_path: String,
}

/// Preview payload returned for a selected explorer row.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum FileExplorerPreviewResponse {
    /// Changed text file with diff content.
    Diff {
        file_path: String,
        file_name: String,
        old_content: Option<String>,
        new_content: String,
        git_status: FileGitStatus,
    },
    /// Unchanged text file with full content.
    Text {
        file_path: String,
        file_name: String,
        content: String,
        language_hint: Option<String>,
    },
    /// Fallback for binary, too-large, deleted, or unsupported files.
    Fallback {
        file_path: String,
        file_name: String,
        reason: String,
        size_bytes: Option<u64>,
        git_status: Option<FileGitStatus>,
        preview_kind: PreviewKind,
    },
}

/// Result for file diff comparison (old vs new content).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileDiffResult {
    /// Old content from HEAD (None if new file).
    pub old_content: Option<String>,
    /// New content from working directory.
    pub new_content: String,
    /// File name (basename).
    pub file_name: String,
}
