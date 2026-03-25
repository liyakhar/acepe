import { LoadingIcon } from "@acepe/ui/icons";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock(
	"svelte",
	async () =>
		// @ts-expect-error Test-only client runtime override for Vitest component mounting
		import("../../../../../node_modules/svelte/src/index-client.js")
);

afterEach(() => {
	cleanup();
});

describe("LoadingIcon", () => {
	it("applies caller-provided dimensions to the rendered svg", () => {
		const { container } = render(LoadingIcon, {
			style: "width: 14px; height: 14px;",
		});

		const svg = container.querySelector("svg");
		const svgStyle = svg?.getAttribute("style");
		const svgClass = svg?.getAttribute("class");

		expect(svg).not.toBeNull();
		expect(svgStyle).toContain("width: 14px");
		expect(svgStyle).toContain("height: 14px");
		expect(svg?.getAttribute("width")).toBeNull();
		expect(svg?.getAttribute("height")).toBeNull();
		expect(svgClass).not.toContain("size-4");
	});
});
