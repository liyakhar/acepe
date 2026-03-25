<script lang="ts">
	import type { GitHubComment, GitHubService } from './types.js';
	import UserReportsComment from './user-reports-comment.svelte';
	import UserReportsCommentForm from './user-reports-comment-form.svelte';

	interface Props {
		comments: GitHubComment[];
		service: GitHubService;
		onNewComment: (body: string) => Promise<void>;
	}

	let { comments, service, onNewComment }: Props = $props();
</script>

<div class="flex flex-col">
	<div class="h-7 flex items-center px-4 border-b border-border/15">
		<span class="text-[10px] font-mono text-muted-foreground/40">
			{comments.length} comment{comments.length !== 1 ? 's' : ''}
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

	<div class="px-4 py-3">
		<UserReportsCommentForm onSubmit={onNewComment} />
	</div>
</div>
