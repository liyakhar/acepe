import { describe, expect, it } from "bun:test";

import { getPreparingThreadLabel } from "../agent-panel-header-labels.js";

describe("getPreparingThreadLabel", () => {
	it("includes the active agent name while preparing the thread", () => {
		expect(getPreparingThreadLabel("Claude Opus 4.7")).toBe("Connecting to Claude Opus 4.7...");
	});

	it("falls back to the generic preparing label without an agent name", () => {
		expect(getPreparingThreadLabel(null)).toBe("Connecting to agent...");
		expect(getPreparingThreadLabel("   ")).toBe("Connecting to agent...");
	});
});
