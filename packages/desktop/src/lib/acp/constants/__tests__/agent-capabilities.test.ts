import { describe, expect, it } from "bun:test";

import { AGENT_IDS } from "../../types/agent-id.js";
import { getAgentCapabilities } from "../agent-capabilities";

describe("getAgentCapabilities", () => {
	it("returns Claude Code's open-in-finder capability", () => {
		expect(getAgentCapabilities(AGENT_IDS.CLAUDE_CODE)).toEqual({
			openInFinderTarget: "claude-session",
			loadsRemotePreconnectionCommands: false,
		});
	});

	it("returns OpenCode's remote preconnection capability", () => {
		expect(getAgentCapabilities(AGENT_IDS.OPENCODE)).toEqual({
			openInFinderTarget: "project-path",
			loadsRemotePreconnectionCommands: true,
		});
	});

	it("falls back to default capabilities for other agents", () => {
		expect(getAgentCapabilities(AGENT_IDS.CURSOR)).toEqual({
			openInFinderTarget: "project-path",
			loadsRemotePreconnectionCommands: false,
		});
	});
});
