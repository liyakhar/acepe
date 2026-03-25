<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Bug, Lightbulb, Question, ChatCircle } from 'phosphor-svelte';
	import { cn } from '../../lib/utils.js';
	import type { GitHubService, GitHubIssue, GitHubError, IssueCategory } from './types.js';
	import { CATEGORY_CONFIG, unwrapResult } from './types.js';

	interface Props {
		service: GitHubService;
		onCreated: (issue: GitHubIssue) => void;
		onCancel: () => void;
	}

	let { service, onCreated, onCancel }: Props = $props();

	const queryClient = useQueryClient();

	let title = $state('');
	let body = $state('');
	let category = $state<IssueCategory>('bug');
	let error = $state<string | null>(null);

	const categories: { value: IssueCategory; label: string; icon: typeof Bug }[] = [
		{ value: 'bug', label: 'Bug', icon: Bug },
		{ value: 'enhancement', label: 'Feature', icon: Lightbulb },
		{ value: 'question', label: 'Question', icon: Question },
		{ value: 'discussion', label: 'Discussion', icon: ChatCircle }
	];

	const mutation = createMutation({
		mutationFn: () =>
			unwrapResult(
				service.createIssue({
					title,
					body,
					labels: [CATEGORY_CONFIG[category].githubLabel]
				})
			),
		onSuccess: (issue) => {
			queryClient.invalidateQueries({ queryKey: ['issues'] });
			onCreated(issue);
		},
		onError: (e: GitHubError) => {
			error = e.message ? e.message : 'Failed to create issue';
		}
	});

	const canSubmit = $derived(title.length >= 3 && body.length >= 10 && !$mutation.isPending);

	function handleSubmit() {
		if (!canSubmit) return;
		error = null;
		$mutation.mutate();
	}
</script>

<div class="flex flex-col px-4 py-4 gap-4">
	<!-- Category selector -->
	<div class="flex flex-col gap-1.5">
		<span class="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">type</span>
		<div class="flex gap-1">
			{#each categories as cat}
				{@const isActive = category === cat.value}
				<button
					type="button"
					class={cn(
						'flex items-center gap-1.5 h-6 px-2.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer',
						isActive
							? 'bg-accent/60 text-foreground'
							: 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/25'
					)}
					onclick={() => (category = cat.value)}
				>
					<cat.icon size={11} weight="fill" class={isActive ? '' : 'opacity-40'} />
					{cat.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Title -->
	<div class="flex flex-col gap-1.5">
		<label for="issue-title" class="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">title</label>
		<input
			id="issue-title"
			bind:value={title}
			placeholder="Short, descriptive title"
			class="h-8 px-3 text-[12px] font-mono rounded-md border border-border/40 bg-transparent text-foreground placeholder:text-muted-foreground/25 focus:border-ring focus:ring-ring/50 focus:ring-[2px] outline-none transition-shadow"
		/>
	</div>

	<!-- Body -->
	<div class="flex flex-col gap-1.5 flex-1">
		<label for="issue-body" class="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">description</label>
		<textarea
			id="issue-body"
			bind:value={body}
			placeholder="Describe the issue in detail..."
			rows={10}
			class="w-full resize-y rounded-md border border-border/40 bg-transparent px-3 py-2.5 text-[12px] font-mono text-foreground leading-relaxed placeholder:text-muted-foreground/25 focus:border-ring focus:ring-ring/50 focus:ring-[2px] outline-none transition-shadow"
			onkeydown={(e) => {
				if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
			}}
		></textarea>
		<span class="text-[9px] font-mono text-muted-foreground/25">cmd+enter to submit</span>
	</div>

	{#if error}
		<div class="text-[10px] font-mono text-destructive bg-destructive/5 border border-destructive/15 rounded px-3 py-1.5">
			{error}
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex items-center justify-end gap-2">
		<button
			type="button"
			class="h-7 px-3 text-[10px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer rounded hover:bg-accent/25"
			onclick={onCancel}
		>
			cancel
		</button>
		<button
			type="button"
			class="h-7 px-4 text-[10px] font-mono font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-30 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
			disabled={!canSubmit}
			onclick={handleSubmit}
		>
			{$mutation.isPending ? 'posting...' : 'post issue'}
		</button>
	</div>
</div>
