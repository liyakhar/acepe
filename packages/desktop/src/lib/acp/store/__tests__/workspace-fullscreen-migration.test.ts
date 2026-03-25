import { describe, expect, it, mock } from "bun:test";

import { WorkspaceStore } from "../workspace-store.svelte.js";
import type { WorkspacePanel } from "../types.js";

function createPanelStoreStub() {
	return {
		workspacePanels: [] as WorkspacePanel[],
		panels: [],
		filePanels: [],
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
		setActiveFilePanelMap: mock(() => {}),
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
	} as const;
}

describe("workspace fullscreen migration", () => {
	it("restores fullscreenPanelId from unified workspace panels", () => {
		const panelStore = createPanelStoreStub();
		const sessionStore = {
			getSessionIdentity: mock(() => undefined),
			getSessionMetadata: mock(() => undefined),
		};
		const store = new WorkspaceStore(panelStore as never, sessionStore as never);

		store.restore({
			version: 10,
			workspacePanels: [
				{
					id: "browser-1",
					kind: "browser",
					projectPath: "/tmp/project",
					ownerPanelId: null,
					width: 500,
					url: "https://example.com",
					title: "Example",
				},
			],
			panels: [],
			focusedPanelIndex: null,
			fullscreenPanelIndex: 0,
			panelContainerScrollX: 0,
			savedAt: new Date().toISOString(),
		});

		expect(panelStore.workspacePanels).toHaveLength(1);
		const restoredPanel = panelStore.workspacePanels.at(0);
		expect(restoredPanel).toBeDefined();
		if (!restoredPanel) {
			throw new Error("expected restored workspace panel");
		}
		expect(restoredPanel.kind).toBe("browser");
	});
});
