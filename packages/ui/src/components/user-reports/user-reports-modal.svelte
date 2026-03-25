<script lang="ts">
	import { Dialog } from 'bits-ui';
	import * as DropdownMenu from '../dropdown-menu/index.js';
	import { ArrowLeft, ArrowSquareOut, CaretDown, Check, MagnifyingGlass, Plus } from 'phosphor-svelte';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import {
		CloseAction,
		EmbeddedIconButton,
		EmbeddedPanelHeader,
		HeaderActionCell,
		HeaderTitleCell
	} from '../panel-header/index.js';
	import type { GitHubService, IssueCategory, IssueState, View } from './types.js';
	import { CATEGORY_CONFIG } from './types.js';
	import { cn } from '../../lib/utils.js';

	import UserReportsCreate from './user-reports-create.svelte';
	import UserReportsDetail from './user-reports-detail.svelte';
	import UserReportsList from './user-reports-list.svelte';

	interface Props {
		open: boolean;
		service: GitHubService;
		repoUrl?: string;
		onClose: () => void;
	}

	let { open = $bindable(), service, repoUrl = 'https://github.com/flazouh/acepe', onClose }: Props = $props();

	let view = $state<View>({ kind: 'list' });
	let searchQuery = $state('');
	let activeCategory = $state<IssueCategory | null>(null);
	let activeState = $state<IssueState | null>(null);
	let sortOrder = $state<string>('created');
	let searchOpen = $state(false);
	let listPage = $state(1);

	function resetPage() {
		listPage = 1;
	}

	const queryClient = new QueryClient({
		defaultOptions: { queries: { staleTime: 60_000 } }
	});

	const title = $derived(
		view.kind === 'create'
			? 'New Issue'
			: view.kind === 'detail'
				? `Issue #${view.issueNumber}`
				: 'Issues'
	);

	const categories: { value: IssueCategory | null; label: string }[] = [
		{ value: null, label: 'All' },
		{ value: 'bug', label: 'Bug' },
		{ value: 'enhancement', label: 'Feature' },
		{ value: 'question', label: 'Question' },
		{ value: 'discussion', label: 'Discussion' }
	];

	const sorts: { value: string; label: string }[] = [
		{ value: 'created', label: 'Newest' },
		{ value: 'updated', label: 'Updated' },
		{ value: 'comments', label: 'Discussed' }
	];

	const activeSortLabel = $derived(sorts.find((s) => s.value === sortOrder)?.label ? sorts.find((s) => s.value === sortOrder)!.label : 'Newest');

	function handleBack() {
		view = { kind: 'list' };
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) {
			onClose();
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed start-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-[740px] max-w-[calc(100vw-2rem)] h-[82vh] max-h-[760px] flex flex-col rounded-lg border border-border/50 bg-background shadow-lg overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
		>
			<span class="sr-only">
				<Dialog.Title>GitHub Issues</Dialog.Title>
				<Dialog.Description>Browse, create, and manage GitHub issues for the Acepe repository.</Dialog.Description>
			</span>
			<QueryClientProvider client={queryClient}>
				<!-- Header bar -->
				<EmbeddedPanelHeader>
					{#if view.kind !== 'list'}
						<EmbeddedIconButton title="Back" ariaLabel="Back to list" onclick={handleBack}>
							{#snippet children()}
								<ArrowLeft size={14} weight="bold" />
							{/snippet}
						</EmbeddedIconButton>
					{/if}

					<HeaderTitleCell>
						{#snippet children()}
							<span class="text-[11px] font-semibold font-mono text-foreground tracking-wide uppercase select-none">
								{title}
							</span>
						{/snippet}
					</HeaderTitleCell>

					<HeaderActionCell withDivider={false}>
						{#snippet children()}
							{#if view.kind === 'list'}
								<EmbeddedIconButton
									title="Search"
									ariaLabel="Search issues"
									active={searchOpen}
									onclick={() => {
										searchOpen = !searchOpen;
										if (!searchOpen) searchQuery = '';
										resetPage();
									}}
								>
									{#snippet children()}
										<MagnifyingGlass size={14} weight="bold" />
									{/snippet}
								</EmbeddedIconButton>

								<EmbeddedIconButton
									title="New issue"
									ariaLabel="Create new issue"
									onclick={() => (view = { kind: 'create' })}
								>
									{#snippet children()}
										<Plus size={14} weight="bold" />
									{/snippet}
								</EmbeddedIconButton>

								<EmbeddedIconButton
									title="Open on GitHub"
									ariaLabel="Open issues on GitHub"
									onclick={() => window.open(`${repoUrl}/issues`, '_blank', 'noopener,noreferrer')}
								>
									{#snippet children()}
										<ArrowSquareOut size={14} weight="bold" />
									{/snippet}
								</EmbeddedIconButton>
							{/if}
						{/snippet}
					</HeaderActionCell>

					<HeaderActionCell>
						{#snippet children()}
							<CloseAction onClose={onClose} />
						{/snippet}
					</HeaderActionCell>
				</EmbeddedPanelHeader>

				<!-- Search bar -->
				{#if searchOpen && view.kind === 'list'}
					<div class="flex items-center h-7 px-3 border-b border-border/30 bg-accent/5">
						<MagnifyingGlass size={11} class="text-muted-foreground/40 shrink-0 mr-2" />
						<label for="issue-search" class="sr-only">Search issues</label>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							id="issue-search"
							type="text"
							placeholder="Search issues..."
							bind:value={searchQuery}
							oninput={resetPage}
							class="bg-transparent border-none outline-none text-[11px] font-mono text-foreground placeholder:text-muted-foreground/30 w-full"
							autofocus
						/>
					</div>
				{/if}

				<!-- Filter bar: status tabs + category pills + sort -->
				{#if view.kind === 'list'}
					<div class="flex items-center h-8 px-2 border-b border-border/30 gap-1">
						<!-- Status tabs -->
						<button
							type="button"
							class={cn(
								'h-6 px-2.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer',
								activeState !== 'closed'
									? 'bg-accent/60 text-foreground'
									: 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30'
							)}
							onclick={() => { activeState = null; resetPage(); }}
						>
							Open
						</button>
						<button
							type="button"
							class={cn(
								'h-6 px-2.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer',
								activeState === 'closed'
									? 'bg-accent/60 text-foreground'
									: 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30'
							)}
							onclick={() => { activeState = 'closed'; resetPage(); }}
						>
							Closed
						</button>

						<div class="w-px h-3.5 bg-border/40 mx-1"></div>

						<!-- Category pills -->
						{#each categories as cat}
							{@const config = cat.value ? CATEGORY_CONFIG[cat.value] : null}
							{@const isActive = activeCategory === cat.value}
							<button
								type="button"
								class={cn(
									'h-5 px-2 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer flex items-center gap-1',
									isActive
										? 'bg-accent/60 text-foreground'
										: 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/20'
								)}
								onclick={() => { activeCategory = cat.value; resetPage(); }}
							>
								{#if config}
									{@const Icon = config.icon}
									{@const textClass = config.classes.split(' ').find((c) => c.startsWith('text-'))}
									<Icon size={10} weight="fill" class={isActive ? (textClass ? textClass : '') : 'opacity-50'} />
								{/if}
								{cat.label}
							</button>
						{/each}

						<div class="flex-1"></div>

						<!-- Sort dropdown -->
						<DropdownMenu.Root>
							<DropdownMenu.Trigger
								aria-label="Sort order"
								class="flex items-center gap-1 h-5 px-2 rounded text-[10px] font-mono font-medium text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/20 transition-colors cursor-pointer"
							>
								{activeSortLabel}
								<CaretDown size={9} />
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" sideOffset={4} class="z-[60] min-w-[120px]">
								{#each sorts as s}
									<DropdownMenu.Item class="flex items-center gap-2 cursor-pointer" onSelect={() => { sortOrder = s.value; resetPage(); }}>
										<span class="flex-1">{s.label}</span>
										{#if sortOrder === s.value}
											<Check size={12} class="text-primary" />
										{/if}
									</DropdownMenu.Item>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				{/if}

				<!-- Content area -->
				<div class="flex-1 min-h-0 overflow-y-auto">
					{#if view.kind === 'list'}
						<UserReportsList
							{service}
							category={activeCategory}
							state={activeState ? activeState : 'open'}
							sort={sortOrder}
							search={searchQuery}
							page={listPage}
							onSelect={(num) => (view = { kind: 'detail', issueNumber: num })}
							onPageChange={(p) => (listPage = p)}
							onCreateNew={() => (view = { kind: 'create' })}
						/>
					{:else if view.kind === 'detail'}
						<UserReportsDetail {service} issueNumber={view.issueNumber} onBack={handleBack} />
					{:else if view.kind === 'create'}
						<UserReportsCreate
							{service}
							onCreated={(issue) => (view = { kind: 'detail', issueNumber: issue.number })}
							onCancel={handleBack}
						/>
					{/if}
				</div>
			</QueryClientProvider>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
