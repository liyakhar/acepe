<script lang="ts">
import { Button } from "@acepe/ui/button";
import { COLOR_NAMES, Colors } from "@acepe/ui/colors";
import * as DropdownMenu from "@acepe/ui/dropdown-menu";
import { AppTopBar } from "@acepe/ui/app-layout";
import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Bug } from "phosphor-svelte";
import { Columns } from "phosphor-svelte";
import { DiscordLogo } from "phosphor-svelte";
import { DownloadSimple } from "phosphor-svelte";
import { GithubLogo } from "phosphor-svelte";
import { HardDrives } from "phosphor-svelte";
import { Kanban } from "phosphor-svelte";
import { Palette } from "phosphor-svelte";
import { Robot } from "phosphor-svelte";
import { Rows } from "phosphor-svelte";
import { Sidebar } from "phosphor-svelte";
import { SlidersHorizontal } from "phosphor-svelte";
import { Square } from "phosphor-svelte";
import { SquaresFour } from "phosphor-svelte";
import { Wrench } from "phosphor-svelte";
import type { Snippet } from "svelte";
import { getPanelStore } from "$lib/acp/store/index.js";
import type { ViewMode } from "$lib/acp/store/types.js";
import type { MainAppViewState } from "$lib/components/main-app-view/logic/main-app-view-state.svelte.js";
import type { UpdaterBannerState } from "$lib/components/main-app-view/logic/updater-state.js";
import { ThemeToggle } from "$lib/components/theme/index.js";
import VoiceDownloadProgress from "$lib/components/voice-download-progress.svelte";
import { Switch } from "$lib/components/ui/switch/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import * as m from "$lib/paraglide/messages.js";

interface Props {
	viewState: MainAppViewState;
	/** Optional snippet for add project/repository button (e.g. dropdown). Rendered in top bar left after decorations. */
	addProjectButton?: Snippet;
	updaterState?: UpdaterBannerState;
	onUpdateClick?: () => void;
	onRetryUpdateClick?: () => void;
	onDevShowUpdatePage?: () => void;
	onDevShowDesignSystem?: () => void;
	showSidebarToggle?: boolean;
}

let {
	viewState,
	addProjectButton,
	updaterState,
	onUpdateClick,
	onRetryUpdateClick,
	onDevShowUpdatePage,
	onDevShowDesignSystem,
	showSidebarToggle = true,
}: Props = $props();

const panelStore = getPanelStore();
const UPDATE_BUTTON_SEGMENT_COUNT = 16;
type DropdownMenuTriggerChildProps = NonNullable<
	DropdownMenuPrimitive.TriggerProps["child"]
> extends Snippet<[
	infer T,
]>
	? T
	: never;

const updateDownloadPercent = $derived(
	updaterState?.kind === "installing"
		? 100
		: updaterState?.kind === "downloading" && updaterState.totalBytes && updaterState.totalBytes > 0
		? Math.min(
				Math.round((updaterState.downloadedBytes / updaterState.totalBytes) * 100),
				100
			)
		: 0
);

const updateActionText = $derived(
	updaterState?.kind === "installing" ? m.update_installing() : "Updating"
);

const viewModes: { value: ViewMode; label: string; color: string }[] = [
	{ value: "single", label: "Single", color: Colors[COLOR_NAMES.PURPLE] },
	{ value: "project", label: "Project", color: Colors[COLOR_NAMES.ORANGE] },
	{ value: "multi", label: "Multi", color: "var(--success)" },
	{ value: "kanban", label: "Kanban", color: Colors[COLOR_NAMES.PINK] },
];

function preventDropdownItemSelection(event: Event): void {
	event.preventDefault();
}
</script>

<AppTopBar
	windowDraggable
	showTrafficLights={false}
	searchLabel={m.top_bar_command_palette()}
	{showSidebarToggle}
	showAddProject={!!addProjectButton}
	{addProjectButton}
	onToggleSidebar={() => viewState.setSidebarOpen(!viewState.sidebarOpen)}
	onSearch={() => (viewState.commandPaletteOpen = true)}
	onSettings={() => viewState.toggleSettings()}
	showAvatar={false}
	showRightSectionLeadingBorder={panelStore.viewMode !== "kanban"}
