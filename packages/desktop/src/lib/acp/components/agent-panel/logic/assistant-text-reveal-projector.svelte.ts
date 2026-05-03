import type {
	AgentAssistantEntry,
	AgentPanelSceneEntryModel,
	AgentTextRevealState,
} from "@acepe/ui/agent-panel";
import type {
	SessionGraphActivityKind,
	SessionTurnState,
} from "$lib/services/acp-types.js";

export interface AssistantTextRevealProjectionFacts {
	readonly sessionId: string | null;
	readonly turnState: SessionTurnState | null;
	readonly activityKind: SessionGraphActivityKind | null;
	readonly lastAgentMessageId: string | null;
}

interface PendingRevealMarker {
	readonly userEntryId: string | null;
	readonly knownAssistantEntryIds: readonly string[];
}

export class AssistantTextRevealProjector {
	private sessionId: string | null = null;
	private activeAssistantEntryId: string | null = null;
	private activeRevealKey: string | null = null;
	private pendingRevealMarker: PendingRevealMarker | null = null;

	constructor(private readonly onStateChange: () => void = () => {}) {}

	projectEntries(
		entries: readonly AgentPanelSceneEntryModel[],
		facts: AssistantTextRevealProjectionFacts
	): readonly AgentPanelSceneEntryModel[] {
		this.resetForSessionChange(facts.sessionId);
		this.observeCanonicalFacts(entries, facts);

		if (this.activeAssistantEntryId === null) {
			return entries;
		}

		const revealKey = this.activeRevealKey ?? this.createRevealKey(facts.sessionId, this.activeAssistantEntryId);
		const textRevealState: AgentTextRevealState = { policy: "pace", key: revealKey };
		let didDecorate = false;
		const decoratedEntries = entries.map((entry) => {
			if (entry.type !== "assistant" || entry.id !== this.activeAssistantEntryId) {
				return entry;
			}
			didDecorate = true;
			return withTextRevealState(entry, textRevealState);
		});

		if (!didDecorate && !isLiveAssistantTurn(facts)) {
			this.clearRevealTarget();
			return entries;
		}

		if (this.activeRevealKey !== revealKey) {
			this.activeRevealKey = revealKey;
		}
		return didDecorate ? decoratedEntries : entries;
	}

	handleRevealActivityChange(revealKey: string | null | undefined, active: boolean): void {
		if (active) {
			return;
		}
		if (revealKey === undefined || revealKey === null || revealKey !== this.activeRevealKey) {
			return;
		}
		this.clearRevealTarget();
	}

	private resetForSessionChange(nextSessionId: string | null): void {
		if (this.sessionId === nextSessionId) {
			return;
		}
		this.sessionId = nextSessionId;
		this.activeAssistantEntryId = null;
		this.activeRevealKey = null;
		this.pendingRevealMarker = null;
	}

	private observeCanonicalFacts(
		entries: readonly AgentPanelSceneEntryModel[],
		facts: AssistantTextRevealProjectionFacts
	): void {
		this.resetActiveRevealIfSupersededByNewUser(entries);
		if (isLiveAssistantTurn(facts)) {
			this.observeLiveTurn(entries, facts);
			return;
		}
		this.bindPendingReveal(entries, facts);
	}

	private observeLiveTurn(
		entries: readonly AgentPanelSceneEntryModel[],
		facts: AssistantTextRevealProjectionFacts
	): void {
		if (facts.lastAgentMessageId !== null) {
			const supersedingMarker = createPendingRevealMarkerAfterAssistant(
				entries,
				facts.lastAgentMessageId
			);
			if (supersedingMarker !== null) {
				this.activeAssistantEntryId = null;
				this.activeRevealKey = null;
				this.pendingRevealMarker = supersedingMarker;
				this.bindPendingReveal(entries, facts);
				return;
			}

			this.activeAssistantEntryId = facts.lastAgentMessageId;
			this.activeRevealKey = this.createRevealKey(facts.sessionId, facts.lastAgentMessageId);
			this.pendingRevealMarker = null;
			return;
		}

		this.bindPendingReveal(entries, facts);
		if (this.activeAssistantEntryId !== null) {
			return;
		}

		this.pendingRevealMarker = {
			userEntryId: findLatestUserEntryId(entries),
			knownAssistantEntryIds: collectAssistantEntryIds(entries),
		};
	}

