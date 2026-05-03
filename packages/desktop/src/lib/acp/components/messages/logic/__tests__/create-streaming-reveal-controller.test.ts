import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
	CSS_DRAIN_TIMEOUT_MS,
	createStreamingRevealController,
	REVEAL_TICK_MS,
	type StreamingRevealController,
} from "../create-streaming-reveal-controller.svelte.js";

type MotionChangeListener = NonNullable<MediaQueryList["onchange"]>;

type MotionQueryStub = MediaQueryList & {
	emitChange: (matches: boolean) => void;
};

function waitForDrain(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, CSS_DRAIN_TIMEOUT_MS + 20);
	});
}

function waitForRevealTick(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, REVEAL_TICK_MS + 20);
	});
}

function createAndSeedController(mode: "smooth" | "instant"): StreamingRevealController {
	const controller = createStreamingRevealController(mode);
	controller.setState("Already streamed text", true, { seedFromSource: true });
	return controller;
}

function createMotionQueryStub(initialMatches: boolean): MotionQueryStub {
	const listeners = new Set<MotionChangeListener>();
	let currentMatches = initialMatches;

	function addMotionListener(listener: MotionChangeListener | null): void {
		if (listener !== null) {
			listeners.add(listener);
		}
	}

	function removeMotionListener(listener: MotionChangeListener | null): void {
		if (listener !== null) {
			listeners.delete(listener);
		}
	}

	const stub: MotionQueryStub = {
		get matches() {
			return currentMatches;
		},
		media: "(prefers-reduced-motion: reduce)",
		onchange: null,
		addListener(listener: MotionChangeListener | null) {
			addMotionListener(listener);
		},
		removeListener(listener: MotionChangeListener | null) {
			removeMotionListener(listener);
		},
		addEventListener(_type: string, listener: EventListenerOrEventListenerObject | null) {
			if (typeof listener === "function") {
				addMotionListener(listener as MotionChangeListener);
			}
		},
		removeEventListener(_type: string, listener: EventListenerOrEventListenerObject | null) {
			if (typeof listener === "function") {
				removeMotionListener(listener as MotionChangeListener);
			}
		},
		dispatchEvent(_event) {
			return true;
		},
		emitChange(matches) {
			currentMatches = matches;
			const event = { matches } as MediaQueryListEvent;
			for (const listener of listeners) {
				listener.call(stub, event);
			}
		},
	};

	return stub;
}

const originalMatchMedia = globalThis.matchMedia;
let motionQueryStub = createMotionQueryStub(false);

