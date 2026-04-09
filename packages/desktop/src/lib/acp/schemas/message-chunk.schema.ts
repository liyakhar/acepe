import { z } from "zod";

/**
 * Schema for validating message IDs in streaming chunks.
 * Message IDs must be non-empty strings.
 */
export const MessageIdSchema = z.string().min(1);

/**
 * Schema for text content in assistant messages.
 * Only text content is supported for streaming chunks.
 */
export const TextContentSchema = z.object({
	type: z.literal("text"),
	text: z.string(),
});

export const ChunkAggregationHintSchema = z.enum(["boundaryCarryover"]);

/**
 * Schema for validating assistant chunk input data.
 * Used by SessionStore to validate incoming streaming chunks.
 */
export const AssistantChunkInputSchema = z.object({
	sessionId: z.string().min(1),
	messageId: MessageIdSchema.optional(),
	content: TextContentSchema,
	isThought: z.boolean(),
	aggregationHint: ChunkAggregationHintSchema.optional().nullable(),
});

/**
 * TypeScript type inferred from the AssistantChunkInputSchema.
 * Ensures type safety at compile time and runtime validation.
 */
export type AssistantChunkInput = z.infer<typeof AssistantChunkInputSchema>;

/**
 * TypeScript type for text content blocks.
 */
export type TextContent = z.infer<typeof TextContentSchema>;
