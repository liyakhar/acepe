import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRevealResizeScheduler } from "../reveal-resize-scheduler.js";

type QueuedAnimationFrame = {
	id: number;
	callback: FrameRequestCallback;
};

let queuedAnimationFrames: QueuedAnimationFrame[] = [];
let nextAnimationFrameId = 1;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

function flushAnimationFrame(): void {
	const frame = queuedAnimationFrames.shift();
	frame?.callback(0);
}

describe("createRevealResizeScheduler", () => {
	beforeEach(() => {
		queuedAnimationFrames = [];
		nextAnimationFrameId = 1;
		globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
			const id = nextAnimationFrameId;
			nextAnimationFrameId += 1;
			queuedAnimationFrames.push({ id, callback });
			return id;
		};
		globalThis.cancelAnimationFrame = (id: number): void => {
			queuedAnimationFrames = queuedAnimationFrames.filter((frame) => frame.id !== id);
		};
	});

	afterEach(() => {
		queuedAnimationFrames = [];
		globalThis.requestAnimationFrame = originalRequestAnimationFrame;
		globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
	});

	it("coalesces resize bursts into one reveal request per frame", () => {
		const reveal = vi.fn();
		const scheduler = createRevealResizeScheduler(reveal);

		scheduler.request();
		scheduler.request();
		scheduler.request();

		expect(reveal).not.toHaveBeenCalled();
		expect(queuedAnimationFrames).toHaveLength(1);

		flushAnimationFrame();

		expect(reveal).toHaveBeenCalledTimes(1);

		scheduler.request();
		flushAnimationFrame();

		expect(reveal).toHaveBeenCalledTimes(2);
	});

	it("cancels a pending resize reveal when destroyed", () => {
		const reveal = vi.fn();
		const scheduler = createRevealResizeScheduler(reveal);

		scheduler.request();
		scheduler.cancel();
		flushAnimationFrame();

		expect(reveal).not.toHaveBeenCalled();
	});
});
