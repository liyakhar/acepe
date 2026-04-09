/**
 * Pure function for normalizing chunk content.
 *
 * Strips redundant thought prefixes from explicit thought chunks.
 */

import type { ContentBlock } from "../../services/converted-session-types.js";
import { stripThoughtPrefix } from "../utils/thought-prefix-stripper.js";
import type { ChunkInput, NormalizedChunk } from "./chunk-aggregation-types.js";

/**
 * Normalize a chunk by stripping redundant thought prefixes from explicit thoughts.
 */
export function normalizeChunk(input: ChunkInput): NormalizedChunk {
	const { content, isThought } = input;

	// Strip redundant thought prefix for thoughts with text content
	let normalizedContent: ContentBlock = content;
	if (isThought && content.type === "text") {
		const strippedText = stripThoughtPrefix(content.text);
		if (strippedText !== content.text) {
			normalizedContent = { type: "text", text: strippedText };
		}
	}

	return {
		type: isThought ? "thought" : "message",
		block: normalizedContent,
	};
}
