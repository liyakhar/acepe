<script lang="ts">
	import { ArrowSquareOut, Clock } from 'phosphor-svelte';
	import { cn } from '../../lib/utils.js';
	import type { CommentRow, GitHubComment, GitHubService } from './types.js';
	import {
		applyReactionToggle,
		formatTimeAgo,
		isOptimisticComment,
		REACTION_CONFIG,
		unwrapResult
	} from './types.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';

	interface Props {
		comment: CommentRow;
		service: GitHubService;
	}

	let { comment, service }: Props = $props();

	const queryClient = useQueryClient();

	// Optimistic flag — derived so the template can branch cleanly
	const optimistic = $derived(isOptimisticComment(comment));

	// Real comment shorthand — only valid when !optimistic
	const real = $derived(!optimistic ? (comment as GitHubComment) : null);

	const reactionMutation = createMutation({
		mutationFn: ({ content }: { content: string }) => {
			// real is guaranteed non-null when mutation fires (button only shown for real comments)
			return unwrapResult(service.toggleCommentReaction(real!.id, content));
		},
		onMutate: async ({ content }) => {
			if (!real) return { previous: undefined };
			const key = ['comments'];
			await queryClient.cancelQueries({ queryKey: key });
			// Snapshot ALL comment arrays that may contain this comment
			const allKeys = queryClient
				.getQueriesData<CommentRow[]>({ queryKey: key })
				.filter(([, data]) => Array.isArray(data) && data.some((c) => !isOptimisticComment(c) && (c as GitHubComment).id === real.id));

			for (const [queryKey, data] of allKeys) {
				if (!data) continue;
				const cfg = REACTION_CONFIG.find((r) => r.content === content);
				if (!cfg) continue;
				const updated = data.map((c) => {
					if (isOptimisticComment(c) || (c as GitHubComment).id !== real.id) return c;
					const gc = c as GitHubComment;
					return {
						id: gc.id,
						body: gc.body,
						author: gc.author,
						reactions: applyReactionToggle(gc.reactions, cfg.key, true),
						createdAt: gc.createdAt,
						updatedAt: gc.updatedAt,
						htmlUrl: gc.htmlUrl
					} satisfies GitHubComment;
				});
				queryClient.setQueryData(queryKey, updated);
			}
			return { allKeys };
		},
		onError: (_err, _vars, context) => {
			if (!context?.allKeys) return;
			// Restore each snapshotted query
			// We don't have the previous data stored here, just re-invalidate
			queryClient.invalidateQueries({ queryKey: ['comments'] });
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['comments'] });
		}
	});
</script>

<div class="flex flex-col gap-1.5">
	{#if optimistic}
		<!-- Optimistic (pending) comment -->
		{@const c = comment}
		<div class="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/30">
			<span class="font-medium text-foreground/40">{isOptimisticComment(c) ? c.authorLogin : ''}</span>
			<span class="flex items-center gap-0.5">
				<Clock size={9} />
				just now
			</span>
			<span class="ml-auto text-[9px] text-muted-foreground/25">posting…</span>
		</div>
		<div class="text-[11px] text-foreground/50 leading-relaxed whitespace-pre-wrap font-mono pl-5 opacity-60">
			{isOptimisticComment(c) ? c.body : ''}
		</div>
	{:else}
		<!-- Real comment from server -->
		{@const c = real!}
		<div class="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40">
			<img src={c.author.avatarUrl} alt="" class="h-3.5 w-3.5 rounded-full" />
			<span class="font-medium text-foreground/60">{c.author.login}</span>
			<span class="flex items-center gap-0.5">
				<Clock size={9} />
				{formatTimeAgo(c.createdAt)}
			</span>
			<button
				type="button"
				class="ml-auto text-muted-foreground/20 hover:text-muted-foreground transition-colors cursor-pointer"
				onclick={() => window.open(c.htmlUrl, '_blank', 'noopener,noreferrer')}
			>
				<ArrowSquareOut size={9} />
			</button>
		</div>

		<div class="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono pl-5">
			{c.body}
		</div>

		<!-- Reactions -->
		{#if c.reactions.totalCount > 0}
			<div class="flex items-center gap-1 pl-5 mt-0.5">
				{#each REACTION_CONFIG as r}
					{@const count = c.reactions[r.key]}
					{@const Icon = r.icon}
					{#if count > 0}
						<button
							type="button"
							class={cn(
								'flex items-center gap-0.5 h-4 px-1.5 rounded text-[9px] font-mono bg-accent/30 text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer',
								$reactionMutation.isPending ? 'opacity-60' : ''
							)}
							disabled={$reactionMutation.isPending}
							onclick={() => $reactionMutation.mutate({ content: r.content })}
						>
							<Icon size={9} weight="fill" />
							<span class="tabular-nums">{count}</span>
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>
