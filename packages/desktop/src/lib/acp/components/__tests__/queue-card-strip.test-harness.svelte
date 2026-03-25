<script lang="ts">
import { okAsync } from "neverthrow";
import type { Attachment } from "$lib/acp/components/agent-input/types/attachment.js";
import { createMessageQueueStore } from "$lib/acp/store/message-queue/message-queue-store.svelte.js";
import type { MessageQueueStore } from "$lib/acp/store/message-queue/index.js";

import QueueCardStrip from "../queue-card-strip.svelte";

interface MessageSeed {
	content: string;
	attachments: readonly Attachment[];
}

interface Props {
	sessionId: string;
	messages: readonly MessageSeed[];
	onStoreReady?: (store: MessageQueueStore) => void;
}

const props: Props = $props();

const sender = {
	sendMessage() {
		return okAsync(undefined);
	},
};

const store = createMessageQueueStore(sender);

function initializeStore(): void {
	props.onStoreReady?.(store);
	for (const message of props.messages) {
		store.enqueue(props.sessionId, message.content, message.attachments);
	}
}

initializeStore();
</script>

<QueueCardStrip sessionId={props.sessionId} />
