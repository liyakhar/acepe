<script lang="ts">
	import {
		Button,
		CloseAction,
		Dialog,
		DialogContent,
		EmbeddedPanelHeader,
		HeaderActionCell,
		KanbanBoard,
		KanbanCard,
		KanbanQuestionFooter,
		type KanbanCardData,
		type KanbanColumnGroup,
		type KanbanQuestionData,
		type KanbanToolData,
	} from "@acepe/ui";
	import { Colors } from "@acepe/ui/colors";
	import Robot from "phosphor-svelte/lib/Robot";
	import AgentInput from "$lib/acp/components/agent-input/agent-input-ui.svelte";
	import AgentSelector from "$lib/acp/components/agent-selector.svelte";
	import ProjectSelector from "$lib/acp/components/project-selector.svelte";
	import { WorktreeToggleControl } from "$lib/acp/components/worktree-toggle/index.js";
	import { getWorktreeDefaultStore } from "$lib/acp/components/worktree-toggle/worktree-default-store.svelte.js";
	import { loadWorktreeEnabled } from "$lib/acp/components/worktree-toggle/worktree-storage.js";
	import type { QueueItem } from "$lib/acp/store/queue/types.js";
	import type { QueueSectionId } from "$lib/acp/store/queue/queue-section-utils.js";
	import type { AgentInfo } from "$lib/acp/logic/agent-manager.js";
	import { getAgentIcon } from "$lib/acp/constants/thread-list-constants.js";
	import { normalizeTitleForDisplay } from "$lib/acp/store/session-title-policy.js";
	import { formatTimeAgo } from "$lib/acp/utils/time-utils.js";
	import { getToolCompactDisplayText } from "$lib/acp/registry/tool-kind-ui-registry.js";
	import PermissionActionBar from "$lib/acp/components/tool-calls/permission-action-bar.svelte";
	import {
		getAgentPreferencesStore,
		getAgentStore,
		getPanelStore,
		getPermissionStore,
		getQueueStore,
		getQuestionStore,
	} from "$lib/acp/store/index.js";
	import type { Project, ProjectManager } from "$lib/acp/logic/project-manager.svelte.js";
	import { getQuestionSelectionStore } from "$lib/acp/store/question-selection-store.svelte.js";
	import { useTheme } from "$lib/components/theme/context.svelte.js";
	import { getQueueItemToolDisplay } from "$lib/acp/components/queue/queue-item-display.js";
	import {
		canSendWithoutSession,
		resolveEmptyStateAgentId,
		resolveEmptyStateWorktreePending,
		resolveEmptyStateWorktreePendingForProjectChange,
	} from "./logic/empty-state-send-state.js";
	import {
		ensureSpawnableAgentSelected,
		getSpawnableSessionAgents,
	} from "../../logic/spawnable-agents.js";
	import { resolveKanbanNewSessionDefaults } from "./kanban-new-session-dialog-state.js";
	import * as m from "$lib/paraglide/messages.js";

	interface Props {
		projectManager: ProjectManager;
	}

	let { projectManager }: Props = $props();

	const panelStore = getPanelStore();
	const agentStore = getAgentStore();
	const agentPreferencesStore = getAgentPreferencesStore();
	const queueStore = getQueueStore();
	const permissionStore = getPermissionStore();
	const questionStore = getQuestionStore();
	const selectionStore = getQuestionSelectionStore();
	const themeState = useTheme();
	const worktreeDefaultStore = getWorktreeDefaultStore();

	const KANBAN_NEW_SESSION_PANEL_ID = "kanban-new-session-dialog";

	let newSessionOpen = $state(false);
	let selectedProjectPath = $state<string | null>(null);
	let selectedAgentId = $state<string | null>(null);
	let activeWorktreePath = $state<string | null>(null);
	let worktreePending = $state(false);

	const globalWorktreeDefault = $derived(worktreeDefaultStore.globalDefault);
	const projects = $derived(projectManager.projects);
	const availableAgents = $derived.by((): AgentInfo[] => {
		return getSpawnableSessionAgents(agentStore.agents, agentPreferencesStore.selectedAgentIds).map(
			(agent) => ({
				id: agent.id,
				name: agent.name,
				icon: agent.icon,
				availability_kind: agent.availability_kind,
			})
		);
	});
	const availableAgentIds = $derived(availableAgents.map((agent) => agent.id));
	const effectiveAgentId = $derived(
		resolveEmptyStateAgentId({
			selectedAgentId,
			availableAgentIds,
		})
	);
	const selectedProject = $derived.by((): Project | null => {
		if (!selectedProjectPath) {
			return null;
		}

		for (const project of projects) {
			if (project.path === selectedProjectPath) {
				return project;
			}
		}

		return null;
	});
	const showProjectPicker = $derived(projects.length > 1);
	const canShowNewSessionInput = $derived(projects.length > 0 && availableAgents.length > 0);
	const effectiveWorktreePending = $derived(worktreePending && activeWorktreePath === null);
	const canSendFromNewSession = $derived(
		canSendWithoutSession({
			projectPath: selectedProject ? selectedProject.path : null,
			selectedAgentId: effectiveAgentId,
		})
	);
	const createDisabled = $derived(!canShowNewSessionInput);

	const SECTION_LABELS: Record<QueueSectionId, () => string> = {
		answer_needed: () => m.queue_group_answer_needed(),
		planning: () => m.queue_group_planning(),
		working: () => m.queue_group_working(),
		finished: () => m.queue_group_finished(),
		error: () => m.queue_group_error(),
	};

	const SECTION_ORDER: readonly QueueSectionId[] = [
		"answer_needed",
		"planning",
		"working",
		"finished",
	];

	// NOTE: SECTION_LABELS is also defined in queue-section.svelte. Both are
	// thin i18n wrappers that cannot be extracted without coupling the store
	// layer to Paraglide runtime. Duplication is acceptable here.

	function mapItemToCard(item: QueueItem): KanbanCardData {
		const toolDisplay = getQueueItemToolDisplay({
			activityKind: item.state.activity.kind,
			currentStreamingToolCall: item.currentStreamingToolCall,
			currentToolKind: item.currentToolKind,
			lastToolCall: item.lastToolCall,
			lastToolKind: item.lastToolKind,
		});

		const activityText: string | null = (() => {
			if (item.state.activity.kind === "thinking") return "Thinking…";
			if (toolDisplay) {
				return getToolCompactDisplayText(
					toolDisplay.toolKind,
					toolDisplay.toolCall,
					toolDisplay.turnState
				);
			}
			return null;
		})();

		const isStreaming =
			item.state.activity.kind === "streaming" || item.state.activity.kind === "thinking";
		const normalizedTitle = normalizeTitleForDisplay(item.title ? item.title : "");
		const timeAgo = formatTimeAgo(item.lastActivityAt);

		const latestTool: KanbanToolData | null = (() => {
			if (!toolDisplay) return null;
			const tc = toolDisplay.toolCall;
			const displayTitle = getToolCompactDisplayText(
				toolDisplay.toolKind,
				tc,
				toolDisplay.turnState
			);
			const filePath =
				tc.locations && tc.locations.length > 0 && tc.locations[0]
					? tc.locations[0].path
					: undefined;
			const status = tc.status === "completed" ? "done" as const
				: tc.status === "failed" ? "error" as const
				: tc.status === "in_progress" ? "running" as const
				: "pending" as const;
			return {
				id: tc.id,
				kind: toolDisplay.toolKind ? toolDisplay.toolKind : undefined,
				title: displayTitle ? displayTitle : tc.name,
				filePath,
				status,
			};
		})();

		return {
			id: item.sessionId,
			title: normalizedTitle ? normalizedTitle : null,
			agentIconSrc: getAgentIcon(item.agentId, themeState.effectiveTheme),
			agentLabel: item.agentId,
			projectName: item.projectName,
			projectColor: item.projectColor,
			timeAgo: timeAgo ? timeAgo : "",
			activityText,
			isStreaming,
			modeId: item.currentModeId,
			diffInsertions: item.insertions,
			diffDeletions: item.deletions,
			errorText: item.state.connection === "error" ? "Connection error" : null,
			todoProgress: item.todoProgress
				? { current: item.todoProgress.current, total: item.todoProgress.total }
				: null,
			latestTool,
			toolCalls: [],
		};
	}

	function getQuestionData(item: QueueItem): KanbanQuestionData | null {
		if (item.state.pendingInput.kind !== "question" || !item.pendingQuestion) return null;
		// TODO: support multi-question flows once the UI supports more than questions[0]
		const q = item.pendingQuestion.questions[0];
		if (!q) return null;
		const callId = item.pendingQuestion.tool?.callID;
		const questionId = callId ? callId : item.pendingQuestion.id ? item.pendingQuestion.id : "";
		const rawOptions = q.options;
		const options = (rawOptions ? rawOptions : []).map((opt) => ({
			label: opt.label,
			selected: selectionStore.isOptionSelected(questionId, 0, opt.label),
		}));
		const hasSelections = selectionStore.hasSelections(questionId, 0);
		return {
			questionText: q.question,
			options,
			canSubmit: hasSelections,
		};
	}

	const groups = $derived.by((): readonly KanbanColumnGroup[] => {
		return SECTION_ORDER.map((sectionId) => {
			const section = queueStore.sections.find((section) => section.id === sectionId);
			return {
				id: sectionId,
				label: SECTION_LABELS[sectionId](),
				items: section ? section.items.map(mapItemToCard) : [],
			};
		});
	});

	const itemLookup = $derived.by(() => {
		const map = new Map<string, QueueItem>();
		for (const section of queueStore.sections) {
			for (const item of section.items) {
				map.set(item.sessionId, item);
			}
		}
		return map;
	});

	function handleCardClick(cardId: string) {
		const item = itemLookup.get(cardId);
		if (!item || !item.panelId) return;
		if (item.projectPath) {
			panelStore.setFocusedViewProjectPath(item.projectPath);
		}
		panelStore.movePanelToFront(item.panelId);
		panelStore.setViewMode("single");
		panelStore.focusAndSwitchToPanel(item.panelId);
	}

	function resetNewSessionState(): void {
		const defaults = resolveKanbanNewSessionDefaults({
			projects,
			focusedProjectPath: panelStore.focusedViewProjectPath,
			availableAgents,
			selectedAgentIds: agentPreferencesStore.selectedAgentIds,
		});

		selectedProjectPath = defaults.projectPath;
		selectedAgentId = defaults.agentId;
		activeWorktreePath = null;
		worktreePending = defaults.projectPath
			? resolveEmptyStateWorktreePending({
				activeWorktreePath: null,
				globalWorktreeDefault,
				loadEnabled: loadWorktreeEnabled,
				panelId: KANBAN_NEW_SESSION_PANEL_ID,
			})
			: false;
	}

	function handleNewSessionOpenChange(nextOpen: boolean): void {
		newSessionOpen = nextOpen;
		if (!nextOpen) {
			return;
		}

		resetNewSessionState();
	}

	function handleNewSessionAgentChange(agentId: string): void {
		selectedAgentId = agentId;
	}

	function handleNewSessionProjectChange(project: Project): void {
		selectedProjectPath = project.path;
		activeWorktreePath = null;
		worktreePending = resolveEmptyStateWorktreePendingForProjectChange({
			globalWorktreeDefault,
			loadEnabled: loadWorktreeEnabled,
			panelId: KANBAN_NEW_SESSION_PANEL_ID,
		});
	}

	function handleBrowseProject(): void {
		projectManager.importProject();
	}

	function persistSelectedAgent(agentId: string): void {
		if (agentPreferencesStore.selectedAgentIds.includes(agentId)) {
			return;
		}

		const nextSelectedAgentIds = ensureSpawnableAgentSelected(
			agentPreferencesStore.selectedAgentIds,
			agentId
		);

		void agentPreferencesStore.setSelectedAgentIds(nextSelectedAgentIds).match(
			() => undefined,
			() => undefined
		);
	}

	function handleNewSessionWillSend(): void {
		if (!effectiveAgentId) {
			return;
		}

		persistSelectedAgent(effectiveAgentId);
	}

	function handleNewSessionCreated(sessionId: string): void {
		newSessionOpen = false;
		panelStore.openSession(sessionId, 450);
	}

	function getPermissionRequest(item: QueueItem): import("$lib/acp/types/permission.js").PermissionRequest | null {
		if (item.state.pendingInput.kind !== "permission") return null;
		return item.state.pendingInput.request;
	}

	function resolveQuestionId(pq: NonNullable<QueueItem["pendingQuestion"]>): string {
		const callId = pq.tool?.callID;
		return callId ? callId : pq.id ? pq.id : "";
	}

	function handleSelectOption(sessionId: string, optionIndex: number) {
		const item = itemLookup.get(sessionId);
		if (!item || !item.pendingQuestion) return;
		const q = item.pendingQuestion.questions[0];
		if (!q) return;
		const opts = q.options;
		const opt = opts ? opts[optionIndex] : undefined;
		if (!opt) return;
		const questionId = resolveQuestionId(item.pendingQuestion);
		if (q.multiSelect) {
			selectionStore.toggleOption(questionId, 0, opt.label);
			return;
		}
		selectionStore.setSingleOption(questionId, 0, opt.label);
	}

	function handleSubmitQuestion(sessionId: string) {
		const item = itemLookup.get(sessionId);
		if (!item || !item.pendingQuestion) return;
		const q = item.pendingQuestion.questions[0];
		if (!q) return;
		const questionId = resolveQuestionId(item.pendingQuestion);
		const answers = selectionStore.getAnswers(questionId, 0, q.multiSelect);
		if (answers.length === 0) return;
		questionStore.reply(
			item.pendingQuestion.id,
			[{ questionIndex: 0, answers }],
			item.pendingQuestion.questions
		);
	}
