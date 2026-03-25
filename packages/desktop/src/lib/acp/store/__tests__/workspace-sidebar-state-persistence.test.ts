import { beforeEach, describe, expect, it, mock } from "bun:test";
import { okAsync } from "neverthrow";
import { SvelteMap } from "svelte/reactivity";

type TerminalPanelGroupStub = {
	id: string;
	projectPath: string;
	width: number;
	selectedTabId: string | null;
	order: number;
};

type TerminalTabStub = {
	id: string;
	groupId: string;
	projectPath: string;
	createdAt: number;
	ptyId: number | null;
	shell: string | null;
};

const saveWorkspaceStateMock = mock(
	(state: Record<string, boolean | number | object | string | null | undefined>) =>
		okAsync(undefined)
);
const loadWorkspaceStateMock = mock(() => okAsync(null));

mock.module("../api.js", () => ({
	api: {
		saveWorkspaceState: saveWorkspaceStateMock,
		loadWorkspaceState: loadWorkspaceStateMock,
	},
}));

import { WorkspaceStore } from "../workspace-store.svelte.js";

function createPanelStoreStub() {
	const store = {
		workspacePanels: [],
		panels: [],
		filePanels: [],
		terminalPanelGroups: [] as TerminalPanelGroupStub[],
		terminalTabs: [] as TerminalTabStub[],
		terminalPanels: [],
		browserPanels: [],
		reviewPanels: [],
		gitPanels: [],
		scrollX: 0,
		focusedPanelId: null,
		fullscreenPanelId: null,
		viewMode: "multi",
		focusedViewProjectPath: null,
		embeddedTerminals: {
			serialize: mock(() => []),
			restore: mock(() => {}),
			getSelectedTabId: mock(() => null),
		},
		getTerminalPanelGroup: mock(() => undefined),
		getTerminalTabsForGroup: mock(() => []),
		getActiveFilePanelIdByOwnerPanelIdRecord: mock(() => ({})),
		setActiveFilePanelMap: mock(() => {}),
		hotState: new SvelteMap(),
		setPlanSidebarExpanded: mock(() => {}),
		setMessageDraft: mock(() => {}),
		setPendingReviewRestore: mock(() => {}),
		setEmbeddedTerminalDrawerOpen: mock(() => {}),
		getHotState: mock(() => ({
			planSidebarExpanded: true,
			messageDraft: "",
			reviewMode: false,
			reviewFileIndex: 0,
			embeddedTerminalDrawerOpen: false,
		})),
	};

	return store;
}

function createSessionStoreStub() {
	return {
		getSessionIdentity: mock(() => undefined),
		getSessionMetadata: mock(() => undefined),
	} as const;
}

describe("workspace sidebar state persistence", () => {
	beforeEach(() => {
		saveWorkspaceStateMock.mockClear();
		loadWorkspaceStateMock.mockClear();
	});

	it("restores collapsed project paths even when the saved list is empty", () => {
		const store = new WorkspaceStore(createPanelStoreStub() as never, createSessionStoreStub() as never);
		const restoredValues: string[][] = [];

		store.registerProviders({
			setCollapsedProjectPaths: (paths) => {
				restoredValues.push(paths);
			},
		});

		store.restore({
			version: 9,
			panels: [],
			focusedPanelIndex: null,
			panelContainerScrollX: 0,
			savedAt: new Date().toISOString(),
			collapsedProjectPaths: [],
		});

		expect(restoredValues).toEqual([[]]);
	});

	it("can persist sidebar collapse state immediately", () => {
		const store = new WorkspaceStore(createPanelStoreStub() as never, createSessionStoreStub() as never);

		store.registerProviders({
			getCollapsedProjectPaths: () => ["/workspace/app"],
		});

		store.persist(true);

		expect(saveWorkspaceStateMock).toHaveBeenCalledTimes(1);
		const calls = saveWorkspaceStateMock.mock.calls as unknown as Array<ReadonlyArray<unknown>>;
		const firstCall = calls[0];
		expect(firstCall).toBeDefined();
		const savedState = firstCall?.[0] as Record<string, unknown> | undefined;
		expect(savedState).toMatchObject({
			collapsedProjectPaths: ["/workspace/app"],
		});
	});

	it("persists terminal panel groups and tabs", () => {
		const panelStore = createPanelStoreStub();
		panelStore.terminalPanelGroups = [
			{
				id: "group-1",
				projectPath: "/workspace/app",
				width: 500,
				selectedTabId: "tab-2",
				order: 0,
			},
		];
		panelStore.terminalTabs = [
			{
				id: "tab-1",
				groupId: "group-1",
				projectPath: "/workspace/app",
				createdAt: 1,
				ptyId: null,
				shell: null,
			},
			{
				id: "tab-2",
				groupId: "group-1",
				projectPath: "/workspace/app",
				createdAt: 2,
				ptyId: null,
				shell: null,
			},
		];

		const store = new WorkspaceStore(panelStore as never, createSessionStoreStub() as never);

		store.persist(true);

		expect(saveWorkspaceStateMock).toHaveBeenCalledTimes(1);
		const calls = saveWorkspaceStateMock.mock.calls;
		expect(calls.length).toBe(1);
		const firstCall = calls.at(0);
		if (!firstCall) {
			throw new Error("expected saved workspace state");
		}
		const savedState = firstCall[0];
		expect(savedState.terminalPanelGroups).toEqual([
			{
				id: "group-1",
				projectPath: "/workspace/app",
				width: 500,
				selectedTabId: "tab-2",
				order: 0,
			},
		]);
		expect(savedState.terminalTabs).toEqual([
			{ id: "tab-1", groupId: "group-1", projectPath: "/workspace/app", createdAt: 1 },
			{ id: "tab-2", groupId: "group-1", projectPath: "/workspace/app", createdAt: 2 },
		]);
	});
});
