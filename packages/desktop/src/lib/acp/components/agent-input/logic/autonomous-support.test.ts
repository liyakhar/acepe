import { describe, expect, it } from "vitest";

import { CanonicalModeId } from "../../../types/canonical-mode-id.js";

import { resolveAutonomousSupport } from "./autonomous-support.js";

const agents = [
	{
		id: "claude-code",
		name: "Claude Code",
		icon: "claude",
		autonomous_supported_mode_ids: [CanonicalModeId.BUILD],
	},
	{
		id: "codex",
		name: "Codex",
		icon: "codex",
		autonomous_supported_mode_ids: [],
	},
];

describe("autonomous-support", () => {
	it("enables Autonomous for connected supported build sessions", () => {
		expect(
			resolveAutonomousSupport({
				agentId: "claude-code",
				connectionPhase: "connected",
				currentUiModeId: CanonicalModeId.BUILD,
				agents,
			})
		).toEqual({
			supported: true,
			disabledReason: null,
		});
	});

	it("disables unsupported modes for otherwise supported agents", () => {
		expect(
			resolveAutonomousSupport({
				agentId: "claude-code",
				connectionPhase: "connected",
				currentUiModeId: CanonicalModeId.PLAN,
				agents,
			})
		).toEqual({
			supported: false,
			disabledReason: "unsupported-mode",
		});
	});

	it("disables unsupported agents", () => {
		expect(
			resolveAutonomousSupport({
				agentId: "codex",
				connectionPhase: "connected",
				currentUiModeId: CanonicalModeId.BUILD,
				agents,
			})
		).toEqual({
			supported: false,
			disabledReason: "unsupported-agent",
		});
	});

	it("disables pre-live sessions even when the agent supports Autonomous", () => {
		expect(
			resolveAutonomousSupport({
				agentId: "claude-code",
				connectionPhase: "connecting",
				currentUiModeId: CanonicalModeId.BUILD,
				agents,
			})
		).toEqual({
			supported: false,
			disabledReason: "not-live",
		});
	});
});