import { beforeEach, describe, expect, it, mock } from "bun:test";
import { okAsync } from "neverthrow";

import type { ConvertedSession, StoredEntry } from "../../../../services/converted-session-types.js";
import type { SessionCold, SessionEntry } from "../../types.js";
import type {
	IConnectionManager,
	IEntryManager,
	ISessionStateReader,
	ISessionStateWriter,
} from "../interfaces/index.js";

const getSessionMock = mock(() => okAsync(createConvertedSession()));

mock.module("../../api.js", () => ({
	api: {
		getSession: getSessionMock,
	},
}));

import { SessionRepository } from "../session-repository.js";

type SessionStoreState = {
	sessions: SessionCold[];
};

function createConvertedSession(): ConvertedSession {
	const entry: StoredEntry = {
		type: "user",
		id: "user-1",
		message: {
			id: null,
			content: {
				type: "text",
				text: "Ship it",
			},
			chunks: [
				{
					type: "text",
					text: "Ship it",
				},
			],
			sentAt: null,
		},
		timestamp: "2026-04-08T00:00:00Z",
	};

	return {
		entries: [entry],
		stats: {
			total_messages: 1,
			user_messages: 1,
			assistant_messages: 0,
			tool_uses: 0,
			tool_results: 0,
			thinking_blocks: 0,
			total_input_tokens: 0,
			total_output_tokens: 0,
		},
		title: "History title",
		createdAt: "2026-04-08T00:00:00Z",
		currentModeId: "plan",
	};
}

function createStateReader(state: SessionStoreState): ISessionStateReader {
	return {
		getHotState: () => ({
			status: "idle",
			isConnected: false,
			turnState: "idle" as const,
			acpSessionId: null,
			connectionError: null,
			autonomousEnabled: false,
			autonomousTransition: "idle",
			currentModel: null,
			currentMode: null,
			availableCommands: [],
			statusChangedAt: Date.now(),
		}),
		getEntries: () => [],
		isPreloaded: () => false,
		getSessionsForProject: () => [],
		getSessionCold: (id: string) => state.sessions.find((session) => session.id === id),
		getAllSessions: () => state.sessions,
	};
}

function createStateWriter(state: SessionStoreState): ISessionStateWriter {
	return {
		addSession: (session) => {
			state.sessions = state.sessions.concat([session]);
		},
		updateSession: (id, updates) => {
			state.sessions = state.sessions.map((session) => {
				if (session.id !== id) {
					return session;
				}

				return {
					id: session.id,
					projectPath: updates.projectPath ?? session.projectPath,
					agentId: updates.agentId ?? session.agentId,
					title: updates.title ?? session.title,
					updatedAt: updates.updatedAt ?? session.updatedAt,
					createdAt: updates.createdAt ?? session.createdAt,
					sourcePath: updates.sourcePath ?? session.sourcePath,
					parentId: updates.parentId ?? session.parentId,
					worktreePath: updates.worktreePath ?? session.worktreePath,
					worktreeDeleted: updates.worktreeDeleted ?? session.worktreeDeleted,
					prNumber: updates.prNumber ?? session.prNumber,
					sessionLifecycleState:
						updates.sessionLifecycleState ?? session.sessionLifecycleState,
					sequenceId: updates.sequenceId ?? session.sequenceId,
				};
			});
		},
		removeSession: (sessionId) => {
			state.sessions = state.sessions.filter((session) => session.id !== sessionId);
		},
		setSessions: (sessions) => {
			state.sessions = sessions;
		},
		setLoading: () => {},
		addScanningProjects: () => {},
		removeScanningProjects: () => {},
	};
}

const storedEntries: SessionEntry[][] = [];

const entryManager: IEntryManager = {
	getEntries: () => [],
	hasEntries: () => false,
	isPreloaded: () => false,
	markPreloaded: () => {},
	unmarkPreloaded: () => {},
	storeEntriesAndBuildIndex: (_sessionId, entries) => {
		storedEntries.push(entries);
	},
	addEntry: () => {},
	removeEntry: () => {},
	updateEntry: () => {},
	clearEntries: () => {},
	createToolCallEntry: () => {},
	updateToolCallEntry: () => {},
	aggregateAssistantChunk: () => {
		throw new Error("Not implemented for test");
	},
	clearStreamingAssistantEntry: () => {},
	finalizeStreamingEntries: () => {},
};

const connectionManager: IConnectionManager = {
	createOrGetMachine: () => {
		throw new Error("Not implemented for test");
	},
	getMachine: () => null,
	getState: () => null,
	removeMachine: () => {},
	isConnecting: () => false,
	setConnecting: () => {},
	sendContentLoad: () => {},
	sendContentLoaded: () => {},
	sendContentLoadError: () => {},
	sendConnectionConnect: () => {},
	sendConnectionSuccess: () => {},
	sendCapabilitiesLoaded: () => {},
	sendConnectionError: () => {},
	sendTurnFailed: () => {},
	sendDisconnect: () => {},
	sendMessageSent: () => {},
	sendResponseStarted: () => {},
	sendResponseComplete: () => {},
	initializeConnectedSession: () => {},
};

describe("SessionRepository.preloadSessionDetails", () => {
	beforeEach(() => {
		getSessionMock.mockReset();
		getSessionMock.mockImplementation(() => okAsync(createConvertedSession()));
		storedEntries.length = 0;
	});

	it("does not read currentModeId from cold-loaded sessions", async () => {
		const state: SessionStoreState = { sessions: [] };
		const repository = new SessionRepository(
			createStateReader(state),
			createStateWriter(state),
			entryManager,
			connectionManager
		);

		getSessionMock.mockImplementation(() => {
			const converted = createConvertedSession();
			Object.defineProperty(converted, "currentModeId", {
				get() {
					throw new Error("currentModeId should not be read during preload");
				},
			});
			return okAsync(converted);
		});

		const result = await repository.preloadSessionDetails(
			"session-1",
			"/projects/acepe",
			"opencode"
		);

		expect(result.isOk()).toBe(true);
		expect(storedEntries).toHaveLength(1);
		expect(storedEntries[0]?.[0]?.type).toBe("user");
	});
});
