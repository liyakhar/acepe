import { describe, expect, it } from "bun:test";

import {
	canMaximizeFromStartupGate,
	createCheckingUpdaterState,
	createErrorUpdaterState,
	createIdleUpdaterState,
} from "../logic/updater-state.js";

describe("startup maximize gate", () => {
	it("opens only when onboarding has resolved to hidden and updater is non-blocking", () => {
		expect(canMaximizeFromStartupGate(false, createIdleUpdaterState())).toBe(true);
	});

	it("stays blocked while onboarding state is still unresolved", () => {
		expect(canMaximizeFromStartupGate(null, createIdleUpdaterState())).toBe(false);
	});

	it("stays blocked for startup updater states that still own the compact window", () => {
		expect(canMaximizeFromStartupGate(false, createCheckingUpdaterState())).toBe(false);
		expect(canMaximizeFromStartupGate(false, createErrorUpdaterState("failed"))).toBe(false);
	});
});
