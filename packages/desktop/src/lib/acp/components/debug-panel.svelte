<script lang="ts">
import { Gift } from "@lucide/svelte/icons";
import type { ChangelogEntry } from "$lib/changelog/index.js";
import { CHANGELOG } from "$lib/changelog/index.js";
import ChangelogModal from "$lib/components/changelog-modal/changelog-modal.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@acepe/ui/dialog";
import StreamingReproLab from "./debug-panel/streaming-repro-lab.svelte";

interface Props {
	open?: boolean;
}

let { open = $bindable(false) }: Props = $props();

let changelogEntries: ChangelogEntry[] = $state([]);

function openChangelogModal() {
	if (CHANGELOG.length > 0) {
		changelogEntries = CHANGELOG.slice(0, 3);
		open = false;
	}
}

function closeChangelogModal() {
	changelogEntries = [];
}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-6xl h-[85vh] max-h-[900px] overflow-hidden p-0 gap-0 flex flex-col">
		<DialogHeader>
			<div class="px-6 pt-6">
			<DialogTitle>Debug Panel</DialogTitle>
			</div>
		</DialogHeader>

		<div class="space-y-3 px-6 pb-4">
			<Button variant="outline" class="w-full justify-start gap-3" onclick={openChangelogModal}>
				<Gift class="size-4" />
				Test Changelog Modal
			</Button>
		</div>

		{#if import.meta.env.DEV}
			<div class="min-h-0 flex-1 border-t border-border px-6 pb-6 pt-4 overflow-hidden">
				<StreamingReproLab />
			</div>
		{/if}
	</DialogContent>
</Dialog>

{#if changelogEntries.length > 0}
	<ChangelogModal entries={changelogEntries} onDismiss={closeChangelogModal} />
{/if}
