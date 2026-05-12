import { readFile } from "node:fs/promises";
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

const { default: Page } = await import("./+page.svelte");

describe("pitch print and navigation contract", () => {
	it("hides chrome from print and uses top nav for section jumps", () => {
		const { body } = render(Page);

		expect(body).toContain("data-pitch-print-hidden");
		expect(body).toContain('href="#problem"');
		expect(body).toContain('href="#team"');
	});

	it("defines the authoritative print page contract in layout.css", async () => {
		const source = await readFile(new URL("./+page.svelte", import.meta.url), "utf8");

		expect(source).toContain("@page");
		expect(source).toContain("13.333in 7.5in landscape");
		expect(source).toContain("margin: 0");
		expect(source).toContain("[data-pitch-section]");
		expect(source).toContain("break-after: page");
		expect(source).toContain("[data-pitch-print-hidden]");
		expect(source).toContain("display: none !important");
	});
});
