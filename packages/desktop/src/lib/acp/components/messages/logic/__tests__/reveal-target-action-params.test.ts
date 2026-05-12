import { describe, expect, it } from "bun:test";

import {
	type RevealTargetActionParams,
	shouldRestartRevealTargetAction,
} from "../reveal-target-action-params.js";

function createParams(overrides: Partial<RevealTargetActionParams> = {}): RevealTargetActionParams {
	return {
		controller: overrides.controller,
		entryIndex: overrides.entryIndex ?? 1,
		entryKey: overrides.entryKey ?? "assistant-1",
		observeRevealResize: overrides.observeRevealResize ?? true,
		revealEntryIndex: overrides.revealEntryIndex ?? (() => true),
	};
}

describe("shouldRestartRevealTargetAction", () => {
	it("does not restart when only the wrapper object or reveal callback identity changes", () => {
		const currentParams = createParams({
			revealEntryIndex: () => true,
		});
		const nextParams = createParams({
			revealEntryIndex: () => false,
		});

		expect(shouldRestartRevealTargetAction(currentParams, nextParams)).toBe(false);
	});

	it("restarts when the observed key or resize mode changes", () => {
		const currentParams = createParams();

		expect(
			shouldRestartRevealTargetAction(currentParams, createParams({ entryKey: "assistant-2" }))
		).toBe(true);
		expect(
			shouldRestartRevealTargetAction(currentParams, createParams({ observeRevealResize: false }))
		).toBe(true);
	});
});
