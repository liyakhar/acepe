import { describe, expect, it } from "bun:test";
import {
	buildNativeFallbackWindow,
	shouldRetryNativeFallback,
} from "../viewport-fallback-controller.svelte.js";

describe("viewport-fallback-controller", () => {
	it("keeps native fallback bounded to the tail window", () => {
		const window = buildNativeFallbackWindow(["a", "b", "c", "d"], 2);

		expect(window).toEqual([
			{ entry: "c", index: 2 },
			{ entry: "d", index: 3 },
		]);
	});

	it("retains original indexes when the fallback window includes every row", () => {
		const window = buildNativeFallbackWindow(["a", "b"], 10);

		expect(window).toEqual([
			{ entry: "a", index: 0 },
			{ entry: "b", index: 1 },
		]);
	});

	it("retries only no-render fallbacks and only once", () => {
		expect(shouldRetryNativeFallback({ reason: "no_rendered_entries", retryCount: 0 })).toBe(true);
		expect(shouldRetryNativeFallback({ reason: "no_rendered_entries", retryCount: 1 })).toBe(false);
		expect(shouldRetryNativeFallback({ reason: "zero_viewport", retryCount: 0 })).toBe(false);
		expect(shouldRetryNativeFallback({ reason: null, retryCount: 0 })).toBe(false);
	});
});
