import { describe, expect, it } from "bun:test";

import {
	hydratePersistedWorkspacePanels,
	serializeWorkspacePanels,
} from "../workspace-store.svelte.js";

describe("workspace panel persistence", () => {
	it("serializes supported workspace panel kinds", () => {
		const persisted = serializeWorkspacePanels([
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
				targetLine: 12,
				targetColumn: 4,
			},
			{
				id: "terminal-1",
				kind: "terminal",
				projectPath: "/tmp/project",
				width: 500,
				ownerPanelId: null,
				groupId: "group-1",
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
		]);

		expect(persisted).toEqual([
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
				targetLine: 12,
				targetColumn: 4,
			},
			{
				id: "terminal-1",
				kind: "terminal",
				projectPath: "/tmp/project",
				width: 500,
				ownerPanelId: null,
				groupId: "group-1",
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
		]);
	});

	it("hydrates runtime-only fields for terminal panels", () => {
		const panels = hydratePersistedWorkspacePanels([
			{
				id: "terminal-1",
				kind: "terminal",
				projectPath: "/tmp/project",
				width: 500,
				ownerPanelId: null,
				groupId: "group-1",
			},
		]);

		expect(panels).toEqual([
			{
				id: "terminal-1",
				kind: "terminal",
				projectPath: "/tmp/project",
				width: 500,
				ownerPanelId: null,
				groupId: "group-1",
			},
		]);
	});
});