	private bindPendingReveal(
		entries: readonly AgentPanelSceneEntryModel[],
		facts: AssistantTextRevealProjectionFacts
	): void {
		if (this.activeAssistantEntryId !== null || this.pendingRevealMarker === null) {
			return;
		}

		const assistantEntryId = findFirstNewAssistantAfterUser(entries, this.pendingRevealMarker);
		if (assistantEntryId === null) {
			return;
		}

		this.activeAssistantEntryId = assistantEntryId;
		this.activeRevealKey = this.createRevealKey(facts.sessionId, assistantEntryId);
		this.pendingRevealMarker = null;
	}

	private resetActiveRevealIfSupersededByNewUser(
		entries: readonly AgentPanelSceneEntryModel[]
	): void {
		if (this.activeAssistantEntryId === null) {
			return;
		}

		const marker = createPendingRevealMarkerAfterAssistant(entries, this.activeAssistantEntryId);
		if (marker === null) {
			return;
		}

		this.activeAssistantEntryId = null;
		this.activeRevealKey = null;
		this.pendingRevealMarker = marker;
	}

	private createRevealKey(sessionId: string | null, assistantEntryId: string): string {
		return `${sessionId ?? "no-session"}:${assistantEntryId}:message`;
	}

	private clearRevealTarget(): void {
		if (
			this.activeAssistantEntryId === null &&
			this.activeRevealKey === null &&
			this.pendingRevealMarker === null
		) {
			return;
		}

		this.activeAssistantEntryId = null;
		this.activeRevealKey = null;
		this.pendingRevealMarker = null;
		this.onStateChange();
	}
}

export function createAssistantTextRevealProjector(
	onStateChange?: () => void
): AssistantTextRevealProjector {
	return new AssistantTextRevealProjector(onStateChange);
}

function isLiveAssistantTurn(facts: AssistantTextRevealProjectionFacts): boolean {
	return facts.turnState === "Running" || facts.activityKind === "awaiting_model";
}

function findLatestUserEntryId(entries: readonly AgentPanelSceneEntryModel[]): string | null {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry?.type === "user") {
			return entry.id;
		}
	}
	return null;
}

function collectAssistantEntryIds(entries: readonly AgentPanelSceneEntryModel[]): string[] {
	const ids: string[] = [];
	for (const entry of entries) {
		if (entry.type === "assistant") {
			ids.push(entry.id);
		}
	}
	return ids;
}

function createPendingRevealMarkerAfterAssistant(
	entries: readonly AgentPanelSceneEntryModel[],
	assistantEntryId: string
): PendingRevealMarker | null {
	const assistantIndex = entries.findIndex(
		(entry) => entry.type === "assistant" && entry.id === assistantEntryId
	);
	if (assistantIndex < 0) {
		return null;
	}

	let userIndex = -1;
	for (let index = assistantIndex + 1; index < entries.length; index += 1) {
		const entry = entries[index];
		if (entry?.type === "user") {
			userIndex = index;
		}
	}
	if (userIndex < 0) {
		return null;
	}

	const userEntry = entries[userIndex];
	if (userEntry?.type !== "user") {
		return null;
	}

	return {
		userEntryId: userEntry.id,
		knownAssistantEntryIds: collectAssistantEntryIdsBeforeIndex(entries, userIndex),
	};
}

function collectAssistantEntryIdsBeforeIndex(
	entries: readonly AgentPanelSceneEntryModel[],
	stopIndex: number
): string[] {
	const ids: string[] = [];
	for (let index = 0; index < stopIndex; index += 1) {
		const entry = entries[index];
		if (entry?.type === "assistant") {
			ids.push(entry.id);
		}
	}
	return ids;
}

function findFirstNewAssistantAfterUser(
	entries: readonly AgentPanelSceneEntryModel[],
	marker: PendingRevealMarker
): string | null {
	let afterUserBoundary = marker.userEntryId === null;
	for (const entry of entries) {
		if (entry.type === "user" && entry.id === marker.userEntryId) {
			afterUserBoundary = true;
			continue;
		}
		if (
			afterUserBoundary &&
			entry.type === "assistant" &&
			!marker.knownAssistantEntryIds.includes(entry.id)
		) {
			return entry.id;
		}
	}
	return null;
}

function withTextRevealState(
	entry: AgentAssistantEntry,
	textRevealState: AgentTextRevealState
): AgentAssistantEntry {
	return {
		id: entry.id,
		type: "assistant",
		markdown: entry.markdown,
		message: entry.message,
		isStreaming: entry.isStreaming,
		revealMessageKey: entry.revealMessageKey,
		textRevealState,
		timestampMs: entry.timestampMs,
	};
}
