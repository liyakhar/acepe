import { readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";

describe("auth layout font classes", () => {
	it("uses the branded sans utility for the auth hero copy", () => {
		const source = readFileSync(new URL("./+layout.svelte", import.meta.url), "utf8");

		expect(source).toContain('class="font-sans text-2xl font-medium tracking-tight"');
		expect(source).toContain(
			'class="font-sans text-5xl leading-[1.1] tracking-[-1.5px] font-normal"'
		);
		expect(source).not.toContain("font-matter");
	});
});