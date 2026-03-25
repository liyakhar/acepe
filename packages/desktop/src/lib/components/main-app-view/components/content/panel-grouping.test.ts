import { describe, expect, it } from "bun:test";

import { groupAllPanelsByProject, groupWorkspacePanelsByProject } from "./panel-grouping.js";

describe("groupAllPanelsByProject", () => {
	it("groups unified workspace panels by project and kind", () => {
		const groups = groupAllPanelsByProject(
			[
				{
					id: "agent-1",
					sessionProjectPath: "/tmp/project-a",
				},
			],
			[
				{
					id: "file-1",
					kind: "file",
					filePath: "src/main.ts",
					projectPath: "/tmp/project-a",
					ownerPanelId: null,
					width: 500,
				},
			],
			[],
			[
				{
					id: "terminal-1",
					kind: "terminal",
					projectPath: "/tmp/project-a",
					ownerPanelId: null,
					width: 500,
					ptyId: null,
					shell: null,
				},
			],
			[
				{
					id: "browser-1",
					kind: "browser",
					projectPath: "/tmp/project-a",
					ownerPanelId: null,
					width: 500,
					url: "https://example.com",
					title: "Example",
				},
			],
			[],
			[
				{
					path: "/tmp/project-a",
					name: "Project A",
					color: "#123456",
					createdAt: new Date(),
				},
			]
		);

		expect(groups).toHaveLength(1);
		expect(groups[0].projectPath).toBe("/tmp/project-a");
		expect(groups[0].agentPanels).toHaveLength(1);
		expect(groups[0].filePanels).toHaveLength(1);
		expect(groups[0].terminalPanels).toHaveLength(1);
		expect(groups[0].browserPanels).toHaveLength(1);
	});
});

describe("groupWorkspacePanelsByProject", () => {
	it("groups unified non-agent workspace panels by project", () => {
		const groups = groupWorkspacePanelsByProject(
			[
				{
					id: "agent-1",
					projectPath: "/tmp/project-a",
				},
			],
			[
				{
					id: "file-1",
					kind: "file",
					filePath: "src/main.ts",
					projectPath: "/tmp/project-a",
					ownerPanelId: null,
					width: 500,
				},
				{
					id: "terminal-1",
					kind: "terminal",
					projectPath: "/tmp/project-a",
					ownerPanelId: null,
					width: 500,
					ptyId: null,
					shell: null,
				},
				{
					id: "browser-1",
					kind: "browser",
					projectPath: "/tmp/project-a",
					ownerPanelId: null,
					width: 500,
					url: "https://example.com",
					title: "Example",
				},
			],
			[],
			[],
			[
				{
					path: "/tmp/project-a",
					name: "Project A",
					color: "#123456",
					createdAt: new Date(),
				},
			]
		);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.agentPanels).toHaveLength(1);
		expect(groups[0]?.filePanels).toHaveLength(1);
		expect(groups[0]?.terminalPanels).toHaveLength(1);
		expect(groups[0]?.browserPanels).toHaveLength(1);
	});
});
