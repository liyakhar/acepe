<script lang="ts">
import { AgentToolCard } from "@acepe/ui/agent-panel";
import * as DropdownMenu from "@acepe/ui/dropdown-menu";
import {
	EmbeddedPanelHeader,
	HeaderActionCell,
	HeaderCell,
	HeaderTitleCell,
} from "@acepe/ui/panel-header";
import CaretDown from "phosphor-svelte/lib/CaretDown";
import Check from "phosphor-svelte/lib/Check";
import DownloadSimple from "phosphor-svelte/lib/DownloadSimple";
import Microphone from "phosphor-svelte/lib/Microphone";
import Trash from "phosphor-svelte/lib/Trash";

import VoiceDownloadProgress from "$lib/components/voice-download-progress.svelte";
import { Switch } from "$lib/components/ui/switch/index.js";
import * as m from "$lib/paraglide/messages.js";
import { getVoiceSettingsStore } from "$lib/stores/voice-settings-store.svelte.js";

import SettingsSectionHeader from "../settings-section-header.svelte";

const voiceSettingsStore = getVoiceSettingsStore();

const selectedLanguageLabel = $derived.by(() => {
	if (voiceSettingsStore.language === "auto") {
		return m.voice_settings_auto_detect();
	}

	const selectedLanguage =
		voiceSettingsStore.languages.find((language) => language.code === voiceSettingsStore.language) ??
		null;

	return selectedLanguage ? selectedLanguage.name : m.voice_settings_auto_detect();
});

const selectedModelIsEnglishOnly = $derived.by(() => {
	const selectedModel = voiceSettingsStore.selectedModel;
	if (!selectedModel) {
		return false;
	}

	return selectedModel.is_english_only;
});

function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}

	return `${Math.round(bytes / (1024 * 1024))} MB`;
}
</script>

