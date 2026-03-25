<!--
  VoiceModelMenu - Three-dot (more vertical) dropdown next to the mic button.
  Shows available voice models with selection, download, and delete actions.
  Uses the shared DropdownMenu primitives from @acepe/ui.
-->
<script lang="ts">
import { PillButton } from "@acepe/ui";
import * as DropdownMenu from "@acepe/ui/dropdown-menu";
import Check from "phosphor-svelte/lib/Check";
import DotsThreeVertical from "phosphor-svelte/lib/DotsThreeVertical";
import DownloadSimple from "phosphor-svelte/lib/DownloadSimple";

import VoiceDownloadProgress from "$lib/components/voice-download-progress.svelte";
import * as m from "$lib/paraglide/messages.js";
import type { VoiceSettingsStore } from "$lib/stores/voice-settings-store.svelte.js";

interface Props {
	voiceSettingsStore: VoiceSettingsStore;
}

const { voiceSettingsStore }: Props = $props();

let menuOpen = $state(false);

function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}
	return `${Math.round(bytes / (1024 * 1024))} MB`;
}
</script>

<DropdownMenu.Root bind:open={menuOpen}>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				type="button"
				class="voice-more-btn flex items-center justify-center rounded-full transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				class:voice-more-open={menuOpen}
				aria-label={m.voice_model_menu_label()}
				{...props}
			>
				<DotsThreeVertical class="h-3.5 w-3.5" weight="bold" />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" side="top" sideOffset={8} class="min-w-[220px]">
		<DropdownMenu.Group>
			<DropdownMenu.GroupHeading>
				{m.voice_model_menu_label()}
			</DropdownMenu.GroupHeading>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		{#if voiceSettingsStore.modelsLoading}
			<div class="px-2 py-1.5 text-[11px] text-muted-foreground">
				{m.voice_settings_loading_models()}
			</div>
		{:else}
			{#each voiceSettingsStore.models as model (model.id)}
				{@const isSelected = voiceSettingsStore.selectedModelId === model.id}
				{@const isDownloading = voiceSettingsStore.downloadProgressModelId === model.id}

				{#if model.is_downloaded}
					<!-- Downloaded: selectable menu item -->
					<DropdownMenu.Item
						onSelect={() => {
							void voiceSettingsStore.setSelectedModelId(model.id);
						}}
					>
						<div class="flex w-full items-center gap-2">
							<Check
								class={isSelected
									? "size-3 shrink-0 text-foreground"
									: "size-3 shrink-0 text-transparent"}
								weight="bold"
							/>
							<div class="flex flex-1 items-center min-w-0">
								<span class="truncate text-[12px] font-medium">
									{model.name}
								</span>
							</div>
							<span class="text-[10px] text-muted-foreground/40 shrink-0">
								{formatBytes(model.size_bytes)}
							</span>
						</div>
					</DropdownMenu.Item>
				{:else}
					<!-- Not downloaded / downloading: plain row so buttons are clickable -->
					<div
						class="model-row relative z-10 flex items-center gap-2 px-2 py-1 text-[11px] font-medium select-none border-b border-border/20 last:border-b-0"
					>
						<Check class="size-3 shrink-0 text-transparent" weight="bold" />
						<div class="flex flex-1 items-center min-w-0">
							<span class="truncate text-[12px] font-medium text-muted-foreground">
								{model.name}
							</span>
						</div>

						{#if isDownloading}
							<VoiceDownloadProgress
								ariaLabel={`Downloading ${model.name}`}
								compact={true}
								label=""
								percent={voiceSettingsStore.downloadPercent}
								segmentCount={20}
								showPercent={false}
							/>
						{:else}
							<PillButton
								variant="invert"
								size="xs"
								onclick={(e: MouseEvent) => {
									e.stopPropagation();
									void voiceSettingsStore.downloadModel(model.id);
								}}
							>
								{#snippet children()}
									<span class="font-mono">{formatBytes(model.size_bytes)}</span>
								{/snippet}
								{#snippet trailingIcon()}
									<DownloadSimple class="size-2.5" weight="bold" />
								{/snippet}
							</PillButton>
						{/if}
					</div>
				{/if}
			{/each}
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>

<style>
	.voice-more-btn {
		width: 22px;
		height: 22px;
		color: var(--muted-foreground);
		opacity: 0;
		pointer-events: none;
		transition: opacity 150ms ease-out, color 150ms ease-out, transform 150ms ease-out;
	}

	/* Show when menu is open */
	.voice-more-open {
		opacity: 1;
		pointer-events: auto;
	}

	/* Show on parent hover — the parent container controls this via :hover */
	:global(.voice-controls:hover) .voice-more-btn {
		opacity: 1;
		pointer-events: auto;
	}

	.voice-more-btn:hover {
		color: var(--foreground);
		transform: scale(1.08);
	}
</style>
