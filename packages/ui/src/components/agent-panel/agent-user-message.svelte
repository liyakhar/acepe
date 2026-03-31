<script lang="ts">
	import type { InlineArtefactTokenType } from "../../lib/inline-artefact/index.js";
	import { RichTokenText } from "../rich-token-text/index.js";
	import { UserMessageContainer } from "../user-message-container/index.js";

	interface Props {
		text: string;
		onTokenClick?: (tokenType: InlineArtefactTokenType, value: string) => void;
	}

	let { text, onTokenClick }: Props = $props();
</script>

<!-- Mirrors desktop MessageInputContainer / InputContainer visual -->

<UserMessageContainer class="border border-border">
	<RichTokenText {text} {onTokenClick} class="text-foreground" />
</UserMessageContainer>
