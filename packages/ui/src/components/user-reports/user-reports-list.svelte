<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import type { GitHubService, IssueCategory, IssueListResult, IssueState } from './types.js';
	import { unwrapResult } from './types.js';
	import UserReportsListItem from './user-reports-list-item.svelte';
	import UserReportsSkeleton from './user-reports-skeleton.svelte';
	import UserReportsEmptyState from './user-reports-empty-state.svelte';

	interface Props {
		service: GitHubService;
		category: IssueCategory | null;
		state: IssueState | 'open';
		sort: string;
		search: string;
		page: number;
		onSelect: (issueNumber: number) => void;
		onPageChange: (page: number) => void;
		onCreateNew?: () => void;
	}

	let { service, category, state, sort, search, page, onSelect, onPageChange, onCreateNew }: Props = $props();

	const isSearch = $derived(search.length > 0);

	const queryOptions = $derived({
		queryKey: ['issues', { category, state, sort, search, page }],
		queryFn: (): Promise<IssueListResult> => {
			if (isSearch) {
				return unwrapResult(
					service.searchIssues({
						query: search,
						state: state ? state : undefined,
						labels: category ? category : undefined,
						sort: sort === 'comments' ? 'comments' : undefined,
						page,
						perPage: 20
					})
				);
			}
			return unwrapResult(
				service.listIssues({
					state: state ? state : 'open',
					labels: category ? category : undefined,
					sort,
					direction: sort === 'created' ? 'desc' : undefined,
					page,
					perPage: 20
				})
			);
		}
	});

	const query = createQuery(queryOptions);

	const queryResult = $derived($query.data as IssueListResult | undefined);
</script>

{#if $query.isLoading}
	<UserReportsSkeleton />
{:else if $query.isError}
	<div class="flex flex-col items-center justify-center py-16 px-4 gap-2">
		<span class="text-[11px] font-mono text-destructive/80">Failed to load issues</span>
		<span class="text-[10px] text-muted-foreground/40 text-center max-w-xs font-mono">
			{$query.error instanceof Error ? $query.error.message : 'An unexpected error occurred'}
		</span>
		<button
			type="button"
			class="mt-2 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors cursor-pointer"
			onclick={() => $query.refetch()}
		>
			retry
		</button>
	</div>
{:else if queryResult && queryResult.items.length > 0}
	<div class="flex flex-col">
		{#each queryResult.items as issue (issue.number)}
			<UserReportsListItem {issue} {onSelect} />
		{/each}
	</div>

	{#if queryResult.hasNextPage || page > 1}
		<div class="flex items-center justify-center gap-3 h-8 border-t border-border/15">
			<button
				type="button"
				class="text-[10px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-default"
				disabled={page <= 1}
				onclick={() => onPageChange(page - 1)}
			>
				prev
			</button>
			<span class="text-[10px] text-muted-foreground/30 tabular-nums font-mono">
				{page}
			</span>
			<button
				type="button"
				class="text-[10px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-default"
				disabled={!queryResult.hasNextPage}
				onclick={() => onPageChange(page + 1)}
			>
				next
			</button>
		</div>
	{/if}
{:else}
	<UserReportsEmptyState
		actionLabel={onCreateNew ? 'Create Issue' : undefined}
		onAction={onCreateNew}
	/>
{/if}
