<script lang="ts">
import { FilePathBadge } from "@acepe/ui/file-path-badge";
import {
	ArrowsLeftRight,
	File,
	GlobeHemisphereWest,
	MagnifyingGlass,
	PencilSimple,
	ShieldWarning,
	Terminal,
	Trash,
} from "phosphor-svelte";
import { getPermissionStore } from "../../store/permission-store.svelte.js";
import { getSessionStore } from "../../store/session-store.svelte.js";
import type { ToolCall } from "../../types/tool-call.js";
import type { PermissionRequest } from "../../types/permission.js";
import { Colors, COLOR_NAMES } from "../../utils/colors.js";
import VoiceDownloadProgress from "$lib/components/voice-download-progress.svelte";
import PermissionActionBar from "./permission-action-bar.svelte";
import ToolCallEdit from "./tool-call-edit.svelte";
import { extractCompactPermissionDisplay } from "./permission-display.js";
import {
	isPermissionRepresentedByToolCall,
	visiblePermissionsForSessionBar,
} from "./permission-visibility.js";

interface Props {
	sessionId: string;
	permission?: PermissionRequest | null;
	isFullscreen?: boolean;
	projectPath?: string | null;
	showCommandWhenRepresented?: boolean;
	showCompactEditPreview?: boolean;
}

let {
	sessionId,
	permission = null,
	isFullscreen = false,
	projectPath = null,
	showCommandWhenRepresented = false,
	showCompactEditPreview = false,
}: Props = $props();

const permissionStore = getPermissionStore();
const sessionStore = getSessionStore();

const pendingPermissions = $derived.by(() => {
	if (permission) {
		return [permission];
	}

	const entries = sessionStore.getEntries(sessionId);
	return visiblePermissionsForSessionBar(permissionStore.getForSession(sessionId), entries);
});
const currentPermission = $derived(pendingPermissions.length > 0 ? pendingPermissions[0] : null);
const isRepresentedByToolCall = $derived.by(() => {
	if (!currentPermission) {
		return false;
	}

	return isPermissionRepresentedByToolCall(
		currentPermission,
		sessionId,
		sessionStore.getOperationStore(),
		sessionStore.getEntries(sessionId)
	);
});
const sessionProgress = $derived(permissionStore.getSessionProgress(sessionId));
const hotState = $derived(sessionStore.getHotState(sessionId));
const progressLabel = $derived.by(() => {
	if (!sessionProgress) {
		return "";
	}

	const currentStep =
		sessionProgress.completed + 1 <= sessionProgress.total
			? sessionProgress.completed + 1
			: sessionProgress.total;
	return `Permission ${currentStep} of ${sessionProgress.total}`;
});
const currentToolCall = $derived.by((): ToolCall | null => {
	const toolCallId = currentPermission?.tool?.callID;
	if (!toolCallId) {
		return null;
	}

	const entries = sessionStore.getEntries(sessionId);
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry.type === "tool_call" && entry.message.id === toolCallId) {
			return entry.message;
		}
	}

	return null;
});
const showEditPreview = $derived(
	showCompactEditPreview && currentToolCall !== null && currentToolCall.kind === "edit"
);
</script>


{#if currentPermission}
	{@const compactDisplay = extractCompactPermissionDisplay(currentPermission, projectPath)}
	{@const kind = compactDisplay.kind}
	{@const command =
		showCommandWhenRepresented || !isRepresentedByToolCall ? compactDisplay.command : null}
	{@const filePath = compactDisplay.filePath}
	{@const verb = compactDisplay.label}
	{@const purpleColor = Colors[COLOR_NAMES.PURPLE]}
	<div class="w-full">
		<div
			class="w-full flex flex-col gap-1.5 px-3 py-1 rounded-md border border-border bg-muted/30 permission-card-enter {command ? 'rounded-b-none border-b-0' : ''}"
		>
			<div class="flex w-full items-start justify-between gap-1.5">
				<div class="flex min-w-0 w-full items-center gap-1.5 text-[0.6875rem]">
					<span
						class="inline-flex shrink-0 items-center justify-center"
						aria-label={verb}
						title={verb}
					>
						{#if kind === "edit"}
							<PencilSimple weight="fill" size={11} class="shrink-0" style="color: {purpleColor}" />
						{:else if kind === "read"}
							<File weight="fill" size={11} class="shrink-0" style="color: {purpleColor}" />
						{:else if kind === "execute"}
							<Terminal weight="fill" size={11} class="shrink-0" style="color: {purpleColor}" />
						{:else if kind === "search"}
							<MagnifyingGlass weight="fill" size={11} class="shrink-0" style="color: {purpleColor}" />
						{:else if kind === "fetch" || kind === "web_search"}
							<GlobeHemisphereWest weight="fill" size={11} class="shrink-0" style="color: {purpleColor}" />
						{:else if kind === "delete"}
							<Trash weight="fill" size={11} class="shrink-0" style="color: {purpleColor}" />
						{:else if kind === "move"}
							<ArrowsLeftRight weight="fill" size={11} class="shrink-0" style="color: {purpleColor}" />
						{:else}
							<ShieldWarning weight="fill" size={10} class="shrink-0" style="color: {purpleColor}" />
						{/if}
					</span>
					<span class="shrink-0 text-[10px] font-medium text-muted-foreground">{verb}</span>
					{#if filePath && !showEditPreview}
						<div class="min-w-0 flex-1 cursor-pointer">
							<FilePathBadge {filePath} interactive={false} />
						</div>
					{/if}
				</div>

				{#if sessionProgress}
					<div class="permission-tally-bar flex shrink-0 items-center self-center">
						<VoiceDownloadProgress
							ariaLabel={progressLabel}
							compact={true}
							label=""
							percent={sessionProgress.total > 0 ? Math.round(((sessionProgress.completed + 1) / sessionProgress.total) * 100) : 0}
							segmentCount={sessionProgress.total}
							showPercent={false}
						/>
					</div>
				{/if}
			</div>

			<div class="flex w-full items-center">
				<PermissionActionBar permission={currentPermission} hideHeader />
			</div>
			{#if showEditPreview && currentToolCall}
				<div class="overflow-hidden rounded-md border border-border/60 bg-background/60">
					<ToolCallEdit
						toolCall={currentToolCall}
						turnState={hotState ? hotState.turnState : undefined}
						projectPath={projectPath ?? undefined}
						pendingPermission={currentPermission}
						defaultExpanded={false}
					/>
				</div>
			{/if}
		</div>

			<!-- Command display for execute permissions -->
			{#if command}
				<div class="max-h-[72px] overflow-y-auto rounded-b-md border border-border border-t-0 bg-muted/30 px-2 py-0.5">
					<code class="block min-w-0 whitespace-pre-wrap break-words font-mono text-[10px] text-foreground/70"
						>$ {command}</code
					>
				</div>
			{/if}

	</div>
{/if}

<style>
	.permission-card-enter {
		animation: slideUp 0.2s ease-out;
	}

	.permission-tally-bar {
		min-height: 1rem;
	}

	.permission-tally-bar :global(.voice-download-progress.compact) {
		gap: 2px;
	}

	.permission-tally-bar :global(.voice-download-segments) {
		grid-auto-columns: 3px;
		gap: 2px;
		height: 9px;
	}

	.permission-tally-bar :global(.voice-download-segment) {
		width: 3px;
		height: 9px;
		border-radius: 1.5px;
	}

	.permission-tally-bar :global(.voice-download-segment-vertical:not(.filled)) {
		height: 6px;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