</script>

<div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
	<div class="flex shrink-0 items-center justify-end px-2 pt-2">
		<Button
			variant="outline"
			size="header"
			class="gap-2"
			onclick={() => handleNewSessionOpenChange(true)}
			disabled={createDisabled}
		>
			<Robot weight="fill" class="h-3.5 w-3.5" style="color: {Colors.purple}" />
			<span>New Agent</span>
		</Button>
	</div>

	<Dialog bind:open={newSessionOpen} onOpenChange={handleNewSessionOpenChange}>
		<DialogContent
			showCloseButton={false}
			class="overflow-hidden max-w-[34rem] gap-0 border border-border/70 bg-background p-0 shadow-xl !backdrop-blur-none"
			portalProps={{ disabled: true }}
		>
			<EmbeddedPanelHeader>
				<div class="flex min-w-0 items-center gap-2 px-2 text-[11px] font-medium">
					<Robot weight="fill" class="h-3.5 w-3.5" style="color: {Colors.purple}" />
					<span class="truncate text-foreground">New Agent</span>
				</div>
				<div class="flex-1"></div>
				<HeaderActionCell class="ml-auto" withDivider={true}>
					{#snippet children()}
						<CloseAction onClose={() => handleNewSessionOpenChange(false)} />
					{/snippet}
				</HeaderActionCell>
			</EmbeddedPanelHeader>
			<div class="mx-auto flex w-full max-w-[30rem] flex-col px-3 pt-4 pb-2">
				<h1 class="mb-6 text-center font-sans text-[1.9rem] font-semibold tracking-tight text-foreground sm:text-4xl">
					What do you want to build?
				</h1>
				{#if canShowNewSessionInput}
					<AgentInput
						panelId={KANBAN_NEW_SESSION_PANEL_ID}
						projectPath={selectedProject ? selectedProject.path : undefined}
						projectName={selectedProject ? selectedProject.name : undefined}
						selectedAgentId={effectiveAgentId}
						voiceSessionId={KANBAN_NEW_SESSION_PANEL_ID}
						disableSend={!canSendFromNewSession}
						{availableAgents}
						onAgentChange={handleNewSessionAgentChange}
						onSessionCreated={handleNewSessionCreated}
						onWillSend={handleNewSessionWillSend}
						worktreePath={activeWorktreePath ? activeWorktreePath : undefined}
						worktreePending={effectiveWorktreePending}
						onWorktreeCreated={(path) => {
							activeWorktreePath = path;
							worktreePending = false;
						}}
					>
						{#snippet agentProjectPicker()}
							<AgentSelector
								{availableAgents}
								currentAgentId={effectiveAgentId}
								onAgentChange={handleNewSessionAgentChange}
							/>
							{#if showProjectPicker}
								<div class="h-full w-px bg-border/50"></div>
								<ProjectSelector
									selectedProject={selectedProject}
									recentProjects={projects}
									onProjectChange={handleNewSessionProjectChange}
									onBrowse={handleBrowseProject}
								/>
							{/if}
						{/snippet}
					</AgentInput>
					{#if selectedProject}
						<div class="mt-2 flex h-7 items-center rounded-b-lg">
							<WorktreeToggleControl
								panelId={KANBAN_NEW_SESSION_PANEL_ID}
								projectPath={selectedProject.path}
								projectName={selectedProject.name}
								activeWorktreePath={activeWorktreePath}
								hasEdits={false}
								hasMessages={false}
								{globalWorktreeDefault}
								variant="minimal"
								onWorktreeCreated={(info) => {
									activeWorktreePath = info.directory;
									worktreePending = false;
								}}
								onWorktreeRenamed={(info) => {
									activeWorktreePath = info.directory;
								}}
								onPendingChange={(pending) => {
									worktreePending = pending;
								}}
							/>
						</div>
					{/if}
				{:else}
					<div class="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
						Add at least one project and one available agent to start a session.
					</div>
				{/if}
			</div>
		</DialogContent>
	</Dialog>

	<div class="min-h-0 min-w-0 flex-1">
		<KanbanBoard {groups} emptyHint="No sessions">
			{#snippet cardRenderer(card)}
				{@const item = itemLookup.get(card.id)}
				<KanbanCard {card} onclick={() => handleCardClick(card.id)}>
					{#snippet footer()}
						{#if item}
							{@const permReq = getPermissionRequest(item)}
							{@const questData = getQuestionData(item)}
							{#if permReq}
								<PermissionActionBar permission={permReq} compact />
							{:else if questData}
								<KanbanQuestionFooter
									question={questData}
									onSelectOption={(i: number) => handleSelectOption(card.id, i)}
									onSubmit={() => handleSubmitQuestion(card.id)}
								/>
							{/if}
						{/if}
					{/snippet}
				</KanbanCard>
			{/snippet}
		</KanbanBoard>
	</div>
</div>