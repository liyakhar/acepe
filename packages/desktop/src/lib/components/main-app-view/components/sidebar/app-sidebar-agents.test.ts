import { describe, expect, it } from "bun:test";

import { ensureProjectHeaderAgentSelected, getProjectHeaderAgents } from "./app-sidebar-agents.js";

describe("getProjectHeaderAgents", () => {
	it("includes selected agents and installable agents that are not installed", () => {
		const result = getProjectHeaderAgents(
			[
				{
					id: "claude-code",
					name: "Claude Code",
					icon: "claude-code",
					availability_kind: { kind: "installable", installed: true },
				},
				{
					id: "cursor",
					name: "Cursor",
					icon: "cursor",
					availability_kind: { kind: "installable", installed: false },
				},
				{
					id: "codex",
					name: "Codex",
					icon: "codex",
					availability_kind: { kind: "installable", installed: true },
				},
			],
			["claude-code"]
		);

		expect(result.map((agent) => agent.id)).toEqual(["claude-code", "cursor"]);
	});

	it("does not add already installed agents that are not selected", () => {
		const result = getProjectHeaderAgents(
			[
				{
					id: "custom-agent",
					name: "Custom Agent",
					icon: "custom-agent",
					availability_kind: { kind: "installable", installed: true },
				},
				{
					id: "cursor",
					name: "Cursor",
					icon: "cursor",
					availability_kind: { kind: "installable", installed: false },
				},
			],
			[]
		);

		expect(result.map((agent) => agent.id)).toEqual(["cursor"]);
	});

	it("does not auto-include already installed PATH-backed agents that are not selected", () => {
		const result = getProjectHeaderAgents(
			[
				{
					id: "forge",
					name: "Forge",
					icon: "forge",
					availability_kind: { kind: "installable", installed: true },
				},
				{
					id: "cursor",
					name: "Cursor",
					icon: "cursor",
					availability_kind: { kind: "installable", installed: false },
				},
			],
			[]
		);

		expect(result.map((agent) => agent.id)).toEqual(["cursor"]);
	});
});

describe("ensureProjectHeaderAgentSelected", () => {
	it("appends the spawned agent when it is not already selected", () => {
		expect(ensureProjectHeaderAgentSelected(["claude-code"], "cursor")).toEqual([
			"claude-code",
			"cursor",
		]);
	});

	it("keeps the selection unchanged when the agent is already selected", () => {
		expect(ensureProjectHeaderAgentSelected(["claude-code", "cursor"], "cursor")).toEqual([
			"claude-code",
			"cursor",
		]);
	});
});
