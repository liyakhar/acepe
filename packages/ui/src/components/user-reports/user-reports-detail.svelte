<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { ArrowSquareOut, Circle, Clock } from 'phosphor-svelte';
	import { cn } from '../../lib/utils.js';
	import type { CommentRow, GitHubComment, GitHubIssue, GitHubService } from './types.js';
	import {
		applyReactionToggle,
		buildOptimisticComment,
		formatTimeAgo,
		getIssueCategory,
		REACTION_CONFIG,
		unwrapResult
	} from './types.js';
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

	let commentError = $state<string | null>(null);

	const reactionMutation = createMutation({
		mutationFn: ({ content }: { content: string }) =>
			unwrapResult(service.toggleIssueReaction(issueNumber, content)),
		onMutate: async ({ content }) => {
			await queryClient.cancelQueries({ queryKey: ['issue', issueNumber] });
			const previous = queryClient.getQueryData<GitHubIssue>(['issue', issueNumber]);
			if (previous) {
				const cfg = REACTION_CONFIG.find((r) => r.content === content);
				if (cfg) {
					const optimistic: GitHubIssue = {
						number: previous.number,
						title: previous.title,
						body: previous.body,
						state: previous.state,
						labels: previous.labels,
						author: previous.author,
						commentsCount: previous.commentsCount,
						reactions: applyReactionToggle(previous.reactions, cfg.key, true),
						createdAt: previous.createdAt,
						updatedAt: previous.updatedAt,
						htmlUrl: previous.htmlUrl
					};
					queryClient.setQueryData(['issue', issueNumber], optimistic);
				}
			}
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(['issue', issueNumber], context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['issue', issueNumber] });
			queryClient.invalidateQueries({ queryKey: ['issues'] });
		}
	});

	const commentMutation = createMutation({
		mutationFn: (body: string) => unwrapResult(service.createComment(issueNumber, body)),
		onMutate: async (body) => {
			await queryClient.cancelQueries({ queryKey: ['comments', issueNumber] });
			const previous = queryClient.getQueryData<GitHubComment[]>(['comments', issueNumber]);
			const authQuery = queryClient.getQueryData<{ authenticated: boolean; username?: string }>(['auth']);
			const authorLogin = authQuery?.username ? authQuery.username : 'you';
			const optimistic = buildOptimisticComment(body, authorLogin);
			if (previous) {
				const updated: CommentRow[] = [...previous, optimistic];
				queryClient.setQueryData(['comments', issueNumber], updated);
			}
			commentError = null;
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(['comments', issueNumber], context.previous);
			}
			commentError = 'Failed to post comment. Please try again.';
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['comments', issueNumber] });
			queryClient.invalidateQueries({ queryKey: ['issue', issueNumber] });
		}
	});
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
			{#each REACTION_CONFIG as r}
				{@const count = issue.reactions[r.key]}
				{@const Icon = r.icon}
				<button
					type="button"
					class={cn(
						'flex items-center gap-1 h-5 px-2 rounded text-[10px] font-mono transition-colors cursor-pointer',
						count > 0
							? 'bg-accent/50 text-foreground'
							: 'text-muted-foreground/25 hover:bg-accent/25 hover:text-muted-foreground'
					)}
					disabled={$reactionMutation.isPending}
					onclick={() => $reactionMutation.mutate({ content: r.content })}
				>
					<Icon size={11} weight="fill" />
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
				{commentError}
				onNewComment={(body) => {
					$commentMutation.mutate(body);
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
