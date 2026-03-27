<script lang="ts">
	import type { CommentRow, GitHubService } from './types.js';
	import { isOptimisticComment } from './types.js';
	import UserReportsComment from './user-reports-comment.svelte';
	import UserReportsCommentForm from './user-reports-comment-form.svelte';

	interface Props {
		comments: CommentRow[];
		service: GitHubService;
		commentError: string | null;
		onNewComment: (body: string) => void;
	}

	let { comments, service, commentError, onNewComment }: Props = $props();

	// Count only real comments for the header label
	const realCount = $derived(comments.filter((c) => !isOptimisticComment(c)).length);
</script>

<div class="flex flex-col">
	<div class="h-7 flex items-center px-4 border-b border-border/15">
		<span class="text-[10px] font-mono text-muted-foreground/40">
			{realCount} comment{realCount !== 1 ? 's' : ''}
		</span>
	</div>

	{#if comments.length > 0}
		<div class="flex flex-col">
			{#each comments as comment (comment.id)}
				<div class="px-4 py-2.5 border-b border-border/10">
					<UserReportsComment {comment} {service} />
				</div>
			{/each}
		</div>
	{/if}

	<div class="px-4 py-3 flex flex-col gap-2">
		{#if commentError}
			<p class="text-[10px] font-mono text-destructive/80">{commentError}</p>
		{/if}
		<UserReportsCommentForm onSubmit={onNewComment} />
	</div>
</div>