describe("createStreamingRevealController", () => {
	beforeEach(() => {
		motionQueryStub = createMotionQueryStub(false);
		globalThis.matchMedia = () => motionQueryStub;
	});

	afterEach(() => {
		globalThis.matchMedia = originalMatchMedia;
	});

	it("paces displayedText instead of surfacing the full source immediately while streaming", async () => {
		const controller = createStreamingRevealController("smooth");

		controller.setState("Hello world", true);

		expect(controller.displayedText).toBe("");
		expect(controller.mode).toBe("streaming");
		expect(controller.isRevealActive).toBe(true);

		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(0);
		expect(controller.displayedText.length).toBeLessThan("Hello world".length);
		expect("Hello world".startsWith(controller.displayedText)).toBe(true);
	});

	it("continues revealing more text across ticks as streaming text grows", async () => {
		const controller = createStreamingRevealController("smooth");

		controller.setState("Hello world again", true);
		await waitForRevealTick();
		const firstTickText = controller.displayedText;

		controller.setState("Hello world again and again", true);
		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(firstTickText.length);
		expect("Hello world again and again".startsWith(controller.displayedText)).toBe(true);
	});

	it("paces a new non-prefix stream after the caller resets message identity", async () => {
		const controller = createStreamingRevealController("smooth");
		controller.setState("Previous assistant message", true, { seedFromSource: true });

		controller.reset();
		controller.setState("New assistant message should pace in", true);

		expect(controller.displayedText).toBe("");
		expect(controller.mode).toBe("streaming");

		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(0);
		expect(controller.displayedText.length).toBeLessThan(
			"New assistant message should pace in".length
		);
		expect("New assistant message should pace in".startsWith(controller.displayedText)).toBe(
			true
		);
	});

	it("paces real text when a streaming row starts with whitespace-only placeholder text", async () => {
		const controller = createStreamingRevealController("smooth");
		const text =
			"Streaming interfaces should grow steadily after a provider sends the first visible text.";

		controller.setState("  ", true);
		await waitForRevealTick();
		expect(controller.displayedText).toBe("  ");

		controller.setState(text, true);

		expect(controller.displayedText.length).toBeLessThan(text.length);
		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(0);
		expect(controller.displayedText.length).toBeLessThan(text.length);
		expect(text.startsWith(controller.displayedText)).toBe(true);
	});

	it("can resume a remounted live reveal from cached visible progress", async () => {
		const controller = createStreamingRevealController("smooth");
		const text =
			"Remounted live reveals should preserve the visible prefix without snapping to the complete source.";
		const visibleProgress = "Remounted live reveals";

		controller.setState(text, true, { seedDisplayedText: visibleProgress });

		expect(controller.displayedText).toBe(visibleProgress);
		expect(controller.displayedText.length).toBeLessThan(text.length);
		expect(controller.isRevealActive).toBe(true);

		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(visibleProgress.length);
		expect(controller.displayedText.length).toBeLessThan(text.length);
		expect(text.startsWith(controller.displayedText)).toBe(true);
	});

	it("catches up after streaming stops, then drains before going inactive", async () => {
		const controller = createStreamingRevealController("smooth");
		const text = "Hello world from Acepe";

		controller.setState(text, true);
		await waitForRevealTick();
		expect(controller.displayedText.length).toBeLessThan(text.length);

		controller.setState(text, false);
		expect(controller.mode).toBe("completion-catchup");
		expect(controller.isRevealActive).toBe(true);

		for (let index = 0; index < 8 && controller.displayedText !== text; index += 1) {
			await waitForRevealTick();
		}

		expect(controller.displayedText).toBe(text);
		expect(controller.mode).toBe("complete");
		expect(controller.isRevealActive).toBe(true);

		await waitForDrain();

		expect(controller.isRevealActive).toBe(false);
	});

	it("keeps completion catch-up bounded when a streamed response completes with a large backlog", async () => {
		const controller = createStreamingRevealController("smooth");
		const text = [
			"The shell printed exactly acepe-diagnostic-reveal-probe.",
			"Smooth streaming should keep text growing after the provider completes the turn.",
			"Large batches must not appear as one final block when the reveal has barely started.",
		].join(" ".repeat(80));

		controller.setState(text, true);
		await waitForRevealTick();
		await waitForRevealTick();
		await waitForRevealTick();
		const lengthBeforeCompletion = controller.displayedText.length;

		controller.setState(text, false);
		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(lengthBeforeCompletion);
		expect(controller.displayedText.length).toBeLessThanOrEqual(lengthBeforeCompletion + 512);
		expect(text.startsWith(controller.displayedText)).toBe(true);
	});

	it("can use streaming pace for an explicitly requested completed-text reveal", async () => {
		const controller = createStreamingRevealController("smooth");
		const text = "A completed assistant response can still pace in with streaming cadence.";

		controller.setState(text, false, { paceCompletionWithStreaming: true });
		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(0);
		expect(controller.displayedText.length).toBeLessThanOrEqual(18);
		expect(text.startsWith(controller.displayedText)).toBe(true);
	});

	it("paces explicit completed-text replacement instead of snapping on non-prefix source", async () => {
		const controller = createStreamingRevealController("smooth");
		const transientText = "Transient partial text from a reused row.";
		const finalText =
			"Buffered final assistant responses should reveal from their own prefix instead of snapping.";

		controller.setState(transientText, false, { paceCompletionWithStreaming: true });
		await waitForRevealTick();
		expect(controller.displayedText.length).toBeGreaterThan(0);

		controller.setState(finalText, false, { paceCompletionWithStreaming: true });

		expect(controller.displayedText).not.toBe(finalText);

		await waitForRevealTick();

		expect(controller.displayedText.length).toBeGreaterThan(0);
		expect(controller.displayedText.length).toBeLessThan(finalText.length);
		expect(finalText.startsWith(controller.displayedText)).toBe(true);
	});

	it("preserves explicit paced visible text through transient empty source updates", async () => {
		const controller = createStreamingRevealController("smooth");
		const text = "SENTINEL visible reveal progress should survive a transient empty update.";

		controller.setState(text, false, { paceCompletionWithStreaming: true });
		await waitForRevealTick();
		const visibleProgress = controller.displayedText;

		controller.setState("", false, { paceCompletionWithStreaming: true });

		expect(controller.displayedText).toBe(visibleProgress);
	});

	it("snaps to full text immediately when reduced motion is enabled", () => {
		motionQueryStub = createMotionQueryStub(true);
		globalThis.matchMedia = () => motionQueryStub;

		const controller = createStreamingRevealController("smooth");
		controller.setState("Hello world", true);

		expect(controller.displayedText).toBe("Hello world");
		expect(controller.mode).toBe("paused-awaiting-more");
		expect(controller.isRevealActive).toBe(true);
	});

	it("supports seedFromSource and reset across compatibility values", () => {
		const smooth = createAndSeedController("smooth");
		const instant = createAndSeedController("instant");

		expect(smooth.displayedText).toBe("Already streamed text");
		expect(instant.displayedText).toBe("Already streamed text");

		smooth.reset();
		instant.reset();

		expect(smooth.displayedText).toBe("");
		expect(instant.displayedText).toBe("");
		expect(smooth.mode).toBe("idle");
		expect(instant.mode).toBe("idle");
	});

	it("returns to idle cleanly when streaming ends with empty text", () => {
		const controller = createStreamingRevealController("smooth");

		controller.setState("", true);
		expect(controller.mode).toBe("streaming");
		expect(controller.isRevealActive).toBe(true);

		controller.setState("", false);

		expect(controller.displayedText).toBe("");
		expect(controller.mode).toBe("idle");
		expect(controller.isRevealActive).toBe(false);
	});
});
