import { describe, expect, it } from "bun:test";

import type {
	AgentWorkspacePanel,
	BrowserWorkspacePanel,
	FileWorkspacePanel,
	PersistedAgentWorkspacePanelState,
	PersistedBrowserWorkspacePanelState,
	PersistedFileWorkspacePanelState,
	PersistedTerminalWorkspacePanelState,
	TerminalWorkspacePanel,
	WorkspacePanel,
} from "../types.js";

describe("workspace panel types", () => {
	it("supports discriminated workspace panel variants", () => {
		const agentPanel: AgentWorkspacePanel = {
			id: "agent-1",
			kind: "agent",
			projectPath: "/tmp/project",
			width: 450,
			ownerPanelId: null,
			sessionId: "session-1",
			pendingProjectSelection: false,
			selectedAgentId: "claude-code",
			agentId: "claude-code",
			sessionTitle: "Thread",
		};

		const filePanel: FileWorkspacePanel = {
			id: "file-1",
			kind: "file",
			projectPath: "/tmp/project",
			width: 500,
			ownerPanelId: "agent-1",
			filePath: "src/main.ts",
			targetLine: 42,
			targetColumn: 7,
		};

		const terminalPanel: TerminalWorkspacePanel = {
			id: "terminal-1",
			kind: "terminal",
			projectPath: "/tmp/project",
			width: 500,
			ownerPanelId: null,
			ptyId: null,
			shell: null,
		};

		const browserPanel: BrowserWorkspacePanel = {
			id: "browser-1",
			kind: "browser",
			projectPath: "/tmp/project",
			width: 500,
			ownerPanelId: null,
			url: "https://example.com",
			title: "Example",
		};

		const panels: WorkspacePanel[] = [agentPanel, filePanel, terminalPanel, browserPanel];

		expect(panels.map((panel) => panel.kind)).toEqual([
			"agent",
			"file",
			"terminal",
			"browser",
		]);
		expect(filePanel.ownerPanelId).toBe("agent-1");
		expect(terminalPanel.ownerPanelId).toBeNull();
	});

	it("supports persisted workspace panel variants", () => {
		const persistedPanels: [
			PersistedAgentWorkspacePanelState,
			PersistedFileWorkspacePanelState,
			PersistedTerminalWorkspacePanelState,
			PersistedBrowserWorkspacePanelState,
		] = [
			{
				id: "agent-1",
				kind: "agent",
				projectPath: "/tmp/project",
				width: 450,
				ownerPanelId: null,
				sessionId: "session-1",
				pendingProjectSelection: false,
				selectedAgentId: "claude-code",
				agentId: "claude-code",
				sessionTitle: "Thread",
			},
			{
				id: "file-1",
				kind: "file",
				projectPath: "/tmp/project",
				width: 500,
				ownerPanelId: "agent-1",
				filePath: "src/main.ts",
				targetLine: 42,
				targetColumn: 7,
			},
			{
				id: "terminal-1",
				kind: "terminal",
				projectPath: "/tmp/project",
				width: 500,
				ownerPanelId: null,
			},
			{
				id: "browser-1",
				kind: "browser",
				projectPath: "/tmp/project",
				width: 500,
				ownerPanelId: null,
				url: "https://example.com",
				title: "Example",
			},
		];

		expect(persistedPanels.map((panel) => panel.kind)).toEqual([
			"agent",
			"file",
			"terminal",
			"browser",
		]);
	});
});
