import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const componentPath = resolve(import.meta.dir, "./app-search-button.svelte");

describe("app search button contract", () => {
	it("uses the shared header-action button variant for the command palette trigger", () => {
		expect(existsSync(componentPath)).toBe(true);
		if (!existsSync(componentPath)) return;

		const source = readFileSync(componentPath, "utf8");

		expect(source).toContain('import { Button } from "../button/index.js";');
		expect(source).toContain('<Button');
		expect(source).toContain('variant="headerAction"');
		expect(source).toContain('size="headerAction"');
		expect(source).toContain("<MagnifyingGlass");
		expect(source).toContain("<kbd");
		expect(source).not.toContain('<button\n\ttype="button"');
	});
});
