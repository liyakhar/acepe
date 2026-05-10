<script lang="ts">
interface TextBlock {
	type: "text";
	text: string;
}

interface OtherBlock {
	type: string;
}

interface Props {
	block: TextBlock | OtherBlock;
	isStreaming?: boolean;
	projectPath?: string;
}

// Test fake only: it can grow content and toggle local text, but it does not
// report reveal lifecycle authority back to any parent.
let { block }: Props = $props();
let lineCount = $state(1);
let revealActive = $state(false);
let hasInitializedReveal = $state(false);

function isTextBlock(b: TextBlock | OtherBlock): b is TextBlock {
	return b.type === "text";
}

$effect(() => {
	const isRevealBlock = isTextBlock(block) && block.text.includes("[reveal-active]");
	if (isRevealBlock && !hasInitializedReveal) {
		revealActive = true;
		hasInitializedReveal = true;
		return;
	}

	if (!isRevealBlock) {
		revealActive = false;
		hasInitializedReveal = false;
	}
});

</script>

{#if isTextBlock(block) && block.text === "thinking"}
	<button type="button" data-testid="grow-line" onclick={() => {
		lineCount += 1;
	}}>
		grow
	</button>
	<div data-testid="growing-content">
		{#each Array.from({ length: lineCount }) as _, index (index)}
			<div class="stub-line">line {index + 1}</div>
		{/each}
	</div>
{:else if isTextBlock(block) && block.text.includes("[reveal-active]")}
	<button
		type="button"
		data-testid="finish-reveal"
		onclick={() => {
			revealActive = false;
		}}
	>
		finish
	</button>
	<div data-testid="text-block">{block.text.replace(" [reveal-active]", "")}</div>
{:else}
	{#if isTextBlock(block)}
		<div data-testid="text-block">{block.text}</div>
	{:else}
		<div data-testid="other-block">{block.type}</div>
	{/if}
{/if}
