<script lang="ts">
import type { TokenRevealCss } from "@acepe/ui/agent-panel";
import MarkdownText from "../markdown-text.svelte";
import {
	DEFAULT_STREAMING_ANIMATION_MODE,
	type StreamingAnimationMode,
} from "../../../types/streaming-animation-mode.js";

interface Props {
	text: string;
	isStreaming?: boolean;
	tokenRevealCss?: TokenRevealCss;
	projectPath?: string;
	streamingAnimationMode?: StreamingAnimationMode;
}

let {
	text,
	isStreaming = false,
	tokenRevealCss,
	projectPath,
	streamingAnimationMode = DEFAULT_STREAMING_ANIMATION_MODE,
}: Props = $props();
</script>

<MarkdownText
	{text}
	{isStreaming}
	{tokenRevealCss}
	{projectPath}
	{streamingAnimationMode}
/>
