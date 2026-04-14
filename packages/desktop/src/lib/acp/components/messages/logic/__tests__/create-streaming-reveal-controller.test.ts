import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
	createStreamingRevealController,
	type StreamingRevealController,
} from "../create-streaming-reveal-controller.svelte.js";

type QueuedFrame = {
	id: number;
	callback: FrameRequestCallback;
};

let queuedFrames: QueuedFrame[] = [];
let nextFrameId = 1;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

function flushNextFrame(timestamp: number): void {
	const frame = queuedFrames.shift();
	if (!frame) {
		throw new Error("Expected a queued animation frame");
	}
	frame.callback(timestamp);
}

function flushAllFrames(startTimestamp: number, stepMs: number): void {
	let timestamp = startTimestamp;
	while (queuedFrames.length > 0) {
		flushNextFrame(timestamp);
		timestamp += stepMs;
	}
}

function createAndSeedController(mode: "classic" | "smooth" | "instant"): StreamingRevealController {
	const controller = createStreamingRevealController(mode);
	controller.setState("Already streamed text", true, { seedFromSource: true });
	return controller;
}

describe("createStreamingRevealController", () => {
	beforeEach(() => {
		queuedFrames = [];
		nextFrameId = 1;
		globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
			const id = nextFrameId;
			nextFrameId += 1;
			queuedFrames.push({ id, callback });
			return id;
		};
		globalThis.cancelAnimationFrame = (id: number): void => {
			queuedFrames = queuedFrames.filter((frame) => frame.id !== id);
		};
	});

	afterEach(() => {
		globalThis.requestAnimationFrame = originalRequestAnimationFrame;
		globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
	});

	it("dispatches classic mode to the frame-by-frame reveal behavior", () => {
		const controller = createStreamingRevealController("classic");

		controller.setState("Hello world", true);
		expect(controller.mode).toBe("streaming");
		expect(controller.displayedText).toBe("");
		expect(queuedFrames.length).toBe(1);

		flushNextFrame(16);
		expect(controller.displayedText.length).toBeGreaterThan(0);
		expect(controller.displayedText.length).toBeLessThan("Hello world".length);
		expect(controller.isRevealActive).toBe(true);
	});

	it("dispatches instant mode to surface the full source immediately", () => {
		const controller = createStreamingRevealController("instant");

		controller.setState("Hello world", true);
		expect(controller.displayedText).toBe("Hello world");
		expect(controller.mode).toBe("streaming");
		expect(controller.isRevealActive).toBe(false);
		expect(queuedFrames.length).toBe(0);

		controller.setState("Hello world", false);
		expect(controller.displayedText).toBe("Hello world");
		expect(controller.mode).toBe("complete");
		expect(controller.isRevealActive).toBe(false);
	});

	it("dispatches smooth mode to buffered batches that reveal more per flush than classic", () => {
		const classic = createStreamingRevealController("classic");
		const text = "x".repeat(320);

		classic.setState(text, true);
		flushNextFrame(16);
		const classicLength = classic.displayedText.length;
		expect(classicLength).toBeGreaterThan(0);

		classic.destroy();
		queuedFrames = [];
		nextFrameId = 1;

		const smooth = createStreamingRevealController("smooth");
		smooth.setState(text, true);

		flushNextFrame(16);
		flushNextFrame(32);
		flushNextFrame(48);
		flushNextFrame(64);
		const smoothLength = smooth.displayedText.length;
		expect(smoothLength).toBeGreaterThan(classicLength);
		expect(smoothLength).toBeLessThan(text.length);
		expect(smooth.isRevealActive).toBe(true);
	});

	it("supports seedFromSource and reset across all modes", () => {
		const classic = createAndSeedController("classic");
		const smooth = createAndSeedController("smooth");
		const instant = createAndSeedController("instant");

		expect(classic.displayedText).toBe("Already streamed text");
		expect(smooth.displayedText).toBe("Already streamed text");
		expect(instant.displayedText).toBe("Already streamed text");

		classic.reset();
		smooth.reset();
		instant.reset();

		expect(classic.displayedText).toBe("");
		expect(smooth.displayedText).toBe("");
		expect(instant.displayedText).toBe("");
		expect(classic.mode).toBe("idle");
		expect(smooth.mode).toBe("idle");
		expect(instant.mode).toBe("idle");
	});

	it("converges on the full source and inactive state once streaming completes", () => {
		const modes = ["classic", "smooth", "instant"] as const;
		const text = "z".repeat(320);

		for (const mode of modes) {
			queuedFrames = [];
			nextFrameId = 1;

			const controller = createStreamingRevealController(mode);
			controller.setState(text, true);

			if (mode !== "instant") {
				flushNextFrame(16);
				if (mode === "smooth") {
					flushNextFrame(32);
					flushNextFrame(48);
					flushNextFrame(64);
				}
			}

			controller.setState(text, false);
			flushAllFrames(80, 16);

			expect(controller.displayedText).toBe(text);
			expect(controller.mode).toBe("complete");
			expect(controller.isRevealActive).toBe(false);
		}
	});

	it("uses reset semantics when the source is replaced instead of appended", () => {
		const modes = ["classic", "smooth", "instant"] as const;

		for (const mode of modes) {
			queuedFrames = [];
			nextFrameId = 1;

			const controller = createStreamingRevealController(mode);
			controller.setState("First message", true);
			if (mode === "classic") {
				flushNextFrame(16);
			}
			if (mode === "smooth") {
				flushNextFrame(16);
				flushNextFrame(32);
				flushNextFrame(48);
				flushNextFrame(64);
			}

			controller.setState("Second", true);
			if (mode === "instant") {
				expect(controller.displayedText).toBe("Second");
				expect(controller.isRevealActive).toBe(false);
			} else {
				expect(controller.displayedText).toBe("");
				expect(controller.mode).toBe("streaming");
				expect(controller.isRevealActive).toBe(true);
			}
		}
	});
});
