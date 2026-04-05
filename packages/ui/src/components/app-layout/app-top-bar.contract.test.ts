import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const componentPath = resolve(import.meta.dir, "./app-top-bar.svelte");

describe("app top bar contract", () => {
	it("can suppress the leading border on the right action rail", () => {
		expect(existsSync(componentPath)).toBe(true);
		if (!existsSync(componentPath)) return;

		const source = readFileSync(componentPath, "utf8");

		expect(source).toContain("showRightSectionLeadingBorder?: boolean;");
		expect(source).toContain("showRightSectionLeadingBorder = true,");
		expect(source).toContain(
			'class="flex items-center h-full divide-x divide-border/50 border-r border-border/50 {showRightSectionLeadingBorder ? \'border-l border-border/50\' : \'\'}"'
		);
	});
});
