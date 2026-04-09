use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ChunkAggregationHint {
    BoundaryCarryover,
}

/// ContentChunk represents a chunk of content being streamed.
///
/// This handles both direct format `{ content: ContentBlock }`
/// and nested format `{ chunk: { content: ContentBlock } }`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentChunk {
    pub content: crate::acp::types::ContentBlock,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aggregation_hint: Option<ChunkAggregationHint>,
}
