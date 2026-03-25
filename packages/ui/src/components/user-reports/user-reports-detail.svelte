<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { ArrowSquareOut, Circle, Clock } from 'phosphor-svelte';
	import { cn } from '../../lib/utils.js';
	import type { GitHubService } from './types.js';
	import { formatTimeAgo, getIssueCategory, unwrapResult } from './types.js';
	import UserReportsCategoryBadge from './user-reports-category-badge.svelte';
	import UserReportsCommentList from './user-reports-comment-list.svelte';

	interface Props {
		service: GitHubService;
		issueNumber: number;
		onBack: () => void;
	}

	let { service, issueNumber, onBack }: Props = $props();

	const queryClient = useQueryClient();

	// svelte-ignore state_referenced_locally
	const issueQuery = createQuery({
		queryKey: ['issue', issueNumber],
		queryFn: () => unwrapResult(service.getIssue(issueNumber))
	});

	// svelte-ignore state_referenced_locally
	const commentsQuery = createQuery({
		queryKey: ['comments', issueNumber],
		queryFn: () => unwrapResult(service.listComments(issueNumber))
	});

	const reactionMutation = createMutation({
		mutationFn: (content: string) => unwrapResult(service.toggleIssueReaction(issueNumber, content)),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['issue', issueNumber] });
			queryClient.invalidateQueries({ queryKey: ['issues'] });
		}
	});

	const commentMutation = createMutation({
		mutationFn: (body: string) => unwrapResult(service.createComment(issueNumber, body)),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['comments', issueNumber] });
			queryClient.invalidateQueries({ queryKey: ['issue', issueNumber] });
		}
	});

	const REACTIONS = [
		{ content: '+1', emoji: '+1', key: 'plus1' as const },
		{ content: 'heart', emoji: 'heart', key: 'heart' as const },
		{ content: 'rocket', emoji: 'rocket', key: 'rocket' as const },
		{ content: 'eyes', emoji: 'eyes', key: 'eyes' as const }
	];
</script>

{#if $issueQuery.data}
	{@const issue = $issueQuery.data}
	{@const category = getIssueCategory(issue.labels)}
	{@const isOpen = issue.state === 'open'}
	<div class="flex flex-col overflow-y-auto">
		<!-- Header -->
		<div class="px-4 pt-4 pb-3">
			<h2 class="text-[13px] font-semibold text-foreground leading-snug">{issue.title}</h2>

			<!-- Metadata row -->
			<div class="flex items-center gap-2 mt-2 text-[10px] font-mono text-muted-foreground/50">
				<img src={issue.author.avatarUrl} alt="" class="h-4 w-4 rounded-full" />
				<span class="font-medium text-foreground/70">{issue.author.login}</span>
				<Circle size={7} weight="fill" class={isOpen ? 'text-[var(--success)]' : 'text-muted-foreground/30'} />
				<span>{isOpen ? 'Open' : 'Closed'}</span>
				<span class="flex items-center gap-0.5">
					<Clock size={9} />
					{formatTimeAgo(issue.createdAt)}
				</span>
				{#if category}
					<UserReportsCategoryBadge {category} size="xs" />
				{/if}
				<button
					type="button"
					class="ml-auto flex items-center gap-1 text-muted-foreground/30 hover:text-foreground transition-colors cursor-pointer"
					onclick={() => window.open(issue.htmlUrl, '_blank', 'noopener,noreferrer')}
				>
					<ArrowSquareOut size={10} />
					<span class="text-[9px]">github</span>
				</button>
			</div>
		</div>

		<!-- Body card -->
		<div class="mx-4 mb-3 rounded-lg overflow-hidden" style="background: color-mix(in srgb, var(--input) 25%, transparent);">
			<div class="px-4 py-3 text-[12px] text-foreground/85 leading-relaxed whitespace-pre-wrap font-mono">
				{issue.body}
			</div>
		</div>

		<!-- Reactions -->
		<div class="flex items-center gap-1 px-4 pb-3">
			{#each REACTIONS as r}
				{@const count = issue.reactions[r.key]}
				<button
					type="button"
					class={cn(
						'flex items-center gap-1 h-5 px-2 rounded text-[10px] font-mono transition-colors cursor-pointer',
						count > 0
							? 'bg-accent/50 text-foreground'
							: 'text-muted-foreground/25 hover:bg-accent/25 hover:text-muted-foreground'
					)}
					disabled={$reactionMutation.isPending}
					onclick={() => $reactionMutation.mutate(r.content)}
				>
					<span>{r.emoji}</span>
					{#if count > 0}
						<span class="tabular-nums">{count}</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Divider -->
		<div class="border-t border-border/20"></div>

		<!-- Comments -->
		{#if $commentsQuery.data}
			<UserReportsCommentList
				comments={$commentsQuery.data}
				{service}
				onNewComment={async (body) => {
					await $commentMutation.mutateAsync(body);
				}}
			/>
		{/if}
	</div>
{:else if $issueQuery.isLoading}
	<div class="flex items-center justify-center py-16">
		<span class="text-[10px] font-mono text-muted-foreground/30">loading...</span>
	</div>
{:else if $issueQuery.isError}
	<div class="flex flex-col items-center justify-center py-16 px-4 gap-2">
		<span class="text-[11px] font-mono text-destructive/80">Failed to load issue</span>
		<span class="text-[10px] text-muted-foreground/40 font-mono text-center max-w-xs">
			{$issueQuery.error instanceof Error ? $issueQuery.error.message : 'An unexpected error occurred'}
		</span>
		<div class="flex items-center gap-3 mt-2">
			<button
				type="button"
				class="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors cursor-pointer"
				onclick={() => $issueQuery.refetch()}
			>
				retry
			</button>
			<button
				type="button"
				class="text-[10px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
				onclick={onBack}
			>
				back
			</button>
		</div>
	</div>
{/if}