<div class="w-full space-y-3">
	<SettingsSectionHeader
		title={m.settings_voice()}
		description={m.voice_settings_enable_description()}
	/>

	<!-- Voice enable + language card -->
	<AgentToolCard variant="muted">
		<EmbeddedPanelHeader>
			<HeaderCell withDivider={false}>
				<Microphone class="size-3.5 shrink-0 text-muted-foreground" weight="fill" />
			</HeaderCell>
			<HeaderTitleCell compactPadding>
				<span class="truncate text-[13px] font-semibold text-foreground">
					{m.voice_settings_enable_label()}
				</span>
			</HeaderTitleCell>
			<HeaderActionCell withDivider>
				<div class="flex items-center h-7 px-1.5" data-header-control>
					<Switch
						checked={voiceSettingsStore.enabled}
						onCheckedChange={(checked) => {
							void voiceSettingsStore.setEnabled(checked === true);
						}}
					/>
				</div>
			</HeaderActionCell>
		</EmbeddedPanelHeader>

		<!-- Language selector row -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button
						type="button"
						class="flex items-center gap-1.5 h-7 w-full px-2.5 text-muted-foreground hover:bg-accent/50 transition-colors"
						{...props}
					>
						<span class="text-[12px] text-muted-foreground/60">
							{m.voice_settings_language_label()}
						</span>
						<span class="ml-auto truncate text-[13px] font-medium text-foreground/70">
							{selectedLanguageLabel}
						</span>
						<CaretDown class="size-2.5 shrink-0 opacity-40" weight="bold" />
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-[240px]">
				<DropdownMenu.Item onclick={() => void voiceSettingsStore.setLanguage("auto")}>
					<div class="flex items-center gap-2">
						<Check
							class={voiceSettingsStore.language === "auto"
								? "size-3 text-foreground"
								: "size-3 text-transparent"}
							weight="bold"
						/>
						<span class="text-[13px]">{m.voice_settings_auto_detect()}</span>
					</div>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				{#each voiceSettingsStore.languages as language (language.code)}
					{@const isUnavailable = selectedModelIsEnglishOnly && language.code !== "en"}
					<DropdownMenu.Item
						onclick={() => {
							if (isUnavailable) {
								return;
							}

							void voiceSettingsStore.setLanguage(language.code);
						}}
					>
						<div class="flex items-center gap-2">
							<Check
								class={voiceSettingsStore.language === language.code
									? "size-3 text-foreground"
									: "size-3 text-transparent"}
								weight="bold"
							/>
							<span class:isUnavailable class="text-[13px]">{language.name}</span>
						</div>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		{#if selectedModelIsEnglishOnly}
			<div class="flex items-center h-6 px-2.5 border-t border-border/30 text-[11px] text-muted-foreground/55">
				English-only model uses English transcription.
			</div>
		{/if}
	</AgentToolCard>

	<!-- Models card -->
	<AgentToolCard variant="muted">
		<EmbeddedPanelHeader class="!border-b-0">
			<HeaderCell withDivider={false}>
				<div class="size-3.5 shrink-0 rounded-sm bg-muted-foreground/20 flex items-center justify-center">
					<span class="text-[8px] font-bold text-muted-foreground">AI</span>
				</div>
			</HeaderCell>
			<HeaderTitleCell compactPadding>
				<span class="truncate text-[13px] font-semibold text-foreground">
					{m.voice_settings_models_title()}
				</span>
			</HeaderTitleCell>
		</EmbeddedPanelHeader>

		{#if voiceSettingsStore.modelsLoading}
			<div class="flex items-center h-7 px-2.5 text-[12px] text-muted-foreground/60">
				{m.voice_settings_loading_models()}
			</div>
		{:else}
			<div role="radiogroup" aria-label={m.voice_settings_models_title()}>
				{#each voiceSettingsStore.models as model (model.id)}
					{@const isSelected = voiceSettingsStore.selectedModelId === model.id}
					{@const isDownloading = voiceSettingsStore.downloadProgressModelId === model.id}

					<div class="flex items-center gap-2 h-7 w-full px-2.5 border-t border-border/30">
						<!-- Selectable area: radio + name + badges -->
						<button
							type="button"
							role="radio"
							aria-checked={isSelected}
							class="flex items-center gap-2 flex-1 min-w-0 h-full text-left hover:bg-accent/50 -mx-2.5 px-2.5 transition-colors"
							onclick={() => void voiceSettingsStore.setSelectedModelId(model.id)}
						>
							<!-- Radio indicator -->
							<div
								class="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border {isSelected ? 'border-foreground' : 'border-muted-foreground/40'}"
							>
								{#if isSelected}
									<div class="h-1.5 w-1.5 rounded-full bg-foreground"></div>
								{/if}
							</div>

							<!-- Model name -->
							<span
								class="truncate text-[13px] font-medium {isSelected ? 'text-foreground' : 'text-foreground/70'}"
							>
								{model.name}
							</span>

							<!-- Language badge -->
							<span class="text-[11px] text-muted-foreground/50">
								{#if model.is_english_only}
									EN
								{:else}
									{m.voice_settings_model_multilingual()}
								{/if}
							</span>

							<!-- Size -->
							<span class="ml-auto text-[11px] text-muted-foreground/40">
								{formatBytes(model.size_bytes)}
							</span>
						</button>

						<!-- Action area (outside the radio button) -->
						{#if isDownloading}
							<VoiceDownloadProgress
								ariaLabel={`Downloading ${model.name}`}
								compact={false}
								label=""
								percent={voiceSettingsStore.downloadPercent}
								segmentCount={20}
							/>
						{:else if model.is_downloaded}
							<button
								type="button"
								class="group flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-destructive"
								title={m.voice_settings_delete()}
								onclick={() => void voiceSettingsStore.deleteModel(model.id)}
							>
								<Trash class="size-3 hidden group-hover:block" weight="fill" />
								<Trash class="size-3 block group-hover:hidden" weight="regular" />
							</button>
						{:else}
							<button
								type="button"
								class="group flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-foreground"
								title={m.voice_settings_download()}
								onclick={() => void voiceSettingsStore.downloadModel(model.id)}
							>
								<DownloadSimple class="size-3 hidden group-hover:block" weight="fill" />
								<DownloadSimple class="size-3 block group-hover:hidden" weight="regular" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</AgentToolCard>
</div>

<style>
	.isUnavailable {
		opacity: 0.4;
	}
</style>
