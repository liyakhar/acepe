<script lang="ts">
import { useSessionContext } from "../../hooks/use-session-context.js";
import type { AgentTextRevealState } from "@acepe/ui/agent-panel";
import type { ContentBlock } from "../../schemas/content-block.schema.js";
import {
	DEFAULT_STREAMING_ANIMATION_MODE,
	type StreamingAnimationMode,
} from "../../types/streaming-animation-mode.js";
import { validateContentBlock } from "../../utils/content-block-validator.js";
import { getBlockRenderer } from "./acp-block-types/registry.js";

interface Props {
	block: unknown;
	/** Whether this content is currently streaming */
	isStreaming?: boolean;
	revealKey?: string;
	textRevealState?: AgentTextRevealState;
	/** Project path for opening files in panels */
	projectPath?: string;
	streamingAnimationMode?: StreamingAnimationMode;
	onRevealActivityChange?: (active: boolean) => void;
}

let {
	block,
	isStreaming = false,
	revealKey,
	textRevealState,
	projectPath: propProjectPath,
	streamingAnimationMode = DEFAULT_STREAMING_ANIMATION_MODE,
	onRevealActivityChange,
}: Props = $props();


const sessionContext = useSessionContext();
const projectPath = $derived(propProjectPath ?? sessionContext?.projectPath);
const validationResult = $derived(validateContentBlock(block));
</script>

{#if validationResult.isOk()}
	{@const validatedBlock = validationResult.value}
	{@const renderer = getBlockRenderer(validatedBlock.type)}
	{#if renderer}
		{@const Component = renderer.component}
		{@const blockProps = (
			renderer as { getProps: (b: ContentBlock) => Record<string, unknown> }
		).getProps(validatedBlock)}
		<Component
			{...blockProps}
			{isStreaming}
			{revealKey}
			{textRevealState}
			{projectPath}
			{streamingAnimationMode}
			{onRevealActivityChange}
		/>
	{:else}
		<div class="text-xs text-muted-foreground/70 italic">
			Unknown block type: {validatedBlock.type}
		</div>
	{/if}
{:else}
	<div class="text-xs text-muted-foreground/70 italic">
		Invalid content block: {validationResult.error.message}
	</div>
{/if}
