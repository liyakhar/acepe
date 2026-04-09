<script lang="ts">
import * as DropdownMenu from "@acepe/ui/dropdown-menu";
import type { Snippet } from "svelte";

import SelectorCheck from "./selector-check.svelte";

interface Props {
	modelId: string;
	modelName: string;
	currentModelId: string | null;
	onSelect: () => void;
	leading?: Snippet;
	actions?: Snippet;
}

let { modelId, modelName, currentModelId, onSelect, leading, actions }: Props = $props();
</script>

<DropdownMenu.Item
	{onSelect}
	class="group/item transition-colors {modelId === currentModelId ? 'bg-accent' : ''}"
>
	<div class="flex w-full items-center gap-2">
		{#if leading}{@render leading()}{/if}
		<span class="flex-1 truncate text-xs">{modelName}</span>
		{#if actions}{@render actions()}{/if}
		<SelectorCheck visible={modelId === currentModelId} />
	</div>
</DropdownMenu.Item>
