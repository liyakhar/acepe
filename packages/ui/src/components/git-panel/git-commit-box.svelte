<script lang="ts">
	/**
	 * GitCommitBox — Thin wrapper that preserves the existing public API while delegating to GitCommitComposer.
	 */
	import type { Snippet } from "svelte";
	import { cn } from "../../lib/utils.js";
	import GitCommitComposer from "./git-commit-composer.svelte";

	interface Props {
		message: string;
		onMessageChange: (message: string) => void;
		onCommit: (message: string) => void;
		onGenerate?: () => void;
		micButton?: Snippet;
		generating?: boolean;
		disabled?: boolean;
		submitDisabled?: boolean;
		class?: string;
	}

	let {
		message,
		onMessageChange,
		onCommit,
		onGenerate,
		micButton,
		generating = false,
		disabled = false,
		submitDisabled = false,
		class: className,
	}: Props = $props();
</script>

<div class={cn("border-t border-border/30 px-2 py-2", className)}>
	<GitCommitComposer
		{message}
		onMessageChange={onMessageChange}
		onCommit={onCommit}
		onGenerate={onGenerate}
		micButton={micButton}
		{generating}
		{disabled}
		{submitDisabled}
	/>
</div>
