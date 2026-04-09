import { describe, expect, it } from "vitest";

import { resolveDefaultAgentId } from "../agent-store.svelte.js";
import type { Agent } from "../types.js";

describe("resolveDefaultAgentId", () => {
	it("prefers registry-owned default selection ranks over hardcoded provider ids", () => {
		const agents: Agent[] = [
			{
				id: "cursor",
				name: "Cursor",
				icon: "cursor",
				default_selection_rank: 2,
			},
			{
				id: "custom-agent",
				name: "Custom Agent",
				icon: "custom-agent",
			},
			{
				id: "codex",
				name: "Codex",
				icon: "codex",
				default_selection_rank: 1,
			},
		];

		expect(resolveDefaultAgentId(agents)).toBe("codex");
	});

	it("falls back to the first listed agent when the backend provides no default rank", () => {
		const agents: Agent[] = [
			{
				id: "custom-agent",
				name: "Custom Agent",
				icon: "custom-agent",
			},
			{
				id: "forge",
				name: "Forge",
				icon: "forge",
			},
		];

		expect(resolveDefaultAgentId(agents)).toBe("custom-agent");
	});
});
