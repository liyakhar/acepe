<script lang="ts">
	import { ArrowSquareOut, Clock } from 'phosphor-svelte';
	import { cn } from '../../lib/utils.js';
	import type { GitHubComment, GitHubService } from './types.js';
	import { formatTimeAgo, unwrapResult } from './types.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';

	interface Props {
		comment: GitHubComment;
		service: GitHubService;
	}

	let { comment, service }: Props = $props();

	const queryClient = useQueryClient();

	const reactionMutation = createMutation({
		mutationFn: (content: string) => unwrapResult(service.toggleCommentReaction(comment.id, content)),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['comments'] });
		}
	});

	const REACTIONS = [
		{ content: '+1', emoji: '+1', key: 'plus1' as const },
		{ content: 'heart', emoji: 'heart', key: 'heart' as const },
		{ content: 'rocket', emoji: 'rocket', key: 'rocket' as const },
		{ content: 'eyes', emoji: 'eyes', key: 'eyes' as const }
	];
</script>

<div class="flex flex-col gap-1.5">
	<!-- Comment header -->
	<div class="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40">
		<img src={comment.author.avatarUrl} alt="" class="h-3.5 w-3.5 rounded-full" />
		<span class="font-medium text-foreground/60">{comment.author.login}</span>
		<span class="flex items-center gap-0.5">
			<Clock size={9} />
			{formatTimeAgo(comment.createdAt)}
		</span>
		<button
			type="button"
			class="ml-auto text-muted-foreground/20 hover:text-muted-foreground transition-colors cursor-pointer"
			onclick={() => window.open(comment.htmlUrl, '_blank', 'noopener,noreferrer')}
		>
			<ArrowSquareOut size={9} />
		</button>
	</div>

	<!-- Comment body -->
	<div class="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono pl-5">
		{comment.body}
	</div>

	<!-- Reactions -->
	{#if comment.reactions.totalCount > 0}
		<div class="flex items-center gap-1 pl-5 mt-0.5">
			{#each REACTIONS as r}
				{@const count = comment.reactions[r.key]}
				{#if count > 0}
					<button
						type="button"
						class="flex items-center gap-0.5 h-4 px-1.5 rounded text-[9px] font-mono bg-accent/30 text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer"
						disabled={$reactionMutation.isPending}
						onclick={() => $reactionMutation.mutate(r.content)}
					>
						<span>{r.emoji}</span>
						<span class="tabular-nums">{count}</span>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>
