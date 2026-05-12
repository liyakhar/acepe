import { describe, expect, it } from "vitest";

import {
	TOKEN_REVEAL_FADE_MS,
	TOKEN_REVEAL_STEP_MS,
	shouldKeepTokenRevealTiming,
} from "./token-reveal-motion.js";

describe("shouldKeepTokenRevealTiming", () => {
	it("keeps non-streaming timing while the final scheduled token has not finished fading", () => {
		expect(
			shouldKeepTokenRevealTiming({
				isStreaming: false,
				timing: {
					revealCount: 4,
					baselineMs: -112,
					tokStepMs: TOKEN_REVEAL_STEP_MS,
					tokFadeDurMs: TOKEN_REVEAL_FADE_MS,
					mode: "smooth",
				},
			})
		).toBe(true);
	});

	it("drops non-streaming timing once the reveal has fully settled", () => {
		expect(
			shouldKeepTokenRevealTiming({
				isStreaming: false,
				timing: {
					revealCount: 4,
					baselineMs: -1_000,
					tokStepMs: TOKEN_REVEAL_STEP_MS,
					tokFadeDurMs: TOKEN_REVEAL_FADE_MS,
					mode: "smooth",
				},
			})
		).toBe(false);
	});
});
