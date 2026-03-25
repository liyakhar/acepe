<script lang="ts">
	import { ChatDots, Circle } from 'phosphor-svelte';
	import type { GitHubIssue } from './types.js';
	import { formatTimeAgo, getIssueCategory } from './types.js';
	import UserReportsCategoryBadge from './user-reports-category-badge.svelte';

	interface Props {
		issue: GitHubIssue;
		onSelect: (issueNumber: number) => void;
	}

	let { issue, onSelect }: Props = $props();

	const timeAgo = $derived(formatTimeAgo(issue.createdAt));
	const category = $derived(getIssueCategory(issue.labels));
	const isOpen = $derived(issue.state === 'open');
</script>

<button
	type="button"
	class="group flex items-center gap-2 h-9 px-3 w-full text-left cursor-pointer border-b border-border/15 transition-colors hover:bg-accent/30"
	onclick={() => onSelect(issue.number)}
>
	<!-- Status dot -->
	<Circle
		size={8}
		weight="fill"
		class="shrink-0 {isOpen ? 'text-[var(--success)]' : 'text-muted-foreground/30'}"
	/>

	<!-- Issue number -->
	<span class="text-[10px] font-mono text-muted-foreground/40 shrink-0 tabular-nums">#{issue.number}</span>

	<!-- Title -->
	<span class="text-[11px] font-medium text-foreground truncate flex-1 min-w-0 group-hover:text-primary transition-colors">
		{issue.title}
	</span>

	<!-- Category badge -->
	{#if category}
		<UserReportsCategoryBadge {category} size="xs" />
	{/if}

	<!-- Meta: comments + time -->
	<div class="flex items-center gap-2 shrink-0 text-[10px] font-mono text-muted-foreground/40">
		{#if issue.commentsCount > 0}
			<span class="flex items-center gap-0.5 tabular-nums">
				<ChatDots size={10} />
				{issue.commentsCount}
			</span>
		{/if}
		<span class="tabular-nums w-6 text-right">{timeAgo}</span>
	</div>
</button>
