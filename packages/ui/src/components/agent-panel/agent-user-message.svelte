<script lang="ts">
	import type { InlineArtefactTokenType } from "../../lib/inline-artefact/index.js";
	import { RichTokenText } from "../rich-token-text/index.js";
	import { UserMessageContainer } from "../user-message-container/index.js";
	import AgentMessageMeta from "./agent-message-meta.svelte";

	interface Props {
		text: string;
		onTokenClick?: (tokenType: InlineArtefactTokenType, value: string) => void;
		timestampMs?: number;
	}

	let { text, onTokenClick, timestampMs }: Props = $props();
</script>

<!-- Mirrors desktop MessageInputContainer / InputContainer visual -->

<UserMessageContainer class="border border-border">
	<div class="group/user-message relative">
		<RichTokenText {text} {onTokenClick} class="text-foreground" />
		<div
			class="pointer-events-none absolute -bottom-1 -right-1 opacity-0 transition-opacity duration-150 group-hover/user-message:opacity-100 group-focus-within/user-message:opacity-100"
		>
			<div class="pointer-events-auto">
				<AgentMessageMeta text={text} {timestampMs} variant="user" />
			</div>
		</div>
	</div>
</UserMessageContainer>
