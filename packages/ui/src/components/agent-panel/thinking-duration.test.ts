import { describe, expect, it } from "bun:test";

import { resolveThinkingDurationMs, shouldRunThinkingTimer } from "./thinking-duration.js";

describe("thinking duration", () => {
	it("derives live duration from a stable start timestamp", () => {
		expect(
			resolveThinkingDurationMs({
				startedAtMs: 1_000,
				durationMs: null,
				nowMs: 4_500,
			})
		).toBe(3_500);
	});

	it("falls back to materialized duration when no start timestamp exists", () => {
		expect(
			resolveThinkingDurationMs({
				startedAtMs: null,
				durationMs: 2_000,
				nowMs: 4_500,
			})
		).toBe(2_000);
	});

	it("prefers active start timestamp over materialized duration", () => {
		expect(
			resolveThinkingDurationMs({
				startedAtMs: 1_000,
				durationMs: 99_000,
				nowMs: 4_500,
			})
		).toBe(3_500);
	});

	it("only runs a live timer for active rows with a start timestamp", () => {
		expect(shouldRunThinkingTimer(1_000)).toBe(true);
		expect(shouldRunThinkingTimer(null)).toBe(false);
		expect(shouldRunThinkingTimer(undefined)).toBe(false);
	});
});