>
	{#snippet extraLeftActions()}
		{#if updaterState?.kind === "available"}
			<div class="flex items-center pl-2">
			<Button variant="headerAction" size="headerAction" onclick={onUpdateClick}>
				{#snippet children()}
					Update
				{/snippet}
			</Button>
			</div>
		{:else if updaterState?.kind === "downloading" || updaterState?.kind === "installing"}
			<div class="flex items-center pl-2">
			<Button variant="headerAction" size="headerAction" disabled>
				{#snippet children()}
					<div class="flex items-center gap-2">
						<span>{updateActionText}</span>
						<div class="w-[52px]">
							<VoiceDownloadProgress
								ariaLabel={updaterState?.kind === "installing"
									? m.update_installing()
									: m.update_downloading()}
								compact={true}
								label=""
								percent={updateDownloadPercent}
								segmentCount={UPDATE_BUTTON_SEGMENT_COUNT}
								showPercent={false}
							/>
						</div>
					</div>
					{/snippet}
				</Button>
			</div>
		{:else if updaterState?.kind === "error"}
			<div class="flex items-center pl-2">
				<Button variant="headerAction" size="headerAction" onclick={onRetryUpdateClick}>
					{#snippet children()}
						Retry
					{/snippet}
				</Button>
			</div>
		{/if}
	{/snippet}
	{#snippet extraRightActions()}
		{#snippet layoutControl()}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props }: DropdownMenuTriggerChildProps)}
						<Tooltip.Root>
							<Tooltip.Trigger>
								<button
									{...props}
									class="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
									title="Layout"
									aria-label="Layout Settings"
								>
									<SlidersHorizontal class="size-4" weight="fill" />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Content>Layout</Tooltip.Content>
						</Tooltip.Root>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="min-w-[160px] p-0 text-[11px]">
					<DropdownMenu.Group>
						<DropdownMenu.GroupHeading
							class="px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/20"
							>Interface</DropdownMenu.GroupHeading
						>
						<DropdownMenu.Item
							class="cursor-pointer rounded-none border-b border-border/20 px-2 py-1 text-[11px]"
							onSelect={preventDropdownItemSelection}
							onclick={() => viewState.setSidebarOpen(!viewState.sidebarOpen)}
						>
							<Sidebar class="size-4" weight="fill" />
							<span class="flex-1">Sidebar</span>
							<Switch
								checked={viewState.sidebarOpen}
								class="data-[state=checked]:bg-foreground/50 data-[state=unchecked]:bg-input/60 h-3.5 w-6 [&_[data-slot=switch-thumb]]:size-2.5 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[11px]"
							/>
						</DropdownMenu.Item>
						<DropdownMenu.Item
							class="cursor-pointer rounded-none border-b border-border/20 px-2 py-1 text-[11px]"
							onSelect={preventDropdownItemSelection}
							onclick={() => viewState.setTopBarVisible(!viewState.topBarVisible)}
						>
							<Rows class="size-4" weight="fill" />
							<span class="flex-1">Tab Bar</span>
							<Switch
								checked={viewState.topBarVisible}
								class="data-[state=checked]:bg-foreground/50 data-[state=unchecked]:bg-input/60 h-3.5 w-6 [&_[data-slot=switch-thumb]]:size-2.5 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[11px]"
							/>
						</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Group>
						<DropdownMenu.GroupHeading
							class="px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/20"
							>View</DropdownMenu.GroupHeading
						>
						<div class="flex items-stretch gap-0 rounded-md bg-muted/50 mx-2 my-1.5">
							{#each viewModes as mode (mode.value)}
								{@const isActive = panelStore.viewMode === mode.value}
								<button
									class="flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer {isActive ? 'bg-muted text-foreground/80' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => panelStore.setViewMode(mode.value)}
								>
									{#if mode.value === "single"}
										<Square class="size-3" weight="fill" style="color: {mode.color}" />
									{:else if mode.value === "project"}
										<Columns class="size-3" weight="fill" style="color: {mode.color}" />
									{:else if mode.value === "multi"}
										<SquaresFour class="size-3" weight="fill" style="color: {mode.color}" />
									{:else}
										<Kanban class="size-3" weight="fill" style="color: {mode.color}" />
									{/if}
									{mode.label}
								</button>
							{/each}
						</div>
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/snippet}
		{#if panelStore.viewMode === "kanban"}
			<div class="flex items-center">
				<div class="flex items-center pl-2 pr-2">
					<Button
						variant="headerAction"
						size="headerAction"
						class="gap-2 border-transparent hover:border-transparent"
						onclick={() => viewState.handleNewThread()}
					>
						<Robot weight="fill" class="h-3.5 w-3.5" style="color: {Colors.purple}" />
						<span>New Agent</span>
					</Button>
				</div>
				<div class="flex items-center">
					{@render layoutControl()}
				</div>
			</div>
		{:else}
			{@render layoutControl()}
		{/if}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<button
					class="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					title="Feedback"
					aria-label="Feedback"
					onclick={() => openUrl("https://github.com/flazouh/acepe/issues")}
				>
					<Bug weight="fill" class="size-4" style="color: #FF5D5A" />
				</button>
			</Tooltip.Trigger>
			<Tooltip.Content>Feedback</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<button
					class="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					title="Join Discord"
					aria-label="Discord"
					onclick={() => openUrl("https://discord.gg/5YhW7T7qhS")}
				>
					<DiscordLogo class="size-4" style="color: #6C75E8" weight="fill" />
				</button>
			</Tooltip.Trigger>
			<Tooltip.Content>Join Discord</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<button
					class="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					title="GitHub"
					aria-label="GitHub"
					onclick={() => openUrl("https://github.com/flazouh/acepe")}
				>
					<GithubLogo class="size-4" weight="fill" />
				</button>
			</Tooltip.Trigger>
			<Tooltip.Content>GitHub</Tooltip.Content>
		</Tooltip.Root>
		<ThemeToggle />
		{#if import.meta.env.DEV && (onDevShowUpdatePage || onDevShowDesignSystem)}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props }: DropdownMenuTriggerChildProps)}
						<Tooltip.Root>
							<Tooltip.Trigger>
								<button
									{...props}
									class="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
									title="Dev Tools"
									aria-label="Dev Tools"
								>
									<Wrench class="size-4" weight="fill" style="color: #FAD83C" />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Content>Dev Tools</Tooltip.Content>
						</Tooltip.Root>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="min-w-[160px] p-0 text-[11px]">
					<DropdownMenu.Group>
						<DropdownMenu.GroupHeading
							class="px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/20"
						>Dev Overlays</DropdownMenu.GroupHeading>
						{#if onDevShowUpdatePage}
							<DropdownMenu.Item
								class="cursor-pointer rounded-none px-2 py-1 text-[11px]"
								onclick={onDevShowUpdatePage}
							>
								<DownloadSimple class="size-4" weight="fill" />
								<span>Update Page</span>
							</DropdownMenu.Item>
						{/if}
						{#if onDevShowDesignSystem}
							<DropdownMenu.Item
								class="cursor-pointer rounded-none px-2 py-1 text-[11px]"
								onclick={onDevShowDesignSystem}
							>
								<Palette class="size-4" weight="fill" />
								<span>Design System</span>
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<button
					class="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					title="Database Manager"
					aria-label="Database Manager"
					onclick={() => viewState.toggleSqlStudio()}
				>
					<HardDrives weight="fill" class="size-4" />
				</button>
			</Tooltip.Trigger>
			<Tooltip.Content>Database Manager</Tooltip.Content>
		</Tooltip.Root>
	{/snippet}
</AppTopBar>
