import { SegmentedProgress } from "@acepe/ui";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("svelte", async () => {
	const { createRequire } = await import("node:module");
	const { dirname, join } = await import("node:path");
	const require = createRequire(import.meta.url);
	const svelteClientPath = join(
		dirname(require.resolve("svelte/package.json")),
		"src/index-client.js"
	);

	return import(/* @vite-ignore */ svelteClientPath);
});

afterEach(() => {
	cleanup();
});

describe("SegmentedProgress", () => {
	it("renders consistent filled and muted segments", () => {
		const { container } = render(SegmentedProgress, {
			current: 3,
			total: 5,
		});

		const segments = Array.from(
			container.querySelectorAll("[data-testid='todo-progress-segment']")
		);

		expect(segments).toHaveLength(5);
		expect(
			segments.filter((segment) => segment.getAttribute("data-filled") === "true")
		).toHaveLength(3);
		expect(
			segments.filter((segment) => segment.getAttribute("data-filled") === "false")
		).toHaveLength(2);
	});
});
