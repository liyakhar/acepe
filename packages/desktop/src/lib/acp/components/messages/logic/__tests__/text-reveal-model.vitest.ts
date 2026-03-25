import { describe, expect, it } from "vitest";

import {
	advanceRevealProgress,
	clearRevealFrameTime,
	commitRenderedReveal,
	createRevealProgress,
	hasPendingReveal,
	syncRevealProgress,
	updateStreamingState,
} from "../text-reveal-model.js";

describe("text-reveal-model", () => {
	it("uses the default frame duration for the first animation frame", () => {
		const initial = updateStreamingState(
			{
				totalChars: 10,
				revealedChars: 0,
				renderedChars: 0,
				isStreaming: false,
				lastFrameTime: null,
			},
			true,
		);

		const next = advanceRevealProgress(initial, 16.67);

		expect(next.revealedChars).toBe(3);
		expect(next.lastFrameTime).toBe(16.67);
	});

	it("clamps revealed and rendered chars when total chars shrink", () => {
		const started = updateStreamingState(createRevealProgress(20), true);
		const advanced = commitRenderedReveal(advanceRevealProgress(started, 16.67));
		const synced = syncRevealProgress(
			{
				totalChars: advanced.totalChars,
				revealedChars: 18,
				renderedChars: 18,
				isStreaming: advanced.isStreaming,
				lastFrameTime: advanced.lastFrameTime,
			},
			5,
		);

		expect(synced.totalChars).toBe(5);
		expect(synced.revealedChars).toBe(5);
		expect(synced.renderedChars).toBe(5);
	});

	it("reveals everything immediately when streaming stops", () => {
		const started = updateStreamingState(createRevealProgress(12), true);
		const advanced = advanceRevealProgress(started, 16.67);

		const stopped = updateStreamingState(advanced, false);

		expect(stopped.isStreaming).toBe(false);
		expect(stopped.revealedChars).toBe(12);
		expect(stopped.renderedChars).toBe(12);
		expect(stopped.lastFrameTime).toBeNull();
	});

	it("reports pending work only while streaming and behind the total", () => {
		const idle = createRevealProgress(5);
		const streaming = updateStreamingState(
			{
				totalChars: 5,
				revealedChars: 2,
				renderedChars: 2,
				isStreaming: false,
				lastFrameTime: null,
			},
			true,
		);
		const complete = updateStreamingState(createRevealProgress(0), true);

	expect(hasPendingReveal(idle)).toBe(false);
	expect(hasPendingReveal(streaming)).toBe(true);
	expect(hasPendingReveal(complete)).toBe(false);
	});

	it("clears only the frame timestamp without mutating progress", () => {
		const progress = {
			totalChars: 20,
			revealedChars: 8,
			renderedChars: 7,
			isStreaming: true,
			lastFrameTime: 42,
		};

		const cleared = clearRevealFrameTime(progress);

		expect(cleared.totalChars).toBe(20);
		expect(cleared.revealedChars).toBe(8);
		expect(cleared.renderedChars).toBe(7);
		expect(cleared.isStreaming).toBe(true);
		expect(cleared.lastFrameTime).toBeNull();
	});
});
