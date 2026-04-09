use super::{ChunkAggregationHint, ContentChunk};
use crate::acp::types::ContentBlock;

fn deserialize_chunk_hint<E>(data: &serde_json::Value) -> Result<Option<ChunkAggregationHint>, E>
where
    E: serde::de::Error,
{
    match data.get("aggregationHint") {
        Some(hint) => serde_json::from_value(hint.clone())
            .map(Some)
            .map_err(serde::de::Error::custom),
        None => Ok(None),
    }
}

pub(crate) fn deserialize_content_chunk<E>(data: &serde_json::Value) -> Result<ContentChunk, E>
where
    E: serde::de::Error,
{
    // Try direct format first: { content: ContentBlock }
    if let Some(content) = data.get("content") {
        let content_block: ContentBlock =
            serde_json::from_value(content.clone()).map_err(serde::de::Error::custom)?;
        let aggregation_hint = deserialize_chunk_hint(data)?;
        return Ok(ContentChunk {
            content: content_block,
            aggregation_hint,
        });
    }

    // Try nested format: { chunk: { content: ContentBlock } }
    if let Some(chunk) = data.get("chunk") {
        if let Some(content) = chunk.get("content") {
            let content_block: ContentBlock =
                serde_json::from_value(content.clone()).map_err(serde::de::Error::custom)?;
            let aggregation_hint = deserialize_chunk_hint(chunk)?;
            return Ok(ContentChunk {
                content: content_block,
                aggregation_hint,
            });
        }
    }

    Err(serde::de::Error::custom("Invalid content chunk format"))
}
