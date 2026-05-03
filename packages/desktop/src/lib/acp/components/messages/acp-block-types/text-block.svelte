<script lang="ts">
import type { AgentTextRevealState } from "@acepe/ui/agent-panel";
import MarkdownText from "../markdown-text.svelte";
import {
	DEFAULT_STREAMING_ANIMATION_MODE,
	type StreamingAnimationMode,
} from "../../../types/streaming-animation-mode.js";

interface Props {
	text: string;
	isStreaming?: boolean;
	revealKey?: string;
	textRevealState?: AgentTextRevealState;
	projectPath?: string;
	streamingAnimationMode?: StreamingAnimationMode;
	onRevealActivityChange?: (active: boolean) => void;
}

let {
	text,
	isStreaming = false,
	revealKey,
	textRevealState,
	projectPath,
	streamingAnimationMode = DEFAULT_STREAMING_ANIMATION_MODE,
	onRevealActivityChange,
}: Props = $props();

</script>

<MarkdownText
	{text}
	{isStreaming}
	{revealKey}
	{textRevealState}
	{projectPath}
	{streamingAnimationMode}
	{onRevealActivityChange}
/>
